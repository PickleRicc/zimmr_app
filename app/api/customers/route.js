// API route for listing customers associated with the logged-in craftsman
// GET    /api/customers          – list all customers
// GET    /api/customers?id=123   - get specific customer
// POST   /api/customers          – create new customer
// PUT    /api/customers          - update customer
// DELETE /api/customers?id=123   - delete customer

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Log which environment variables are available (for debugging)
const hasServiceRoleKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasAnonKey = !!process.env.SUPABASE_ANON_KEY || !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

console.log('Customers API - Supabase client initialization:', { 
  hasUrl: !!supabaseUrl, 
  hasServiceRoleKey, 
  hasAnonKey,
  url: supabaseUrl
});

// Prioritize service role key for admin operations
const supabase = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: { persistSession: false }
  }
);

export async function GET(req) {
  try {
    console.log('Customers API - Processing GET request');
    
    // Get user from auth header with improved error handling
    const user = await getUserFromRequest(req);
    if (!user) {
      console.log('Customers API - Unauthorized request - No valid user found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('Customers API - User authenticated:', user.id);
    
    const { searchParams } = new URL(req.url);
    const specificId = searchParams.get('id');
    console.log(`Customers API - Request parameters: ${specificId ? `id=${specificId}` : 'listing all'}`);
    
    // Use our improved getOrCreateCraftsmanId function to reliably get a craftsman ID
    try {
      const craftsmanId = await getOrCreateCraftsmanId(user);
      
      if (!craftsmanId) {
        console.error('Customers API - Failed to get or create craftsman ID');
        return NextResponse.json({ error: 'Failed to retrieve craftsman profile' }, { status: 500 });
      }
      
      console.log('Customers API - Using craftsman ID:', craftsmanId);
      
      // Now that we have a craftsman ID, handle the specific requests
      if (specificId) {
        console.log('Customers API - Fetching specific customer:', specificId);
        
        // Continue with the specific customer query
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .eq('id', specificId)
          .eq('craftsman_id', craftsmanId)
          .single();
        
        if (error) {
          if (error.code === 'PGRST116') { // not found
            console.log('Customers API - Customer not found:', specificId);
            return NextResponse.json(null, { status: 404 });
          }
          
          console.error('Customers API - Error fetching specific customer:', error);
          return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
        }
        
        console.log('Customers API - Successfully fetched customer');
        return NextResponse.json(data || null);
      }
      
      // Get all customers for this craftsman
      console.log('Customers API - Fetching all customers for craftsman:', craftsmanId);
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('craftsman_id', craftsmanId)
        .order('name');
        
      if (error) {
        console.error('Customers API - Error fetching customers list:', error);
        return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
      }
      
      console.log(`Customers API - Successfully fetched ${data?.length || 0} customers`);
      return NextResponse.json(data || []);
    } catch (err) {
      console.error('Customers API - Error in craftsman processing:', err);
      return NextResponse.json({ error: 'Failed to process craftsman: ' + err.message }, { status: 500 });
    }
  } catch (err) {
    console.error('/api/customers GET error', err.message);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

// get user from request authorization header
async function getUserFromRequest(req) {
  try {
    // Log the request to help debug authentication issues
    console.log('Customers API - Request Headers:', {
      authorization: req.headers.get('authorization') ? 'Present (not shown)' : 'Missing',
      'content-type': req.headers.get('content-type'),
      origin: req.headers.get('origin'),
      referer: req.headers.get('referer')
    });
    
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Customers API - No valid auth token provided');
      return null;
    }
    
    const token = authHeader.replace('Bearer ', '');
    console.log('Customers API - Validating auth token...');
    
    const { data, error } = await supabase.auth.getUser(token);
    
    if (error) {
      console.error('Customers API - Auth token validation failed:', error.message);
      return null;
    }
    
    if (!data || !data.user) {
      console.error('Customers API - Auth response missing user data');
      return null;
    }
    
    console.log('Customers API - User authenticated successfully:', data.user.id);
    return data.user;
  } catch (err) {
    console.error('Customers API - Error in authentication process:', err.message);
    return null;
  }
}

async function getOrCreateCraftsmanId(user) {
  try {
    console.log('Customers API - Attempting to get or create craftsman for user:', user.id);
    console.log('Customers API - User metadata:', JSON.stringify(user.user_metadata || {}));
    
    // First, try to find existing craftsman - check multiple times with delay if needed
    let retryCount = 0;
    const maxRetries = 2;
    
    while (retryCount <= maxRetries) {
      const { data: row, error: findError } = await supabase
        .from('craftsmen')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (findError) {
        console.log(`Customers API - Find attempt ${retryCount + 1} failed:`, findError.message);
      }
        
      if (row) {
        console.log('Customers API - Found existing craftsman:', row.id);
        return row.id;
      }
      
      // Only retry finding if we haven't reached max retries yet
      if (retryCount < maxRetries) {
        console.log(`Customers API - Craftsman not found, retry attempt ${retryCount + 1}`);
        await new Promise(r => setTimeout(r, 500)); // Wait 500ms before retrying
        retryCount++;
      } else {
        break;
      }
    }
    
    console.log('Customers API - Creating new craftsman with service role key, user_id:', user.id);
    
    // Add all required fields that might be needed by RLS policies
    const craftsmanData = { 
      user_id: user.id, 
      name: user.user_metadata?.full_name || user.email || 'New User',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      active: true
    };
    
    console.log('Customers API - Craftsman data for insert:', JSON.stringify(craftsmanData));
    
    // Try to create the craftsman
    const { data: created, error: createErr } = await supabase
      .from('craftsmen')
      .insert(craftsmanData)
      .select('id')
      .single();
      
    if (createErr) {
      console.error('Customers API - Error creating craftsman:', createErr.message);
      console.error('Customers API - Error details:', JSON.stringify(createErr));
      
      // If RLS error, make one final attempt to find an existing record
      // It might have been created in parallel by another request
      if (createErr.message && createErr.message.includes('violates row-level security policy')) {
        console.log('Customers API - RLS policy violation - checking one more time for existing craftsman');
        const { data: existingRow } = await supabase
          .from('craftsmen')
          .select('id')
          .eq('user_id', user.id)
          .single();
          
        if (existingRow) {
          console.log('Customers API - Found craftsman on final retry:', existingRow.id);
          return existingRow.id;
        }
      }
      
      // If we still can't find it, we need to use RPC to create the craftsman
      // as a last resort to bypass RLS
      try {
        console.log('Customers API - Attempting to create craftsman via RPC function');
        const { data: rpcResult, error: rpcError } = await supabase.rpc('create_craftsman_for_user', {
          user_id_param: user.id,
          name_param: user.user_metadata?.full_name || user.email || 'New User'
        });
        
        if (rpcError) {
          console.error('Customers API - RPC function error:', rpcError);
          throw rpcError;
        }
        
        if (rpcResult) {
          console.log('Customers API - Created craftsman via RPC function:', rpcResult);
          return rpcResult;
        }
      } catch (rpcErr) {
        console.error('Customers API - Failed to create craftsman via RPC:', rpcErr);
      }
      
      // If all else fails, throw the original error
      throw createErr;
    }
    
    console.log('Customers API - Successfully created new craftsman:', created.id);
    return created.id;
  } catch (err) {
    console.error('Customers API - Error in getOrCreateCraftsmanId:', err);
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
