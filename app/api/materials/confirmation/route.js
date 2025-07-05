// API route for handling material confirmation status
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
  {
    auth: { persistSession: false }
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

// Helper: Get craftsman ID for the current user
async function getCraftsmanId(user) {
  if (!user) return null;
  
  // Try to find existing craftsman
  const { data: craftsman, error } = await supabase
    .from('craftsmen')
    .select('id')
    .eq('user_id', user.id)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching craftsman:', error.message);
    return null;
  }
  
  return craftsman?.id || null;
}

// GET: Check if user has confirmed the materials notice
export async function GET(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const craftsmanId = await getCraftsmanId(user);
    if (!craftsmanId) {
      return new Response('Craftsman not found for user', { status: 404 });
    }

    // Check if confirmation exists
    const { data, error } = await supabase
      .from('materials_confirmations')
      .select('*')
      .eq('craftsman_id', craftsmanId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error checking confirmation:', error.message);
      throw error;
    }

    // Return confirmation status and timestamp if exists
    return Response.json({
      confirmed: !!data,
      confirmed_at: data?.confirmed_at || null
    });
  } catch (err) {
    console.error('GET /api/materials/confirmation error', err.message);
    return new Response(err.message || 'Server error', { status: 500 });
  }
}

// POST: Record user's confirmation of the materials notice
export async function POST(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const craftsmanId = await getCraftsmanId(user);
    if (!craftsmanId) {
      return new Response('Craftsman not found for user', { status: 404 });
    }

    // Insert confirmation record
    const { data, error } = await supabase
      .from('materials_confirmations')
      .upsert({ craftsman_id: craftsmanId })
      .select()
      .single();
    
    if (error) {
      console.error('Error saving confirmation:', error.message);
      throw error;
    }

    return Response.json({
      confirmed: true,
      confirmed_at: data.confirmed_at
    }, { status: 201 });
  } catch (err) {
    console.error('POST /api/materials/confirmation error', err.message);
    return new Response(err.message || 'Server error', { status: 500 });
  }
}
