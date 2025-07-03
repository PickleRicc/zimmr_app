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
    
    // Get materials for this quote
    if (includeMaterials) {
      const { data: materials, error: materialsError } = await supabase
        .from('quote_materials')
        .select('*')
        .eq('quote_id', id);
      
      if (materialsError) throw materialsError;
      quote.materials = materials || [];
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
    delete body.materials; // Remove materials from quote body
    
    // Calculate total materials price
    let totalMaterialsPrice = 0;
    materials.forEach(material => {
      totalMaterialsPrice += (parseFloat(material.quantity) || 0) * (parseFloat(material.unit_price) || 0);
    });
    
    // Add total materials price to the body
    body.total_materials_price = totalMaterialsPrice.toFixed(2);

    // Start a transaction
    const { data, error } = await supabase.rpc('update_quote_with_materials', {
      quote_id: id,
      quote_data: body,
      materials_data: materials.map(m => ({
        id: m.id, // if existing material
        quote_id: id,
        material_id: m.material_id,
        quantity: parseFloat(m.quantity) || 0,
        unit_price: parseFloat(m.unit_price) || 0,
        name: m.name,
        unit: m.unit
      }))
    });
    
    // Manual transaction if RPC not available
    if (error || !data) {
      // Update the quote
      const { data: quoteData, error: quoteError } = await supabase
        .from('quotes')
        .update(body)
        .eq('id', id)
        .eq('craftsman_id', craftsmanId)
        .select()
        .single();
      
      if (quoteError) throw quoteError;
      
      // Delete existing materials
      const { error: deleteError } = await supabase
        .from('quote_materials')
        .delete()
        .eq('quote_id', id);
      
      if (deleteError) throw deleteError;
      
      // Insert new materials
      if (materials.length > 0) {
        const materialsToInsert = materials.map(material => ({
          quote_id: id,
          material_id: material.material_id,
          quantity: parseFloat(material.quantity) || 0,
          unit_price: parseFloat(material.unit_price) || 0,
          name: material.name,
          unit: material.unit
        }));
        
        const { error: materialsError } = await supabase
          .from('quote_materials')
          .insert(materialsToInsert);
        
        if (materialsError) throw materialsError;
      }
      
      // Get the updated quote with materials
      const { data: updatedQuote, error: finalError } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', id)
        .eq('craftsman_id', craftsmanId)
        .single();
      
      if (finalError) throw finalError;
      
      // Get materials for this quote
      const { data: updatedMaterials, error: materialsError } = await supabase
        .from('quote_materials')
        .select('*')
        .eq('quote_id', id);
      
      if (materialsError) throw materialsError;
      updatedQuote.materials = updatedMaterials || [];
      
      return Response.json(updatedQuote);
    }
    
    return Response.json(data);
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
