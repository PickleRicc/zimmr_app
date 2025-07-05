// API route for creating and listing quotes associated with the logged-in craftsman
// GET    /api/quotes            – list all quotes for craftsman (optionally filter by ?status=)
// POST   /api/quotes            – create new quote
//
// NOTE: Detail operations (GET/PUT/DELETE) live in /api/quotes/[id]/route.js

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
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
