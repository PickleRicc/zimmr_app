// API route for operations on a single invoice (/api/invoices/[id])
// Supports GET, PUT, DELETE

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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

// Extract id param from Next.js request (last segment)
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
    
    // Get invoice data
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .eq('craftsman_id', craftsmanId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error; // not found
    if (!invoice) return Response.json(null);
    
    // Get materials for this invoice
    if (includeMaterials) {
      const { data: materials, error: materialsError } = await supabase
        .from('invoice_materials')
        .select('*')
        .eq('invoice_id', id);
      
      if (materialsError) throw materialsError;
      invoice.materials = materials || [];
    }
    
    return Response.json(invoice);
  } catch (err) {
    console.error('/api/invoices/[id] GET error', err.message);
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
    delete body.craftsman_id; // never allow overriding ownership
    
    const materials = body.materials || [];
    delete body.materials; // Remove materials from invoice body
    
    // Calculate total materials price
    let totalMaterialsPrice = 0;
    materials.forEach(material => {
      totalMaterialsPrice += (parseFloat(material.quantity) || 0) * (parseFloat(material.unit_price) || 0);
    });
    
    // Add total materials price to the body
    body.total_materials_price = totalMaterialsPrice.toFixed(2);
    
    // Update the invoice
    const { data: invoiceData, error: invoiceError } = await supabase
      .from('invoices')
      .update(body)
      .eq('id', id)
      .eq('craftsman_id', craftsmanId)
      .select()
      .single();
    
    if (invoiceError) throw invoiceError;
    
    // Handle materials updates
    if (materials && materials.length > 0) {
      // First delete existing materials
      const { error: deleteError } = await supabase
        .from('invoice_materials')
        .delete()
        .eq('invoice_id', id);
      
      if (deleteError) throw deleteError;
      
      // Then insert new materials
      const materialsToInsert = materials.map(material => ({
        invoice_id: id,
        material_id: material.material_id,
        quantity: parseFloat(material.quantity) || 0,
        unit_price: parseFloat(material.unit_price) || 0,
        name: material.name || 'Unnamed Material',
        unit: material.unit || 'Stück'
      }));
      
      const { error: materialsError } = await supabase
        .from('invoice_materials')
        .insert(materialsToInsert);
      
      if (materialsError) throw materialsError;
    } else {
      // No materials, just delete any existing ones
      await supabase
        .from('invoice_materials')
        .delete()
        .eq('invoice_id', id);
    }
    
    // Get the updated invoice with materials
    const { data: updatedInvoice, error: finalError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .eq('craftsman_id', craftsmanId)
      .single();
    
    if (finalError) throw finalError;
    
    // Get materials for this invoice
    const { data: updatedMaterials, error: materialsError } = await supabase
      .from('invoice_materials')
      .select('*')
      .eq('invoice_id', id);
    
    if (materialsError) throw materialsError;
    updatedInvoice.materials = updatedMaterials || [];
    
    return Response.json(updatedInvoice);
  } catch (err) {
    console.error('/api/invoices/[id] PUT error', err.message);
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
      .from('invoices')
      .delete()
      .eq('id', id)
      .eq('craftsman_id', craftsmanId);
    if (error) throw error;
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error('/api/invoices/[id] DELETE error', err.message);
    return new Response(err.message || 'Server error', { status: 500 });
  }
}
