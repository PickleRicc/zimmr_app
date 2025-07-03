// API route for fetching and updating craftsman profile for the logged-in user
// GET    /api/profile        – fetch profile (craftsmen row)
// PUT    /api/profile        – update profile fields

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
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
  const { data: row } = await supabase.from('craftsmen').select('id').eq('user_id', user.id).single();
  if (row) return row.id;
  const { data: created, error: createErr } = await supabase
    .from('craftsmen')
    .insert({ user_id: user.id, name: user.user_metadata?.full_name || user.email })
    .select('id')
    .single();
  if (createErr) throw createErr;
  return created.id;
}

export async function GET(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return new Response('Unauthorized', { status: 401 });
    const craftsmanId = await getOrCreateCraftsmanId(user);
    const { data, error } = await supabase.from('craftsmen').select('*').eq('id', craftsmanId).single();
    if (error) throw error;
    return Response.json(data);
  } catch (err) {
    console.error('/api/profile GET error', err.message);
    return new Response(err.message || 'Server error', { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return new Response('Unauthorized', { status: 401 });
    const craftsmanId = await getOrCreateCraftsmanId(user);
    const body = await req.json();
    delete body.id; // prevent changing id
    const { data, error } = await supabase
      .from('craftsmen')
      .update(body)
      .eq('id', craftsmanId)
      .select()
      .single();
    if (error) throw error;
    return Response.json(data);
  } catch (err) {
    console.error('/api/profile PUT error', err.message);
    return new Response(err.message || 'Server error', { status: 500 });
  }
}
