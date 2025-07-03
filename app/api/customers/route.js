// API route for listing customers associated with the logged-in craftsman
// Only GET implemented for now
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: { persistSession: false }
  }
);

export async function GET(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return new Response('Unauthorized', { status: 401 });

    const { searchParams } = new URL(req.url);
    const specificId = searchParams.get('id');

    // Find craftsman uuid for this user
    const { data: craftsmanRow } = await supabase
      .from('craftsmen')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!craftsmanRow) return Response.json([], { status: 200 });

    if (specificId) {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', specificId)
        .eq('craftsman_id', craftsmanRow.id)
        .single();
      if (error && error.code !== 'PGRST116') throw error; // not found returns 404
      return Response.json(data ?? null);
    }

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('craftsman_id', craftsmanRow.id)
      .order('name');

    if (error) throw error;
    return Response.json(data ?? []);
  } catch (err) {
    console.error('/api/customers GET error', err.message);
    return new Response(err.message || 'Server error', { status: 500 });
  }
}

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
  // Try fetch
  const { data: row, error } = await supabase
    .from('craftsmen')
    .select('id')
    .eq('user_id', user.id)
    .single();
  if (row) return row.id;
  // If not found, create it on the fly
  const { data: created, error: createErr } = await supabase
    .from('craftsmen')
    .insert({ user_id: user.id, name: user.user_metadata?.full_name || user.email })
    .select('id')
    .single();
  if (createErr) throw createErr;
  return created.id;
}

// ---------- CREATE ----------
export async function POST(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return new Response('Unauthorized', { status: 401 });

    const body = await req.json();
    // attach craftsman_id of logged-in user
    const craftsmanId = await getOrCreateCraftsmanId(user);
    body.craftsman_id = craftsmanId;

    const { data, error } = await supabase.from('customers').insert(body).select().single();
    if (error) throw error;
    return Response.json(data, { status: 201 });
  } catch (err) {
    console.error('/api/customers POST error', err.message);
    return new Response(err.message || 'Server error', { status: 500 });
  }
}

// ---------- UPDATE ----------
export async function PUT(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return new Response('Unauthorized', { status: 401 });
    const body = await req.json();
    if (!body.id) return new Response('id required', { status: 400 });
    const { id, ...rest } = body;
    delete rest.craftsman_id;
    const { data, error } = await supabase
      .from('customers')
      .update(rest)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return Response.json(data);
  } catch (err) {
    console.error('/api/customers PUT error', err.message);
    return new Response(err.message || 'Server error', { status: 500 });
  }
}

// ---------- DELETE ----------
export async function DELETE(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return new Response('Unauthorized', { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return new Response('id query param required', { status: 400 });

    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) throw error;
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error('/api/customers DELETE error', err.message);
    return new Response(err.message || 'Server error', { status: 500 });
  }
}
