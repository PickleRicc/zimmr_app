// API route for creating and listing invoices for the logged-in craftsman
// GET    /api/invoices            – list all invoices (optionally filter by ?status=)
// POST   /api/invoices            – create new invoice
// NOTE: Detail operations (GET/PUT/DELETE) live in /api/invoices/[id]/route.js

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
