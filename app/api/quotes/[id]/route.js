// API route for operations on a single quote (/api/quotes/[id])
// Supports GET, PUT, DELETE

import { NextResponse } from 'next/server';
import { 
  createSupabaseClient, 
  getUserFromRequest, 
  getOrCreateCraftsmanId,
  handleApiError,
  handleApiSuccess
} from '../../../../lib/api-utils';

// Create a standardized Supabase client for this route
const ROUTE_NAME = 'Quotes Detail API';
const supabase = createSupabaseClient(ROUTE_NAME);

// Extract id param from Next.js request
const getId = (req) => req.nextUrl.pathname.split('/').pop();

// ---------- READ ----------
export async function GET(req) {
  try {
    const user = await getUserFromRequest(req, supabase, ROUTE_NAME);
    if (!user) return handleApiError({ message: 'Unauthorized' }, 'Unauthorized', 401, ROUTE_NAME);
    
    const craftsmanId = await getOrCreateCraftsmanId(user, supabase, ROUTE_NAME);
    if (!craftsmanId) {
      return handleApiError(
        { message: 'Craftsman profile not found' },
        'Craftsman profile not found',
        404,
        ROUTE_NAME
      );
    }
    
    const id = getId(req);
    const { searchParams } = new URL(req.url);
    const includeMaterials = searchParams.get('materials') !== 'false';

    // Get quote data
    const { data: quote, error } = await supabase
      .from('quotes')
      .select('*')
      .eq('id', id)
      .eq('craftsman_id', craftsmanId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') { // not found
        console.log(`${ROUTE_NAME} - Quote not found: ${id}`);
        return handleApiError(
          { message: 'Quote not found' },
          'Quote not found',
          404,
          ROUTE_NAME
        );
      }
      
      console.error(`${ROUTE_NAME} - Error fetching quote:`, error);
      return handleApiError(error, 'Failed to retrieve quote', 500, ROUTE_NAME);
    }
    
    if (!quote) {
      return handleApiError(
        { message: 'Quote not found' },
        'Quote not found',
        404,
        ROUTE_NAME
      );
    }
    
    // Log information about materials from JSONB field
    console.log(`${ROUTE_NAME} - Using materials from JSONB field for quote:`, id);
    if (!quote.materials) {
      console.log(`${ROUTE_NAME} - No materials found in JSONB field, initializing empty array`);
      quote.materials = [];
    } else {
      console.log(`${ROUTE_NAME} - Found materials in JSONB field:`, 
        Array.isArray(quote.materials) ? quote.materials.length : 'not an array');
    }
    
    return handleApiSuccess(quote, `Quote retrieved successfully`);
  } catch (err) {
    console.error(`${ROUTE_NAME} - GET error:`, err);
    return handleApiError(err, 'Server error', 500, ROUTE_NAME);
  }
}

