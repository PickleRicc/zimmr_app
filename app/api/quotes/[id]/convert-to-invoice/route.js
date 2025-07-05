// API endpoint to convert a quote to an invoice
// POST /api/quotes/[id]/convert-to-invoice

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
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

// Extract id param from Next.js request
const getId = (req) => req.nextUrl.pathname.split('/').slice(-2)[0];

// ---------- CONVERSION ENDPOINT ----------
export async function POST(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return new Response('Unauthorized', { status: 401 });
    const craftsmanId = await getOrCreateCraftsmanId(user);
    const quoteId = getId(req);

    // Step 1: Get the quote data to convert
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('*')
      .eq('id', quoteId)
      .eq('craftsman_id', craftsmanId)
      .single();

    if (quoteError) {
      if (quoteError.code === 'PGRST116') {
        return new Response('Quote not found', { status: 404 });
      }
      throw quoteError;
    }

    // Step 2: Get associated materials
    const { data: quoteMaterials, error: materialsError } = await supabase
      .from('quote_materials')
      .select('*')
      .eq('quote_id', quoteId);

    if (materialsError) throw materialsError;

    // Step 3: Create new invoice from quote data
    const invoiceData = {
      ...quote,
      type: 'invoice',
      status: 'draft',
      quote_id: quoteId, // Reference back to original quote
    };

    // Remove fields that shouldn't be copied
    delete invoiceData.id; // Will get a new ID
    delete invoiceData.created_at; // Will get current timestamp
    delete invoiceData.updated_at; // Will get current timestamp

    const { data: newInvoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert(invoiceData)
      .select()
      .single();

    if (invoiceError) throw invoiceError;

    // Step 4: Copy materials to invoice_materials if any exist
    if (quoteMaterials && quoteMaterials.length > 0) {
      const invoiceMaterials = quoteMaterials.map(material => ({
        invoice_id: newInvoice.id,
        material_id: material.material_id,
        quantity: material.quantity,
        unit_price: material.unit_price,
        name: material.name,
        unit: material.unit
      }));

      const { error: insertMaterialsError } = await supabase
        .from('invoice_materials')
        .insert(invoiceMaterials);

      if (insertMaterialsError) throw insertMaterialsError;
    }

    // Step 5: Update the original quote to mark it as converted
    const { error: updateQuoteError } = await supabase
      .from('quotes')
      .update({ status: 'converted', invoice_id: newInvoice.id })
      .eq('id', quoteId)
      .eq('craftsman_id', craftsmanId);

    if (updateQuoteError) throw updateQuoteError;

    // Return the newly created invoice
    return Response.json(newInvoice);
  } catch (err) {
    console.error('/api/quotes/[id]/convert-to-invoice POST error', err.message);
    return new Response(err.message || 'Server error', { status: 500 });
  }
}
