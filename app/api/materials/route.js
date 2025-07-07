// API route for materials CRUD using Supabase
import { NextResponse } from 'next/server';
import {
  createSupabaseClient,
  getUserFromRequest,
  getOrCreateCraftsmanId,
  handleApiError,
  handleApiSuccess,
  camelToSnake as convertKeysToSnakeCase
} from '../../../lib/api-utils';

// Define route name for consistent logging
const ROUTE_NAME = 'Materials API';

// Initialize Supabase client using shared utility with route name for better logging
const supabase = createSupabaseClient(ROUTE_NAME);

console.log(`${ROUTE_NAME} - Using shared Supabase client`);

export async function GET(req) {
  console.log(`${ROUTE_NAME} - GET request received`);
  try {
    // Authenticate request
    const user = await getUserFromRequest(req, supabase, ROUTE_NAME);
    if (!user) {
      return handleApiError('Unauthorized', 401, ROUTE_NAME);
    }

    // Get craftsman ID using shared utility
    const craftsmanId = await getOrCreateCraftsmanId(user, supabase, ROUTE_NAME);
    if (!craftsmanId) {
      return handleApiError('Craftsman profile not found', 404, ROUTE_NAME);
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
        console.error(`${ROUTE_NAME} - Material fetch error:`, error.message);
        return handleApiError('Material not found', 404, ROUTE_NAME);
      }

      return handleApiSuccess(data, 'Material retrieved successfully', 200, ROUTE_NAME);
    }

    // List materials - combines default materials and craftsman's custom materials
    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .or(`craftsman_id.eq.${craftsmanId},is_default.eq.true`)
      .order('name');

    if (error) {
      console.error(`${ROUTE_NAME} - Materials list error:`, error.message);
      return handleApiError(`Error fetching materials: ${error.message}`, 500, ROUTE_NAME);
    }

    return handleApiSuccess(data || [], 'Materials retrieved successfully', 200, ROUTE_NAME);
  } catch (err) {
    console.error(`${ROUTE_NAME} - GET error:`, err.message);
    return handleApiError('Server error processing your request', 500, ROUTE_NAME);
  }
}

export async function POST(req) {
  console.log(`${ROUTE_NAME} - POST request received`);
  try {
    // Authenticate request
    const user = await getUserFromRequest(req, supabase, ROUTE_NAME);
    if (!user) {
      return handleApiError('Unauthorized', 401, ROUTE_NAME);
    }

    // Get craftsman ID using shared utility
    const craftsmanId = await getOrCreateCraftsmanId(user, supabase, ROUTE_NAME);
    if (!craftsmanId) {
      return handleApiError('Craftsman profile not found', 404, ROUTE_NAME);
    }

    const body = await req.json();

    // Validate required fields
    if (!body.name || !body.unit) {
      return handleApiError('Name and unit are required fields', 400, ROUTE_NAME);
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
      console.error(`${ROUTE_NAME} - Material creation error:`, error.message);
      return handleApiError(`Error creating material: ${error.message}`, 500, ROUTE_NAME);
    }

    return handleApiSuccess(data, 'Material created successfully', 201, ROUTE_NAME);
  } catch (err) {
    console.error(`${ROUTE_NAME} - POST error:`, err.message);
    return handleApiError('Server error processing your request', 500, ROUTE_NAME);
  }
}

export async function PUT(req) {
  console.log(`${ROUTE_NAME} - PUT request received`);
  try {
    // Authenticate request
    const user = await getUserFromRequest(req, supabase, ROUTE_NAME);
    if (!user) {
      return handleApiError('Unauthorized', 401, ROUTE_NAME);
    }

    // Get craftsman ID using shared utility
    const craftsmanId = await getOrCreateCraftsmanId(user, supabase, ROUTE_NAME);
    if (!craftsmanId) {
      return handleApiError('Craftsman profile not found', 404, ROUTE_NAME);
    }

    const body = await req.json();
    if (!body.id) {
      return handleApiError('Material ID is required', 400, ROUTE_NAME);
    }

    // Check if this is a default material that needs to be cloned
    const { data: existingMaterial, error: fetchError } = await supabase
      .from('materials')
      .select('*')
      .eq('id', body.id)
      .single();

    if (fetchError) {
      console.error('Materials API - Material fetch error:', fetchError.message);
      return handleApiError('Material not found', 404);
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
        console.error('Materials API - Material clone error:', insertError.message);
        return handleApiError(`Error creating custom material: ${insertError.message}`, 500);
      }

      return handleApiSuccess(customMaterial, 'Custom material created from default template');
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
        console.error('Materials API - Material update error:', error.message);
        return handleApiError(`Error updating material: ${error.message}`, 500);
      }

      return handleApiSuccess(data, 'Material updated successfully');
    }
  } catch (err) {
    console.error('Materials API - PUT error:', err.message);
    return handleApiError('Server error processing your request', 500);
  }
}

export async function DELETE(req) {
  console.log('Materials API - DELETE request received');
  try {
    // Authenticate request
    const user = await getUserFromRequest(req, supabase, 'Materials API');
    if (!user) {
      return handleApiError('Unauthorized', 401);
    }

    // Get craftsman ID using shared utility
    const craftsmanId = await getOrCreateCraftsmanId(user, supabase, ROUTE_NAME);
    if (!craftsmanId) {
      return handleApiError('Craftsman profile not found', 404);
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return handleApiError('Material ID is required', 400);
    }

    // First check if this is a default material
    const { data, error: checkError } = await supabase
      .from('materials')
      .select('is_default')
      .eq('id', id)
      .single();

    if (checkError) {
      console.error('Materials API - Material check error:', checkError.message);
      return handleApiError('Material not found', 404);
    }

    if (data.is_default) {
      return handleApiError('Cannot delete default materials', 403);
    }

    // Delete only if it belongs to this craftsman and is not a default material
    const { error, count } = await supabase
      .from('materials')
      .delete({ count: 'exact' })
      .eq('id', id)
      .eq('craftsman_id', craftsmanId)
      .eq('is_default', false);

    if (error) {
      console.error('Materials API - Material deletion error:', error.message);
      return handleApiError(`Error deleting material: ${error.message}`, 500);
    }
    
    if (count === 0) {
      return handleApiError('Material not found or does not belong to this craftsman', 404);
    }

    return handleApiSuccess(null, 'Material deleted successfully', 200);
  } catch (err) {
    console.error('Materials API - DELETE error:', err.message);
    return handleApiError('Server error processing your request', 500);
  }
}
