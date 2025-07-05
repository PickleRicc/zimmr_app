// API route for listing customers associated with the logged-in craftsman
// GET    /api/customers          – list all customers
// GET    /api/customers?id=123   - get specific customer
// POST   /api/customers          – create new customer
// PUT    /api/customers          - update customer
// DELETE /api/customers?id=123   - delete customer

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
  {
    auth: { persistSession: false }
  }
);

export async function GET(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const specificId = searchParams.get('id');

    // Find craftsman uuid for this user
    const { data: craftsmanRow, error: craftsmanError } = await supabase
      .from('craftsmen')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (craftsmanError) {
      console.error('Error finding craftsman:', craftsmanError);
      return NextResponse.json({ error: 'Failed to retrieve craftsman profile' }, { status: 500 });
    }

    if (!craftsmanRow) {
      console.log('No craftsman found for user, attempting to create one');
      // Try to create a craftsman record
      try {
        const craftsmanId = await getOrCreateCraftsmanId(user);
        if (craftsmanId) {
          console.log('Successfully created craftsman:', craftsmanId);
          if (specificId) {
            // Continue with the specific customer query
            const { data, error } = await supabase
              .from('customers')
              .select('*')
              .eq('id', specificId)
              .eq('craftsman_id', craftsmanId)
              .single();
            
            if (error) {
              console.error('Error fetching specific customer:', error);
              return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
            }
            
            return NextResponse.json(data || null);
          }
          
          // Or get all customers for the new craftsman
          const { data, error } = await supabase
            .from('customers')
            .select('*')
            .eq('craftsman_id', craftsmanId)
            .order('name');
            
          if (error) {
            console.error('Error fetching customers after creating craftsman:', error);
            return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
          }
          
          return NextResponse.json(data || []);
        }
      } catch (createErr) {
        console.error('Failed to create craftsman:', createErr);
        return NextResponse.json({ error: 'Failed to create craftsman profile' }, { status: 500 });
      }
      
      // If we couldn't create a craftsman, return empty array
      return NextResponse.json([], { status: 200 });
    }

    // Craftsman found, proceed with queries
    if (specificId) {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', specificId)
        .eq('craftsman_id', craftsmanRow.id)
        .single();
        
      if (error) {
        if (error.code === 'PGRST116') { // not found
          return NextResponse.json(null, { status: 404 });
        }
        
        console.error('Error fetching specific customer:', error);
        return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
      }
      
      return NextResponse.json(data || null);
    }

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('craftsman_id', craftsmanRow.id)
      .order('name');

    if (error) {
      console.error('Error fetching customers list:', error);
      return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
    }
    
    return NextResponse.json(data || []);
  } catch (err) {
    console.error('/api/customers GET error', err.message);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

async function getUserFromRequest(req) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  const {
    data: { user },
    error
  } = await supabase.auth.getUser(token);
  if (error) return null;
  return user;
}

async function getOrCreateCraftsmanId(user) {
  try {
    // First, try to find existing craftsman
    const { data: row } = await supabase
      .from('craftsmen')
      .select('id')
      .eq('user_id', user.id)
      .single();
      
    if (row) {
      console.log('Found existing craftsman:', row.id);
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
    console.error('Error in getOrCreateCraftsmanId:', err);
    throw new Error('Failed to retrieve craftsman profile: ' + err.message);
  }
}

// ---------- CREATE ----------
export async function POST(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    // attach craftsman_id of logged-in user
    const craftsmanId = await getOrCreateCraftsmanId(user);
    body.craftsman_id = craftsmanId;

    const { data, error } = await supabase.from('customers').insert(body).select().single();
    if (error) {
      console.error('Error creating customer:', error);
      return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
    }
    
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('/api/customers POST error', err.message);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

// ---------- UPDATE ----------
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
    delete rest.craftsman_id; // Prevent changing the craftsman_id
    
    const { data, error } = await supabase
      .from('customers')
      .update(rest)
      .eq('id', id)
      .eq('craftsman_id', craftsmanRow.id) // Ensure customer belongs to this craftsman
      .select()
      .single();
      
    if (error) {
      console.error('Error updating customer:', error);
      return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
    }
    
    if (!data) {
      return NextResponse.json({ error: 'Customer not found or does not belong to user' }, { status: 404 });
    }
    
    return NextResponse.json(data);
  } catch (err) {
    console.error('/api/customers PUT error', err.message);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

// ---------- DELETE ----------
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

    // Delete the customer ensuring it belongs to this craftsman
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id)
      .eq('craftsman_id', craftsmanRow.id); // Ensure customer belongs to this craftsman
      
    if (error) {
      console.error('Error deleting customer:', error);
      return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
    }
    
    return NextResponse.json({ message: 'Customer deleted successfully' }, { status: 200 });
  } catch (err) {
    console.error('/api/customers DELETE error', err.message);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
