// API route for fetching and creating time entries for the logged-in craftsman
// GET    /api/time-entries      – list entries for current craftsman
// POST   /api/time-entries      – create a new entry

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  // Prefer service role key in server context, else fall back to anon key in dev
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
    const { data, error } = await supabase
      .from('time_entries')
      .select('*')
      .eq('craftsman_id', craftsmanId)
      .order('start_time', { ascending: false });
    if (error) throw error;
    return Response.json(data);
  } catch (err) {
    console.error('/api/time-entries GET error', err);
    return new Response(err.message || 'Server error', { status: 500 });
  }
}

export async function POST(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return new Response('Unauthorized', { status: 401 });
    const craftsmanId = await getOrCreateCraftsmanId(user);

    const body = await req.json();

    // Extract fields from request
    let {
      appointment_id,
      customer_id,
      description,
      start_time,
      end_time,
      duration_minutes,
      is_billable,
      hourly_rate,
      notes
    } = body;
    
    // Convert empty strings to null for integer and timestamp fields
    appointment_id = appointment_id === '' ? null : appointment_id;
    customer_id = customer_id === '' ? null : customer_id;
    duration_minutes = duration_minutes === '' ? null : duration_minutes;
    hourly_rate = hourly_rate === '' ? null : hourly_rate;
    
    // Handle timestamps - empty strings must be null
    end_time = end_time === '' ? null : end_time;

    if (!start_time) {
      return new Response('start_time is required', { status: 400 });
    }

    // Enforce is_billable = true when customer_id present
    // Note: using "billable" as the field name if "is_billable" causes schema cache issues
    const finalIsBillable = customer_id ? true : is_billable ?? true;

    // Auto-calculate duration if both timestamps present and duration missing
    let finalDuration = duration_minutes;
    if ((!finalDuration || finalDuration === '') && start_time && end_time) {
      const startMs = new Date(start_time).getTime();
      const endMs = new Date(end_time).getTime();
      const diffMs = endMs - startMs;
      finalDuration = Math.round(diffMs / 60000); // minutes
    }

    // Try both field names to handle potential schema inconsistency
    const insertPayload = {
      craftsman_id: craftsmanId,
      appointment_id,
      customer_id,
      description,
      start_time,
      end_time,
      duration_minutes: finalDuration,
      // Try both field names (one of them should work)
      is_billable: finalIsBillable,
      billable: finalIsBillable, // Use this if is_billable fails
      hourly_rate,
      notes
    };

    const { data, error } = await supabase
      .from('time_entries')
      .insert(insertPayload)
      .select()
      .single();
    if (error) throw error;
    return Response.json(data, { status: 201 });
  } catch (err) {
    console.error('/api/time-entries POST error', err);
    return new Response(err.message || 'Server error', { status: 500 });
  }
}