// ---------- UPDATE ----------
export async function PUT(req) {
  try {
    const user = await getUserFromRequest(req, supabase, ROUTE_NAME);
    if (!user) return handleApiError({ message: 'Unauthorized' }, 'Unauthorized', 401, ROUTE_NAME);
    
    const craftsmanId = await getOrCreateCraftsmanId(user, supabase, ROUTE_NAME);
    if (!craftsmanId) {
      return handleApiError(
        { message: 'Craftsman profile not found' },
        'Craftsman profile not found',
        404,
        ROUTE_NAME
      );
    }
    
    const id = getId(req);
    const body = await req.json();
    delete body.craftsman_id; // Ensure craftsman_id can't be modified
    
    const materials = body.materials || [];
    
    // Calculate total materials price
    let totalMaterialsPrice = 0;
    materials.forEach(material => {
      totalMaterialsPrice += (parseFloat(material.quantity) || 0) * (parseFloat(material.unit_price) || 0);
    });
    
    // Prepare update data with materials in JSONB field
    const updateData = {
      ...body,
      materials: materials, // Store materials directly in JSONB field
      total_materials_price: totalMaterialsPrice.toFixed(2)
    };
    
    console.log(`${ROUTE_NAME} - Updating quote ${id} with ${materials.length} materials directly in JSONB field`);
    
    // Update the quote with materials in JSONB
    const { data: quoteData, error: quoteError } = await supabase
      .from('quotes')
      .update(updateData)
      .eq('id', id)
      .eq('craftsman_id', craftsmanId)
      .select()
      .single();
    
    if (quoteError) {
      console.error(`${ROUTE_NAME} - Error updating quote with materials in JSONB:`, quoteError);
      return handleApiError(quoteError, 'Failed to update quote', 500, ROUTE_NAME);
    }
    
    console.log(`${ROUTE_NAME} - Successfully updated quote with materials in JSONB field`);
    
    // Ensure materials field is an array in the updated quote
    if (!quoteData.materials) {
      quoteData.materials = [];
      console.log(`${ROUTE_NAME} - No materials found in updated quote JSONB, using empty array`);
    } else {
      console.log(`${ROUTE_NAME} - Found ${Array.isArray(quoteData.materials) ? quoteData.materials.length : 0} materials in updated quote JSONB`);
    }
    
    return handleApiSuccess(quoteData, 'Quote updated successfully');
  } catch (err) {
    console.error(`${ROUTE_NAME} - PUT error:`, err);
    return handleApiError(err, 'Server error', 500, ROUTE_NAME);
  }
}

// ---------- DELETE ----------
export async function DELETE(req) {
  try {
    const user = await getUserFromRequest(req, supabase, ROUTE_NAME);
    if (!user) return handleApiError({ message: 'Unauthorized' }, 'Unauthorized', 401, ROUTE_NAME);
    
    const craftsmanId = await getOrCreateCraftsmanId(user, supabase, ROUTE_NAME);
    if (!craftsmanId) {
      return handleApiError(
        { message: 'Craftsman profile not found' },
        'Craftsman profile not found',
        404,
        ROUTE_NAME
      );
    }
    
    const id = getId(req);
    
    // First verify the quote exists and belongs to this craftsman
    const { data: quote, error: findError } = await supabase
      .from('quotes')
      .select('id, title, customer_name')
      .eq('id', id)
      .eq('craftsman_id', craftsmanId)
      .single();
      
    if (findError) {
      if (findError.code === 'PGRST116') { // not found
        console.log(`${ROUTE_NAME} - Quote not found for deletion: ${id}`);
        return handleApiError(
          { message: 'Quote not found' },
          'Quote not found',
          404,
          ROUTE_NAME
        );
      }
      
      console.error(`${ROUTE_NAME} - Error finding quote for deletion:`, findError);
      return handleApiError(findError, 'Failed to verify quote ownership', 500, ROUTE_NAME);
    }
    
    if (!quote) {
      return handleApiError(
        { message: 'Quote not found' },
        'Quote not found',
        404,
        ROUTE_NAME
      );
    }
    
    console.log(`${ROUTE_NAME} - Deleting quote: ${id}`);

    const { error: deleteError } = await supabase
      .from('quotes')
      .delete()
      .eq('id', id)
      .eq('craftsman_id', craftsmanId);
      
    if (deleteError) {
      console.error(`${ROUTE_NAME} - Error deleting quote:`, deleteError);
      return handleApiError(deleteError, 'Failed to delete quote', 500, ROUTE_NAME);
    }
    
    // Include information about what was deleted in the success response
    const customerName = quote.customer_name || 'customer';
    const quoteTitle = quote.title || `Quote #${id}`;
    const successMessage = `Quote ${quoteTitle} for ${customerName} deleted successfully`;
    
    return handleApiSuccess(null, successMessage);
  } catch (err) {
    console.error(`${ROUTE_NAME} - DELETE error:`, err);
    return handleApiError(err, 'Server error', 500, ROUTE_NAME);
  }
}
