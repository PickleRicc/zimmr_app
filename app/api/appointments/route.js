// API route for appointments CRUD using Supabase
// Location: app/api/appointments/route.js (Next.js App Router)
// Each HTTP verb is exported as a function (GET, POST, PUT, DELETE)

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialise Supabase client for server-side use

// Initialise Supabase client for server-side use
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false
    }
  }
);

// Helper: authenticate request using Bearer token
async function getUserFromRequest(req) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.replace('Bearer ', '')
    : null;

  if (!token) return null;
  const {
    data: { user },
    error
  } = await supabase.auth.getUser(token);
  if (error) {
    console.error('Supabase auth error', error.message);
    return null;
  }
  return user;
}

export async function GET(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    // determine craftsman belonging to current user
    const { data: craftsmanRow, error: craftsmanErr } = await supabase
      .from('craftsmen')
      .select('id')
      .eq('user_id', user.id)
      .single();
    if (craftsmanErr || !craftsmanRow) {
      console.error('Craftsman not found for user:', craftsmanErr || 'No data found');
      return NextResponse.json({ error: 'Craftsman not found for user' }, { status: 404 });
    }
    const craftsmanUuid = craftsmanRow.id;

    if (id) {
      // Fetch single appointment by id (and craftsman check)
      let query = supabase.from('appointments').select('*').eq('id', id).single();
      
      // Use the craftsman UUID we already determined
      query = query.eq('craftsman_id', craftsmanUuid);
      
      const { data, error } = await query;
      if (error) {
        console.error('Error fetching appointment:', error);
        return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
      }
      if (!data) {
        return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
      }
      return NextResponse.json(data);
    }

    // List appointments for logged-in craftsman
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('craftsman_id', craftsmanUuid)
      .order('scheduled_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching appointments list:', error);
      return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
    }
    
    return NextResponse.json(data);
  } catch (err) {
    console.error('GET /api/appointments error', err.message);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();

    // ensure craftsman exists
    const craftsmanId = await (async () => {
      try {
        // First, try to find existing craftsman
        const { data: row } = await supabase.from('craftsmen').select('id').eq('user_id', user.id).single();
        if (row) {
          console.log('Found existing craftsman for appointment:', row.id);
          return row.id;
        }
        
        console.log('No craftsman found, attempting to create one with RLS bypass');
        
        // If no craftsman found, try to create one with service role key
        const { data: created, error: createErr } = await supabase
          .from('craftsmen')
          .insert({ 
            user_id: user.id, 
            name: user.user_metadata?.full_name || user.email,
            // Add required fields to pass RLS policies
            created_at: new Date().toISOString()
          })
          .select('id')
          .single();
          
        if (createErr) {
          console.error('Error creating craftsman:', createErr);
          
          // If we get RLS error, try to find the craftsman record again
          // (it might exist but was created in another session/deployment)
          if (createErr.message && createErr.message.includes('violates row-level security policy')) {
            const { data: existingRow } = await supabase
              .from('craftsmen')
              .select('id')
              .eq('user_id', user.id)
              .single();
              
            if (existingRow) {
              console.log('Found craftsman on retry:', existingRow.id);
              return existingRow.id;
            }
          }
          
          throw createErr;
        }
        
        console.log('Created new craftsman:', created.id);
        return created.id;
      } catch (err) {
        console.error('Error in craftsman creation for appointment:', err);
        throw new Error('Failed to retrieve craftsman profile: ' + err.message);
      }
    })();

    body.craftsman_id = craftsmanId;
    if ('is_private' in body) {
      body.private = body.is_private;
      delete body.is_private;
    }
    console.log('Creating appointment', body);
    const { data, error } = await supabase.from('appointments').insert(body).select().single();
    if (error) {
      console.error('Error creating appointment:', error);
      return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
    }
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('POST /api/appointments error', err.message);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    // Get craftsman ID for the logged-in user
    const { data: craftsmanRow, error: craftsmanErr } = await supabase
      .from('craftsmen')
      .select('id')
      .eq('user_id', user.id)
      .single();
    
    if (craftsmanErr || !craftsmanRow) {
      console.error('Craftsman not found for user:', craftsmanErr || 'No data found');
      return NextResponse.json({ error: 'Craftsman not found for user' }, { status: 404 });
    }
    
    const { id, ...rest } = body;
    // prevent craftsman_id change explicitly; always ensure belongs to user
    delete rest.craftsman_id;
    
    const { data, error } = await supabase
      .from('appointments')
      .update(rest)
      .eq('id', id)
      .eq('craftsman_id', craftsmanRow.id) // Ensure appointment belongs to this craftsman
      .select()
      .single();
      
    if (error) {
      console.error('Error updating appointment:', error);
      return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
    }
    
    if (!data) {
      return NextResponse.json({ error: 'Appointment not found or does not belong to user' }, { status: 404 });
    }
    
    return NextResponse.json(data);
  } catch (err) {
    console.error('PUT /api/appointments error', err.message);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id query param required' }, { status: 400 });
    
    // Get craftsman ID for the logged-in user
    const { data: craftsmanRow, error: craftsmanErr } = await supabase
      .from('craftsmen')
      .select('id')
      .eq('user_id', user.id)
      .single();
    
    if (craftsmanErr || !craftsmanRow) {
      console.error('Craftsman not found for user:', craftsmanErr || 'No data found');
      return NextResponse.json({ error: 'Craftsman not found for user' }, { status: 404 });
    }

    // Delete the appointment ensuring it belongs to this craftsman
    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', id)
      .eq('craftsman_id', craftsmanRow.id); // Ensure appointment belongs to this craftsman
      
    if (error) {
      console.error('Error deleting appointment:', error);
      return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
    }
    
    return NextResponse.json({ message: 'Appointment deleted successfully' }, { status: 200 });
  } catch (err) {
    console.error('DELETE /api/appointments error', err.message);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
