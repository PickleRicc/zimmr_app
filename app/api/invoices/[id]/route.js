// API route for operations on a single invoice (/api/invoices/[id])
// Supports GET, PUT, DELETE

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
  {
    auth: { persistSession: false }
  }
);

// ---------- HELPERS ----------
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

// Extract id param from Next.js request (last segment)
const getId = (req) => req.nextUrl.pathname.split('/').pop();

// ---------- READ ----------
export async function GET(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const craftsmanId = await getOrCreateCraftsmanId(user);
    const id = getId(req);
    const { searchParams } = new URL(req.url);
    const includeMaterials = searchParams.get('materials') !== 'false';
    
    // Get invoice data
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .eq('craftsman_id', craftsmanId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching invoice:', error);
      return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
    }
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    
    // Log information about materials from JSONB
    console.log('Invoice GET - Using materials from JSONB field:', invoice.id);
    if (!invoice.materials) {
      console.log('No materials found in JSONB field, initializing empty array');
      invoice.materials = [];
    } else {
      console.log('Found materials in JSONB field:', Array.isArray(invoice.materials) ? invoice.materials.length : 'not an array');
    }
    
    return NextResponse.json(invoice);
  } catch (err) {
    console.error('Error in GET /api/invoices/[id]:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

async function getInvoice(id, user) {
  const craftsmanId = await getOrCreateCraftsmanId(user);
  const { searchParams } = new URL(req.url);
  const includeMaterials = searchParams.get('materials') !== 'false';

  // Get invoice data
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('craftsman_id', craftsmanId)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // not found
  if (!invoice) return null;

  // Log information about materials from JSONB
  console.log('Invoice GET - Using materials from JSONB field:', invoice.id);
  if (!invoice.materials) {
    console.log('No materials found in JSONB field, initializing empty array');
    invoice.materials = [];
  } else {
    console.log('Found materials in JSONB field:', Array.isArray(invoice.materials) ? invoice.materials.length : 'not an array');
  }

  return invoice;
}

// ---------- UPDATE ----------
export async function PUT(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const craftsmanId = await getOrCreateCraftsmanId(user);
    const id = getId(req);
    const body = await req.json();
    delete body.craftsman_id; // never allow overriding ownership

    const materials = body.materials || [];

    // Calculate total materials price
    let totalMaterialsPrice = 0;
    materials.forEach(material => {
      totalMaterialsPrice += (parseFloat(material.quantity) || 0) * (parseFloat(material.unit_price) || 0);
    });

    
    // Add materials and total materials price to the body for direct JSONB storage
    const updateBody = {
      ...body,
      materials: materials, // Store materials directly as JSONB
      total_materials_price: totalMaterialsPrice.toFixed(2)
    };
    
    console.log(`Updating invoice ${id} with ${materials.length} materials items in JSONB field`);
    
    // Update the invoice with materials in the JSONB field
    const { data: invoiceData, error: invoiceError } = await supabase
      .from('invoices')
      .update(updateBody)
      .eq('id', id)
      .eq('craftsman_id', craftsmanId)
      .select()
      .single();
    
    if (invoiceError) {
      console.error('Error updating invoice with materials JSONB:', invoiceError);
      throw invoiceError;
    }
    
    console.log('Successfully updated invoice with materials in JSONB field');
    
    // Get the updated invoice with materials already in JSONB field
    const { data: updatedInvoice, error: finalError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .eq('craftsman_id', craftsmanId)
      .single();
    
    if (finalError) throw finalError;
    
    // Ensure materials field is an array
    if (!updatedInvoice.materials) {
      updatedInvoice.materials = [];
      console.log('No materials in updated invoice JSONB, using empty array');
    } else {
      console.log(`Found ${Array.isArray(updatedInvoice.materials) ? updatedInvoice.materials.length : 0} materials in updated invoice JSONB`);
    }
    
    return NextResponse.json(updatedInvoice);
  } catch (err) {
    console.error('/api/invoices/[id] PUT error', err.message);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

// ---------- DELETE ----------
export async function DELETE(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const craftsmanId = await getOrCreateCraftsmanId(user);
    const id = getId(req);

    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', id)
      .eq('craftsman_id', craftsmanId);
    if (error) {
      console.error('Error deleting invoice:', error);
      return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Invoice deleted successfully' }, { status: 200 });
  } catch (err) {
    console.error('/api/invoices/[id] DELETE error', err.message);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
