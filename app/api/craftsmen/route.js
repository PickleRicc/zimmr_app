// GET handler returns the craftsman row that matches the logged-in Supabase user.
// Auth via bearer token (Next.js App Router – server component)

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

async function getUser(req) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  const {
    data: { user },
    error
  } = await supabase.auth.getUser(token);
  if (error) {
    console.error('supabase auth error', error.message);
    return null;
  }
  return user;
}

export async function GET(req) {
  const user = await getUser(req);
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { data, error } = await supabase
    .from('craftsmen')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error) {
    console.error('/api/craftsmen GET error', error.message);
    return new Response(error.message, { status: 500 });
  }
  if (!data) return new Response('Not found', { status: 404 });
  return Response.json(data);
}
