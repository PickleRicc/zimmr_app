// API route for creating and listing quotes associated with the logged-in craftsman
// GET    /api/quotes            – list all quotes for craftsman (optionally filter by ?status=)
// POST   /api/quotes            – create new quote
//
// NOTE: Detail operations (GET/PUT/DELETE) live in /api/quotes/[id]/route.js

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Log which environment variables are available (for debugging)
const hasServiceRoleKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasAnonKey = !!process.env.SUPABASE_ANON_KEY || !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

console.log('Quotes API - Supabase client initialization:', { 
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
    console.log('Quotes API - Request Headers:', {
      authorization: req.headers.get('authorization') ? 'Present (not shown)' : 'Missing',
      'content-type': req.headers.get('content-type'),
      origin: req.headers.get('origin'),
      referer: req.headers.get('referer')
    });
    
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : null;
    
    if (!token) {
      console.log('Quotes API - No auth token provided in request');
      return null;
    }
    
    console.log('Quotes API - Validating auth token...');
    const { data, error } = await supabase.auth.getUser(token);
    
    if (error) {
      console.error('Quotes API - Auth token validation failed:', error.message);
      return null;
    }
    
    if (!data || !data.user) {
      console.error('Quotes API - Auth response missing user data');
      return null;
    }
    
    console.log('Quotes API - User authenticated successfully:', data.user.id);
    return data.user;
  } catch (err) {
    console.error('Quotes API - Error in authentication process:', err.message);
    return null;
  }
}

async function getOrCreateCraftsmanId(user) {
  try {
    console.log('Quotes API - Attempting to get or create craftsman for user:', user.id);
    console.log('Quotes API - User metadata:', JSON.stringify(user.user_metadata || {}));
    
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
        console.log(`Quotes API - Find attempt ${retryCount + 1} failed:`, findError.message);
      }
        
      if (row) {
        console.log('Quotes API - Found existing craftsman:', row.id);
        return row.id;
      }
      
      // Only retry finding if we haven't reached max retries yet
      if (retryCount < maxRetries) {
        console.log(`Quotes API - Craftsman not found, retry attempt ${retryCount + 1}`);
        await new Promise(r => setTimeout(r, 500)); // Wait 500ms before retrying
        retryCount++;
      } else {
        break;
      }
    }
    
    console.log('Quotes API - Creating new craftsman with service role key, user_id:', user.id);
    
    // Add all required fields that might be needed by RLS policies
    const craftsmanData = { 
      user_id: user.id, 
      name: user.user_metadata?.full_name || user.email || 'New User',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      active: true
    };
    
    console.log('Quotes API - Craftsman data for insert:', JSON.stringify(craftsmanData));
    
    // Try to create the craftsman
    const { data: created, error: createErr } = await supabase
      .from('craftsmen')
      .insert(craftsmanData)
      .select('id')
      .single();
      
    if (createErr) {
      console.error('Quotes API - Error creating craftsman:', createErr.message);
      console.error('Quotes API - Error details:', JSON.stringify(createErr));
      
      // If RLS error, make one final attempt to find an existing record
      // It might have been created in parallel by another request
      if (createErr.message && createErr.message.includes('violates row-level security policy')) {
        console.log('Quotes API - RLS policy violation - checking one more time for existing craftsman');
        const { data: existingRow } = await supabase
          .from('craftsmen')
          .select('id')
          .eq('user_id', user.id)
          .single();
          
        if (existingRow) {
          console.log('Quotes API - Found craftsman on final retry:', existingRow.id);
          return existingRow.id;
        }
      }
      
      // If we still can't find it, we need to use RPC to create the craftsman
      // as a last resort to bypass RLS
      try {
        console.log('Quotes API - Attempting to create craftsman via RPC function');
        const { data: rpcResult, error: rpcError } = await supabase.rpc('create_craftsman_for_user', {
          user_id_param: user.id,
          name_param: user.user_metadata?.full_name || user.email || 'New User'
        });
        
        if (rpcError) {
          console.error('Quotes API - RPC function error:', rpcError);
          throw rpcError;
        }
        
        if (rpcResult) {
          console.log('Quotes API - Created craftsman via RPC function:', rpcResult);
          return rpcResult;
        }
      } catch (rpcErr) {
        console.error('Quotes API - Failed to create craftsman via RPC:', rpcErr);
      }
      
      // If all else fails, throw the original error
      throw createErr;
    }
    
    console.log('Quotes API - Successfully created new craftsman:', created.id);
    return created.id;
  } catch (err) {
    console.error('Quotes API - Error in getOrCreateCraftsmanId:', err);
    throw new Error('Failed to retrieve craftsman profile: ' + err.message);
  }
}

