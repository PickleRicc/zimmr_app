// API route for creating and listing invoices for the logged-in craftsman
// GET    /api/invoices            – list all invoices (optionally filter by ?status=)
// POST   /api/invoices            – create new invoice
// NOTE: Detail operations (GET/PUT/DELETE) live in /api/invoices/[id]/route.js

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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

// ---------- READ COLLECTION ----------
export async function GET(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return new Response('Unauthorized', { status: 401 });

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
    if (error) throw error;
    return Response.json(data ?? []);
  } catch (err) {
    console.error('/api/invoices GET error', err.message);
    return new Response(err.message || 'Server error', { status: 500 });
  }
}

// ---------- CREATE ----------
export async function POST(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return new Response('Unauthorized', { status: 401 });

    const body = await req.json();
    const craftsmanId = await getOrCreateCraftsmanId(user);
    const materials = body.materials || [];
    
    // Calculate total materials price
    let totalMaterialsPrice = 0;
    materials.forEach(material => {
      totalMaterialsPrice += (parseFloat(material.quantity) || 0) * (parseFloat(material.unit_price) || 0);
    });
    
    // Remove materials from invoice body
    const { materials: materialsList, ...invoiceData } = body;
    
    // Prepare data for insertion
    const insertBody = camelToSnake({ 
      ...invoiceData, 
      craftsman_id: craftsmanId,
      total_materials_price: totalMaterialsPrice.toFixed(2),
      // Ensure numeric values are properly formatted
      amount: parseFloat(body.amount || 0).toFixed(2),
      tax_amount: parseFloat(body.tax_amount || 0).toFixed(2),
      total_amount: parseFloat(body.total_amount || 0).toFixed(2)
    });

    const { data: invoice, error } = await supabase
      .from('invoices')
      .insert(insertBody)
      .select()
      .single();
      
    if (error) throw error;
    
    // Insert materials if any
    if (materials.length > 0) {
      console.log(`Inserting ${materials.length} materials for invoice ID ${invoice.id}`);
      
      // Insert materials for this invoice
      for (const material of materials) {
        // Exclude any ID fields sent from the client
        const { id, ...materialWithoutId } = material;
        
        // Prepare insert data
        const materialInsert = {
          invoice_id: invoice.id,
          material_id: material.material_id,
          quantity: parseFloat(material.quantity) || 1,
          unit_price: parseFloat(material.unit_price) || 0,
          name: material.name || 'Unnamed Material', // Required field
          unit: material.unit || 'Stück' // Required field with default value
        };
        
        console.log('Inserting material:', materialInsert);
        
        const { error: materialError } = await supabase
          .from('invoice_materials')
          .insert([materialInsert]);
        
        if (materialError) {
          console.error('Error inserting material:', materialError);
          throw materialError;
        }
      }
    }
    
    // Return the created invoice
    return Response.json({ 
      message: 'Invoice created successfully',
      invoice: invoice 
    }, { status: 201 });
  } catch (err) {
    console.error('/api/invoices POST error', err.message);
    return new Response(err.message || 'Server error', { status: 500 });
  }
}
