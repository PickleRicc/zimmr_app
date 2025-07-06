// API route for creating and listing invoices for the logged-in craftsman
// GET    /api/invoices            – list all invoices (optionally filter by ?status=)
// POST   /api/invoices            – create new invoice
// NOTE: Detail operations (GET/PUT/DELETE) live in /api/invoices/[id]/route.js

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Log which environment variables are available (for debugging)
const hasServiceRoleKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasAnonKey = !!process.env.SUPABASE_ANON_KEY || !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

console.log('Supabase API client initialization:', { 
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

// ---------- HELPERS ----------
const camelToSnake = (obj = {}) =>
  Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k.replace(/([A-Z])/g, '_$1').toLowerCase(), v])
  );

async function getUserFromRequest(req) {
  try {
    // Log the request to help debug authentication issues
    console.log('API Request Headers:', {
      authorization: req.headers.get('authorization') ? 'Present (not shown)' : 'Missing',
      'content-type': req.headers.get('content-type'),
      origin: req.headers.get('origin'),
      referer: req.headers.get('referer')
    });
    
    const auth = req.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    
    if (!token) {
      console.log('No auth token provided in request');
      return null;
    }
    
    console.log('Validating auth token...');
    const { data, error } = await supabase.auth.getUser(token);
    
    if (error) {
      console.error('Auth token validation failed:', error.message);
      return null;
    }
    
    if (!data || !data.user) {
      console.error('Auth response missing user data');
      return null;
    }
    
    console.log('User authenticated successfully:', data.user.id);
    return data.user;
  } catch (err) {
    console.error('Error in authentication process:', err.message);
    return null;
  }
}

async function getOrCreateCraftsmanId(user) {
  try {
    console.log('Attempting to get or create craftsman for user:', user.id);
    console.log('User metadata:', JSON.stringify(user.user_metadata || {}));
    
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
        console.log(`Find attempt ${retryCount + 1} failed:`, findError.message);
      }
        
      if (row) {
        console.log('Found existing craftsman:', row.id);
        return row.id;
      }
      
      // Only retry finding if we haven't reached max retries yet
      if (retryCount < maxRetries) {
        console.log(`Craftsman not found, retry attempt ${retryCount + 1}`);
        await new Promise(r => setTimeout(r, 500)); // Wait 500ms before retrying
        retryCount++;
      } else {
        break;
      }
    }
    
    console.log('Creating new craftsman with service role key, user_id:', user.id);
    
    // Add all required fields that might be needed by RLS policies
    const craftsmanData = { 
      user_id: user.id, 
      name: user.user_metadata?.full_name || user.email || 'New User',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      active: true
    };
    
    console.log('Craftsman data for insert:', JSON.stringify(craftsmanData));
    
    // Try to create the craftsman
    const { data: created, error: createErr } = await supabase
      .from('craftsmen')
      .insert(craftsmanData)
      .select('id')
      .single();
      
    if (createErr) {
      console.error('Error creating craftsman:', createErr.message);
      console.error('Error details:', JSON.stringify(createErr));
      
      // If RLS error, make one final attempt to find an existing record
      // It might have been created in parallel by another request
      if (createErr.message && createErr.message.includes('violates row-level security policy')) {
        console.log('RLS policy violation - checking one more time for existing craftsman');
        const { data: existingRow } = await supabase
          .from('craftsmen')
          .select('id')
          .eq('user_id', user.id)
          .single();
          
        if (existingRow) {
          console.log('Found craftsman on final retry:', existingRow.id);
          return existingRow.id;
        }
      }
      
      // If we still can't find it, we need to use RPC to create the craftsman
      // as a last resort to bypass RLS
      try {
        console.log('Attempting to create craftsman via RPC function');
        const { data: rpcResult, error: rpcError } = await supabase.rpc('create_craftsman_for_user', {
          user_id_param: user.id,
          name_param: user.user_metadata?.full_name || user.email || 'New User'
        });
        
        if (rpcError) {
          console.error('RPC function error:', rpcError);
          throw rpcError;
        }
        
        if (rpcResult) {
          console.log('Created craftsman via RPC function:', rpcResult);
          return rpcResult;
        }
      } catch (rpcErr) {
        console.error('Failed to create craftsman via RPC:', rpcErr);
      }
      
      // If all else fails, throw the original error
      throw createErr;
    }
    
    console.log('Successfully created new craftsman:', created.id);
    return created.id;
  } catch (err) {
    console.error('Error in getOrCreateCraftsmanId:', err);
    throw new Error('Failed to get or create craftsman profile: ' + err.message);
  }
}

// ---------- READ COLLECTION ----------
export async function GET(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const craftsmanId = await getOrCreateCraftsmanId(user);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    let query = supabase
      .from('invoices')
      .select('*')
      .eq('craftsman_id', craftsmanId)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) {
      console.error('Error querying invoices:', error);
      return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
    }
    return NextResponse.json(data || []);
  } catch (err) {
    console.error('/api/invoices GET error', err.message);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

// ---------- CREATE ----------
export async function POST(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const craftsmanId = await getOrCreateCraftsmanId(user);
    const materials = body.materials || [];
    
    // Calculate total materials price
    let totalMaterialsPrice = 0;
    materials.forEach(material => {
      totalMaterialsPrice += (parseFloat(material.quantity) || 0) * (parseFloat(material.unit_price) || 0);
    });
    
    // Prepare data for insertion including materials as JSONB
    const insertBody = camelToSnake({ 
      ...body, // Include all fields from body
      craftsman_id: craftsmanId,
      total_materials_price: totalMaterialsPrice.toFixed(2),
      // Store materials directly as JSONB
      materials: materials,
      // Ensure numeric values are properly formatted
      amount: parseFloat(body.amount || 0).toFixed(2),
      tax_amount: parseFloat(body.tax_amount || 0).toFixed(2),
      total_amount: parseFloat(body.total_amount || 0).toFixed(2)
    });

    console.log('Inserting invoice with materials JSONB:', materials.length, 'items');
    
    const { data: invoice, error } = await supabase
      .from('invoices')
      .insert(insertBody)
      .select()
      .single();
      
    if (error) {
      console.error('Error inserting invoice with materials:', error);
      throw error;
    }
    
    console.log('Successfully stored invoice with materials JSONB')
    
    // Return the created invoice
    return NextResponse.json({ 
      message: 'Invoice created successfully',
      invoice: invoice 
    }, { status: 201 });
  } catch (err) {
    console.error('/api/invoices POST error', err.message);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
