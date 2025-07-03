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

    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .eq('craftsman_id', craftsmanId)
      .single();
    if (error && error.code !== 'PGRST116') throw error; // not found
    return Response.json(data ?? null);
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

    const { data, error } = await supabase
      .from('invoices')
      .update(body)
      .eq('id', id)
      .eq('craftsman_id', craftsmanId)
      .select()
      .single();
    if (error) throw error;
    return Response.json(data);
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