// ---------- READ COLLECTION ----------
export async function GET(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: craftsman, error: craftsmanError } = await supabase
      .from('craftsmen')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (craftsmanError) {
      console.error('Error fetching craftsman:', craftsmanError);
      return NextResponse.json(
        { error: 'Failed to retrieve craftsman profile' },
        { status: 500 }
      );
    }

    if (!craftsman) {
      return NextResponse.json(
        { error: 'Craftsman profile not found for this user' },
        { status: 404 }
      );
    }

    // Parse query params
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const customerId = url.searchParams.get('customerId');

    // Build query
    let query = supabase
      .from('quotes')
      .select(
        '*'
      )
      .eq('craftsman_id', craftsman.id)
      .order('created_at', { ascending: false });

    // Add status filter if provided
    if (status) {
      query = query.eq('status', status);
    }

    // Add customer filter if provided
    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error querying quotes:', error);
      return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
    }

    // Get materials for each quote if requested
    const includeMaterials = url.searchParams.get('materials') === 'true';
    if (includeMaterials && data?.length) {
      const quoteIds = data.map(q => q.id);
      const { data: materials, error: materialsError } = await supabase
        .from('quote_materials')
        .select('*')
        .in('quote_id', quoteIds);
      
      if (materialsError) {
        console.error('Error fetching materials:', materialsError);
        return NextResponse.json({ error: 'Failed to retrieve materials' }, { status: 500 });
      }
      
      // Group materials by quote_id
      const materialsByQuote = {};
      materials?.forEach(material => {
        if (!materialsByQuote[material.quote_id]) {
          materialsByQuote[material.quote_id] = [];
        }
        materialsByQuote[material.quote_id].push(material);
      });
      
      // Attach materials to each quote
      data.forEach(quote => {
        quote.materials = materialsByQuote[quote.id] || [];
      });
    }
    
    return NextResponse.json(data || []);
  } catch (err) {
    console.error('/api/quotes GET error', err.message);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

// ---------- CREATE ----------
export async function POST(req) {
  try {
    // First, check the actual schema of the quotes table
    const { data: tableInfo, error: tableError } = await supabase
      .from('quotes')
      .select('*')
      .limit(1);
    
    if (tableError) {
      console.error('Error fetching quotes schema:', tableError);
    }
    
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const craftsmanId = await getOrCreateCraftsmanId(user);
    const materials = body.materials || [];

    // Validate the request
    if (!craftsmanId) {
      return NextResponse.json({ error: 'Craftsman ID is required' }, { status: 400 });
    }

    // Parse materials for pricing calculations
    let totalMaterialsPrice = 0;
    materials.forEach(material => {
      totalMaterialsPrice += (parseFloat(material.quantity) || 0) * (parseFloat(material.unit_price) || 0);
    });

    // Transform the payload to match the actual database schema
    // Remove fields that don't exist and map fields to their correct names
    const { 
      id, description, tax_rate, title, total_price, materials: materialsList,
      ...validFields 
    } = body;
    
    // Store materials directly in the JSONB field
    console.log(`Adding ${materials.length} materials directly to quote JSONB field`);

    // Ensure we have proper numeric values for the database
    const insertBody = camelToSnake({
      ...validFields,
      craftsman_id: craftsmanId,
      // Include materials directly in JSONB field
      materials: materials,
      // Use the values from the form explicitly, with fallbacks
      amount: parseFloat(body.amount || 0).toFixed(2),
      tax_amount: parseFloat(body.tax_amount || 0).toFixed(2),
      total_amount: parseFloat(body.total_amount || 0).toFixed(2),
      total_materials_price: totalMaterialsPrice.toFixed(2),
      notes: validFields.notes || description || '', // Store any description in notes
      status: validFields.status || 'draft',
      vat_exempt: body.vat_exempt || false
    });

    // Make sure the numeric fields are properly formatted
    const quoteInsert = {
      ...insertBody,
      amount: parseFloat(insertBody.amount || 0).toFixed(2),
      tax_amount: parseFloat(insertBody.tax_amount || 0).toFixed(2),
      total_amount: parseFloat(insertBody.total_amount || 0).toFixed(2),
      total_materials_price: parseFloat(insertBody.total_materials_price || 0).toFixed(2)
    };

    console.log('Inserting quote with materials in JSONB field');
    const { data: quoteData, error: quoteError } = await supabase
      .from('quotes')
      .insert([quoteInsert])
      .select('*')
      .single();
      
    if (quoteError) {
      console.error('Error inserting quote with materials:', quoteError);
      throw quoteError;
    }
    
    console.log('Successfully created quote with materials in JSONB field')
    
    return NextResponse.json({ 
      message: 'Quote created successfully', 
      quote: quoteData
    }, { status: 201 });
  } catch (err) {
    console.error('/api/quotes POST error', err.message);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
