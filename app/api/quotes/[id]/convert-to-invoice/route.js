// API endpoint to convert a quote to an invoice
// POST /api/quotes/[id]/convert-to-invoice

import { NextResponse } from 'next/server';
import {
  createSupabaseClient,
  getUserFromRequest,
  getOrCreateCraftsmanId,
  handleApiError,
  handleApiSuccess
} from '../../../../../lib/api-utils';

// Define route name for consistent logging
const ROUTE_NAME = 'Quote-to-Invoice API';

// Initialize Supabase client using shared utility
const supabase = createSupabaseClient(ROUTE_NAME);

console.log(`${ROUTE_NAME} - Using shared Supabase client`);

// Extract id param from Next.js dynamic route
const getId = (req) => req.nextUrl.pathname.split('/').slice(-2)[0];

// ---------- CONVERSION ENDPOINT ----------
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
    
    const quoteId = getId(req);
    console.log(`${ROUTE_NAME} - Converting quote ${quoteId} for craftsman ${craftsmanId}`);

    // Step 1: Get the quote data to convert
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('*')
      .eq('id', quoteId)
      .eq('craftsman_id', craftsmanId)
      .single();

    if (quoteError) {
      console.error(`${ROUTE_NAME} - Error fetching quote:`, quoteError.message);
      if (quoteError.code === 'PGRST116') {
        return handleApiError('Quote not found or does not belong to this craftsman', 404, ROUTE_NAME);
      }
      return handleApiError(`Error fetching quote: ${quoteError.message}`, 500, ROUTE_NAME);
    }
    
    if (!quote) {
      return handleApiError('Quote not found or does not belong to this craftsman', 404, ROUTE_NAME);
    }

    // Step 2: Get associated materials
    console.log(`${ROUTE_NAME} - Fetching materials for quote ${quoteId}`);
    const { data: quoteMaterials, error: materialsError } = await supabase
      .from('quote_materials')
      .select('*')
      .eq('quote_id', quoteId);

    if (materialsError) {
      console.error(`${ROUTE_NAME} - Error fetching quote materials:`, materialsError.message);
      return handleApiError(`Error fetching quote materials: ${materialsError.message}`, 500, ROUTE_NAME);
    }

    // Step 3: Create new invoice from quote data
    console.log(`${ROUTE_NAME} - Creating new invoice from quote ${quoteId}`);
    const invoiceData = {
      ...quote,
      type: 'invoice',
      status: 'draft',
      quote_id: quoteId, // Reference back to original quote
    };

    // Remove fields that shouldn't be copied
    delete invoiceData.id; // Will get a new ID
    delete invoiceData.created_at; // Will get current timestamp
    delete invoiceData.updated_at; // Will get current timestamp

    const { data: newInvoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert(invoiceData)
      .select()
      .single();

    if (invoiceError) {
      console.error(`${ROUTE_NAME} - Error creating invoice:`, invoiceError.message);
      return handleApiError(`Error creating invoice: ${invoiceError.message}`, 500, ROUTE_NAME);
    }
    
    if (!newInvoice) {
      return handleApiError('Failed to create invoice', 500, ROUTE_NAME);
    }

    // Step 4: Copy materials to invoice_materials if any exist
    if (quoteMaterials && quoteMaterials.length > 0) {
      console.log(`${ROUTE_NAME} - Copying ${quoteMaterials.length} materials to new invoice ${newInvoice.id}`);
      
      const invoiceMaterials = quoteMaterials.map(material => ({
        invoice_id: newInvoice.id,
        material_id: material.material_id,
        quantity: material.quantity,
        unit_price: material.unit_price,
        name: material.name,
        unit: material.unit
      }));

      const { error: insertMaterialsError } = await supabase
        .from('invoice_materials')
        .insert(invoiceMaterials);

      if (insertMaterialsError) {
        console.error(`${ROUTE_NAME} - Error copying materials:`, insertMaterialsError.message);
        return handleApiError(`Error copying materials to invoice: ${insertMaterialsError.message}`, 500, ROUTE_NAME);
      }
    } else {
      console.log(`${ROUTE_NAME} - No materials to copy for quote ${quoteId}`);
    }

    // Step 5: Update the original quote to mark it as converted
    console.log(`${ROUTE_NAME} - Updating quote ${quoteId} status to 'converted'`);
    const { error: updateQuoteError } = await supabase
      .from('quotes')
      .update({ status: 'converted', invoice_id: newInvoice.id })
      .eq('id', quoteId)
      .eq('craftsman_id', craftsmanId);

    if (updateQuoteError) {
      console.error(`${ROUTE_NAME} - Error updating quote status:`, updateQuoteError.message);
      return handleApiError(`Error updating quote status: ${updateQuoteError.message}`, 500, ROUTE_NAME);
    }

    console.log(`${ROUTE_NAME} - Successfully converted quote ${quoteId} to invoice ${newInvoice.id}`);
    
    // Return the newly created invoice with success response
    return handleApiSuccess(
      newInvoice, 
      `Quote #${quoteId} successfully converted to Invoice #${newInvoice.id}`,
      201,
      ROUTE_NAME
    );
  } catch (err) {
    console.error(`${ROUTE_NAME} - Unhandled error:`, err.message);
    return handleApiError('Server error processing your request', 500, ROUTE_NAME);
  }
}
