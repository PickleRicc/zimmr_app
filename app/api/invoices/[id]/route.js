// API route for operations on a single invoice (/api/invoices/[id])
// Supports GET, PUT, DELETE

import { NextResponse } from 'next/server';
import { 
  createSupabaseClient, 
  getUserFromRequest, 
  getOrCreateCraftsmanId,
  handleApiError,
  handleApiSuccess,
  camelToSnake
} from '../../../../lib/api-utils';

// Initialize Supabase client using shared utility
const ROUTE_NAME = 'Invoices Detail API';
const supabase = createSupabaseClient(ROUTE_NAME);

// ---------- HELPERS ----------
// Using shared utilities from api-utils.js for user authentication and craftsman ID retrieval

// Extract id param from Next.js request (last segment)
const getId = (req) => req.nextUrl.pathname.split('/').pop();

// ---------- READ ----------
export async function GET(req) {
  console.log(`${ROUTE_NAME} - GET request received`);
  try {
    // Authenticate request using shared utility
    const user = await getUserFromRequest(req, supabase, ROUTE_NAME);
    if (!user) {
      return handleApiError('Unauthorized', 401, ROUTE_NAME);
    }

    // Get craftsman ID using shared utility
    const craftsmanId = await getOrCreateCraftsmanId(user, supabase, ROUTE_NAME);
    if (!craftsmanId) {
      return handleApiError('Craftsman profile not found', 404, ROUTE_NAME);
    }

    const id = getId(req);
    const { searchParams } = new URL(req.url);
    const includeMaterials = searchParams.get('materials') !== 'false';
    
    console.log(`${ROUTE_NAME} - Fetching invoice ID: ${id} for craftsman: ${craftsmanId}`);
    
    // Get invoice data
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .eq('craftsman_id', craftsmanId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error(`${ROUTE_NAME} - Error fetching invoice:`, error);
      return handleApiError(`Error fetching invoice: ${error.message}`, 500, ROUTE_NAME);
    }
    
    if (!invoice) {
      return handleApiError('Invoice not found', 404, ROUTE_NAME);
    }
    
    // Log information about materials from JSONB
    console.log(`${ROUTE_NAME} - Processing materials from JSONB field for invoice: ${invoice.id}`);
    if (!invoice.materials) {
      console.log(`${ROUTE_NAME} - No materials found in JSONB field, initializing empty array`);
      invoice.materials = [];
    } else {
      console.log(`${ROUTE_NAME} - Found ${Array.isArray(invoice.materials) ? invoice.materials.length : 0} materials in JSONB field`);
    }

    return handleApiSuccess(invoice, 'Invoice retrieved successfully');
  } catch (err) {
    console.error(`${ROUTE_NAME} - GET error:`, err.message);
    return handleApiError('Server error processing your request', 500, ROUTE_NAME);
  }
}

// Function removed - Using shared utilities from api-utils.js and inline processing

// ---------- UPDATE ----------
export async function PUT(req) {
  console.log(`${ROUTE_NAME} - PUT request received`);
  try {
    // Authenticate request using shared utility
    const user = await getUserFromRequest(req, supabase, ROUTE_NAME);
    if (!user) {
      return handleApiError('Unauthorized', 401, ROUTE_NAME);
    }

    // Get craftsman ID using shared utility
    const craftsmanId = await getOrCreateCraftsmanId(user, supabase, ROUTE_NAME);
    if (!craftsmanId) {
      return handleApiError('Craftsman profile not found', 404, ROUTE_NAME);
    }

    const id = getId(req);
    const body = await req.json();
    delete body.craftsman_id; // never allow overriding ownership

    const materials = body.materials || [];
    console.log(`${ROUTE_NAME} - Updating invoice ID: ${id} with ${materials.length} materials items`);

    // Calculate total materials price
    let totalMaterialsPrice = 0;
    materials.forEach(material => {
      totalMaterialsPrice += (parseFloat(material.quantity) || 0) * (parseFloat(material.unit_price) || 0);
    });
    
    // Add materials and total materials price to the body for direct JSONB storage
    const updateBody = {
      ...body,
      materials: materials, // Store materials directly as JSONB
      total_materials_price: totalMaterialsPrice.toFixed(2)
    };
    
    // Update Invoice with materials in the JSONB field
    const { data: invoiceData, error: invoiceError } = await supabase
      .from('invoices')
      .update(updateBody)
      .eq('id', id)
      .eq('craftsman_id', craftsmanId)
      .select()
      .single();
    
    if (invoiceError) {
      console.error(`${ROUTE_NAME} - Error updating invoice:`, invoiceError);
      return handleApiError(`Error updating invoice: ${invoiceError.message}`, 500, ROUTE_NAME);
    }
    
    console.log(`${ROUTE_NAME} - Successfully updated invoice ID: ${id}`);
    
    // Get the updated invoice with materials already in JSONB field
    const { data: updatedInvoice, error: finalError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .eq('craftsman_id', craftsmanId)
      .single();
    
    if (finalError) {
      console.error(`${ROUTE_NAME} - Error retrieving updated invoice:`, finalError);
      return handleApiError(`Error retrieving updated invoice: ${finalError.message}`, 500, ROUTE_NAME);
    }
    
    // Ensure materials field is an array
    if (!updatedInvoice.materials) {
      updatedInvoice.materials = [];
      console.log(`${ROUTE_NAME} - No materials found in updated invoice, using empty array`);
    } else {
      console.log(`${ROUTE_NAME} - Found ${Array.isArray(updatedInvoice.materials) ? updatedInvoice.materials.length : 0} materials in updated invoice`);
    }
    
    return handleApiSuccess(updatedInvoice, 'Invoice updated successfully');
  } catch (err) {
    console.error(`${ROUTE_NAME} - PUT error:`, err.message);
    return handleApiError('Server error processing your request', 500, ROUTE_NAME);
  }
}

// ---------- DELETE ----------
export async function DELETE(req) {
  console.log(`${ROUTE_NAME} - DELETE request received`);
  try {
    // Authenticate request using shared utility
    const user = await getUserFromRequest(req, supabase, ROUTE_NAME);
    if (!user) {
      return handleApiError('Unauthorized', 401, ROUTE_NAME);
    }

    // Get craftsman ID using shared utility
    const craftsmanId = await getOrCreateCraftsmanId(user, supabase, ROUTE_NAME);
    if (!craftsmanId) {
      return handleApiError('Craftsman profile not found', 404, ROUTE_NAME);
    }
    
    const id = getId(req);
    console.log(`${ROUTE_NAME} - Deleting invoice ID: ${id} for craftsman: ${craftsmanId}`);

    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', id)
      .eq('craftsman_id', craftsmanId);
      
    if (error) {
      console.error(`${ROUTE_NAME} - Error deleting invoice:`, error);
      return handleApiError(`Error deleting invoice: ${error.message}`, 500, ROUTE_NAME);
    }
    
    console.log(`${ROUTE_NAME} - Successfully deleted invoice ID: ${id}`);
    return handleApiSuccess(null, 'Invoice deleted successfully');
  } catch (err) {
    console.error(`${ROUTE_NAME} - DELETE error:`, err.message);
    return handleApiError('Server error processing your request', 500, ROUTE_NAME);
  }
}
