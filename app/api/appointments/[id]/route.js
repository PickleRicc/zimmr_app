// Individual appointment resource CRUD at /api/appointments/[id]
// Supports GET, PUT, DELETE using same logic as generic route but path param instead of query.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

async function getUser(req) {
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
  const { data: row } = await supabase.from('craftsmen').select('id').eq('user_id', user.id).single();
  if (row) return row.id;
  const { data: created } = await supabase
    .from('craftsmen')
    .insert({ user_id: user.id, name: user.user_metadata?.full_name || user.email })
    .select('id')
    .single();
  return created.id;
}

export async function GET(req, { params }) {
  try {
    const user = await getUser(req);
    if (!user) return new Response('Unauthorized', { status: 401 });
    const craftsmanId = await getOrCreateCraftsmanId(user);
    const { id } = await params;
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', id)
      .eq('craftsman_id', craftsmanId)
      .single();
    if (error) throw error;
    if (!data) return new Response('Not found', { status: 404 });
    return Response.json(data);
  } catch (err) {
    console.error('[id] GET error', err.message);
    return new Response(err.message || 'Server error', { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const user = await getUser(req);
    if (!user) return new Response('Unauthorized', { status: 401 });
    const craftsmanId = await getOrCreateCraftsmanId(user);
    const { id } = await params;
    const body = await req.json();
    delete body.craftsman_id; // prevent update
    if ('is_private' in body) {
      body.private = body.is_private;
      delete body.is_private;
    }
    const { data, error } = await supabase
      .from('appointments')
      .update(body)
      .eq('id', id)
      .eq('craftsman_id', craftsmanId)
      .select()
      .single();
    if (error) throw error;
    if (!data) return new Response('Not found', { status: 404 });
    return Response.json(data);
  } catch (err) {
    console.error('[id] PUT error', err.message);
    return new Response(err.message || 'Server error', { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const user = await getUser(req);
    if (!user) return new Response('Unauthorized', { status: 401 });
    const craftsmanId = await getOrCreateCraftsmanId(user);
    const { id } = await params;
    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', id)
      .eq('craftsman_id', craftsmanId);
    if (error) throw error;
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error('[id] DELETE error', err.message);
    return new Response(err.message || 'Server error', { status: 500 });
  }
}
