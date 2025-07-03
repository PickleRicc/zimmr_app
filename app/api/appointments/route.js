// API route for appointments CRUD using Supabase
// Location: app/api/appointments/route.js (Next.js App Router)
// Each HTTP verb is exported as a function (GET, POST, PUT, DELETE)

import { createClient } from '@supabase/supabase-js';

// Initialise Supabase client for server-side use

// Initialise Supabase client for server-side use
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false
    }
  }
);

// Helper: authenticate request using Bearer token
async function getUserFromRequest(req) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.replace('Bearer ', '')
    : null;

  if (!token) return null;
  const {
    data: { user },
    error
  } = await supabase.auth.getUser(token);
  if (error) {
    console.error('Supabase auth error', error.message);
    return null;
  }
  return user;
}

export async function GET(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    // determine craftsman belonging to current user
    const { data: craftsmanRow, error: craftsmanErr } = await supabase
      .from('craftsmen')
      .select('id')
      .eq('user_id', user.id)
      .single();
    if (craftsmanErr || !craftsmanRow) {
      return new Response('Craftsman not found for user', { status: 404 });
    }
    const craftsmanUuid = craftsmanRow.id;

    if (id) {
      // Fetch single appointment by id (and craftsman check)
      let query = supabase.from('appointments').select('*').eq('id', id).single();
      if (craftsmanId) {
        const uuid = await resolveCraftsmanUuid(craftsmanId);
        if (!uuid) return new Response('Craftsman not found', { status: 404 });
        query = query.eq('craftsman_id', uuid);
      }
      const { data, error } = await query;
      if (error) throw error;
      if (!data) return new Response('Not found', { status: 404 });
      return Response.json(data);
    }

        // List appointments for logged-in craftsman
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('craftsman_id', craftsmanUuid)
      .order('scheduled_at', { ascending: false });
    if (error) throw error;
    return Response.json(data);
  } catch (err) {
    console.error('GET /api/appointments error', err.message);
    return new Response(err.message || 'Server error', { status: 500 });
  }
}

export async function POST(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return new Response('Unauthorized', { status: 401 });

    const body = await req.json();

    // ensure craftsman exists
    const craftsmanId = await (async () => {
      const { data: row } = await supabase.from('craftsmen').select('id').eq('user_id', user.id).single();
      if (row) return row.id;
      const { data: created, error: createErr } = await supabase
        .from('craftsmen')
        .insert({ user_id: user.id, name: user.user_metadata?.full_name || user.email })
        .select('id')
        .single();
      if (createErr) throw createErr;
      return created.id;
    })();

    body.craftsman_id = craftsmanId;
    if ('is_private' in body) {
      body.private = body.is_private;
      delete body.is_private;
    }
    console.log('Creating appointment', body);
    const { data, error } = await supabase.from('appointments').insert(body).select().single();
    if (error) throw error;
    return Response.json(data, { status: 201 });
  } catch (err) {
    console.error('POST /api/appointments error', err.message);
    return new Response(err.message || 'Server error', { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return new Response('Unauthorized', { status: 401 });

    const body = await req.json();
    if (!body.id) return new Response('id required', { status: 400 });

    const { id, ...rest } = body;
        // prevent craftsman_id change explicitly; always ensure belongs to user
    delete rest.craftsman_id;
    const { data, error } = await supabase
      .from('appointments')
      .update(rest)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return Response.json(data);
  } catch (err) {
    console.error('PUT /api/appointments error', err.message);
    return new Response(err.message || 'Server error', { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return new Response('Unauthorized', { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return new Response('id query param required', { status: 400 });

    const { error } = await supabase.from('appointments').delete().eq('id', id);
    if (error) throw error;
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error('DELETE /api/appointments error', err.message);
    return new Response(err.message || 'Server error', { status: 500 });
  }
}
