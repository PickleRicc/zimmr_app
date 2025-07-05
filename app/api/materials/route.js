// API route for materials CRUD using Supabase
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for server-side use
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

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id) {
      // Fetch single material by id
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .eq('id', id)
        .or(`craftsman_id.eq.${craftsmanId},is_default.eq.true`)
        .single();

      if (error) {
        console.error('Material fetch error:', error.message);
        return new Response('Not found', { status: 404 });
      }

      return Response.json(data);
    }

    // List materials - combines default materials and craftsman's custom materials
    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .or(`craftsman_id.eq.${craftsmanId},is_default.eq.true`)
      .order('name');

    if (error) {
      console.error('Materials list error:', error.message);
      throw error;
    }

    return Response.json(data || []);
  } catch (err) {
    console.error('GET /api/materials error', err.message);
    return new Response(err.message || 'Server error', { status: 500 });
  }
}

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

    const body = await req.json();

    // Ensure required fields
    if (!body.name || !body.unit) {
      return new Response('Name and unit are required', { status: 400 });
    }

    // Set the craftsman ID to the current user's craftsman
    const payload = {
      ...body,
      craftsman_id: craftsmanId,
      is_default: false, // Custom materials are never default
      price: parseFloat(body.price) || 0 // Ensure price is a number
    };

    const { data, error } = await supabase
      .from('materials')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Material creation error:', error.message);
      throw error;
    }

    return Response.json(data, { status: 201 });
  } catch (err) {
    console.error('POST /api/materials error', err.message);
    return new Response(err.message || 'Server error', { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const craftsmanId = await getCraftsmanId(user);
    if (!craftsmanId) {
      return new Response('Craftsman not found for user', { status: 404 });
    }

    const body = await req.json();
    if (!body.id) {
      return new Response('ID is required', { status: 400 });
    }

    // Check if this is a default material that needs to be cloned
    const { data: existingMaterial, error: fetchError } = await supabase
      .from('materials')
      .select('*')
      .eq('id', body.id)
      .single();

    if (fetchError) {
      console.error('Material fetch error:', fetchError.message);
      return new Response('Material not found', { status: 404 });
    }

    if (existingMaterial.is_default) {
      // For default materials, create a new custom material based on it
      // This creates a personalized copy instead of modifying the default
      const customPayload = {
        name: body.name || existingMaterial.name,
        unit: body.unit || existingMaterial.unit,
        price: parseFloat(body.price) || existingMaterial.price,
        craftsman_id: craftsmanId,
        is_default: false
      };

      const { data: customMaterial, error: insertError } = await supabase
        .from('materials')
        .insert(customPayload)
        .select()
        .single();

      if (insertError) {
        console.error('Material clone error:', insertError.message);
        throw insertError;
      }

      return Response.json(customMaterial);
    } else {
      // For custom materials, update directly
      const { id, ...updatePayload } = body;
      
      // Ensure price is a number
      if (updatePayload.price) {
        updatePayload.price = parseFloat(updatePayload.price);
      }
      
      // Prevent changing ownership or default status
      delete updatePayload.craftsman_id;
      delete updatePayload.is_default;

      const { data, error } = await supabase
        .from('materials')
        .update(updatePayload)
        .eq('id', id)
        .eq('craftsman_id', craftsmanId) // Ensure it belongs to this craftsman
        .select()
        .single();

      if (error) {
        console.error('Material update error:', error.message);
        throw error;
      }

      return Response.json(data);
    }
  } catch (err) {
    console.error('PUT /api/materials error', err.message);
    return new Response(err.message || 'Server error', { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const craftsmanId = await getCraftsmanId(user);
    if (!craftsmanId) {
      return new Response('Craftsman not found for user', { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return new Response('ID query parameter is required', { status: 400 });
    }

    // First check if this is a default material
    const { data, error: checkError } = await supabase
      .from('materials')
      .select('is_default')
      .eq('id', id)
      .single();

    if (checkError) {
      console.error('Material check error:', checkError.message);
      return new Response('Material not found', { status: 404 });
    }

    if (data.is_default) {
      return new Response('Cannot delete default materials', { status: 403 });
    }

    // Delete only if it belongs to this craftsman and is not a default material
    const { error } = await supabase
      .from('materials')
      .delete()
      .eq('id', id)
      .eq('craftsman_id', craftsmanId)
      .eq('is_default', false);

    if (error) {
      console.error('Material deletion error:', error.message);
      throw error;
    }

    return new Response(null, { status: 204 });
  } catch (err) {
    console.error('DELETE /api/materials error', err.message);
    return new Response(err.message || 'Server error', { status: 500 });
  }
}
