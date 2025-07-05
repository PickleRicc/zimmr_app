// API route for operations on a single quote (/api/quotes/[id])
// Supports GET, PUT, DELETE

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: { persistSession: false }
  }
);

// ---------- HELPERS (duplicated – consider extracting to shared util) ----------
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
  const { data: row } = await supabase
    .from('craftsmen')
    .select('id')
    .eq('user_id', user.id)
    .single();
  if (row) return row.id;
  const { data: created, error: createErr } = await supabase
    .from('craftsmen')
    .insert({ user_id: user.id, name: user.user_metadata?.full_name || user.email })
    .select('id')
    .single();
  if (createErr) throw createErr;
  return created.id;
}

// Extract id param from Next.js request
const getId = (req) => req.nextUrl.pathname.split('/').pop();

// ---------- READ ----------
export async function GET(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return new Response('Unauthorized', { status: 401 });
    const craftsmanId = await getOrCreateCraftsmanId(user);
    const id = getId(req);
    const { searchParams } = new URL(req.url);
    const includeMaterials = searchParams.get('materials') !== 'false';

    // Get quote data
    const { data: quote, error } = await supabase
      .from('quotes')
      .select('*')
      .eq('id', id)
      .eq('craftsman_id', craftsmanId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error; // not found
    if (!quote) return Response.json(null);
    
    // Log information about materials from JSONB field
    console.log('Quote GET - Using materials from JSONB field:', id);
    if (!quote.materials) {
      console.log('No materials found in JSONB field, initializing empty array');
      quote.materials = [];
    } else {
      console.log('Found materials in JSONB field:', Array.isArray(quote.materials) ? quote.materials.length : 'not an array');
    }
    
    return Response.json(quote);
  } catch (err) {
    console.error('/api/quotes/[id] GET error', err.message);
    return new Response(err.message || 'Server error', { status: 500 });
  }
}

// ---------- UPDATE ----------
export async function PUT(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return new Response('Unauthorized', { status: 401 });
    const craftsmanId = await getOrCreateCraftsmanId(user);
    const id = getId(req);
    const body = await req.json();
    delete body.craftsman_id;
    
    const materials = body.materials || [];
    
    // Calculate total materials price
    let totalMaterialsPrice = 0;
    materials.forEach(material => {
      totalMaterialsPrice += (parseFloat(material.quantity) || 0) * (parseFloat(material.unit_price) || 0);
    });
    
    // Prepare update data with materials in JSONB field
    const updateData = {
      ...body,
      materials: materials,  // Store materials directly in JSONB field
      total_materials_price: totalMaterialsPrice.toFixed(2)
    };
    
    console.log(`Updating quote ${id} with ${materials.length} materials directly in JSONB field`);
    
    // Update the quote with materials in JSONB
    const { data: quoteData, error: quoteError } = await supabase
      .from('quotes')
      .update(updateData)
      .eq('id', id)
      .eq('craftsman_id', craftsmanId)
      .select()
      .single();
    
    if (quoteError) {
      console.error('Error updating quote with materials in JSONB:', quoteError);
      throw quoteError;
    }
    
    console.log('Successfully updated quote with materials in JSONB field');
    
    // Get the updated quote with materials
    const { data: updatedQuote, error: finalError } = await supabase
      .from('quotes')
      .select('*')
      .eq('id', id)
      .eq('craftsman_id', craftsmanId)
      .single();
    
    if (finalError) throw finalError;
    
    // Ensure materials field is an array in the updated quote
    if (!updatedQuote.materials) {
      updatedQuote.materials = [];
      console.log('No materials found in updated quote JSONB, using empty array');
    } else {
      console.log(`Found ${Array.isArray(updatedQuote.materials) ? updatedQuote.materials.length : 0} materials in updated quote JSONB`);
    }
    
    return Response.json(updatedQuote);
  } catch (err) {
    console.error('/api/quotes/[id] PUT error', err.message);
    return new Response(err.message || 'Server error', { status: 500 });
  }
}

// ---------- DELETE ----------
export async function DELETE(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return new Response('Unauthorized', { status: 401 });
    const craftsmanId = await getOrCreateCraftsmanId(user);
    const id = getId(req);

    const { error } = await supabase
      .from('quotes')
      .delete()
      .eq('id', id)
      .eq('craftsman_id', craftsmanId);
    if (error) throw error;
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error('/api/quotes/[id] DELETE error', err.message);
    return new Response(err.message || 'Server error', { status: 500 });
  }
}
