// API route for creating and listing invoices for the logged-in craftsman
// GET    /api/invoices            – list all invoices (optionally filter by ?status=)
// POST   /api/invoices            – create new invoice
// NOTE: Detail operations (GET/PUT/DELETE) live in /api/invoices/[id]/route.js

import { NextResponse } from 'next/server';
import { 
  createSupabaseClient, 
  getUserFromRequest, 
  getOrCreateCraftsmanId,
  handleApiError,
  handleApiSuccess,
  camelToSnake
} from '../../../lib/api-utils';

// Initialize Supabase client using shared utility
const ROUTE_NAME = 'Invoices API';
const supabase = createSupabaseClient(ROUTE_NAME);

// Using shared utilities from api-utils.js for common functions

// ---------- READ COLLECTION ----------
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

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const includeCustomer = searchParams.get('include_customer') === 'true';
    console.log(`${ROUTE_NAME} - Fetching invoices for craftsman: ${craftsmanId}${status ? `, filtered by status: ${status}` : ''}`);

    let query = supabase
      .from('invoices')
      .select('*')
      .eq('craftsman_id', craftsmanId)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    const { data, error } = await query;

    if (error) {
      console.error(`${ROUTE_NAME} - Error querying invoices:`, error);
      return handleApiError(`Error fetching invoices: ${error.message}`, 500, ROUTE_NAME);
    }
    
    // If including customer data, fetch customer details for each invoice
    if (includeCustomer && data && data.length > 0) {
      const customerIds = data
        .filter(invoice => invoice.customer_id)
        .map(invoice => invoice.customer_id);
        
      if (customerIds.length > 0) {
        const { data: customers, error: custError } = await supabase
          .from('customers')
          .select('*')
          .in('id', customerIds);
          
        if (custError) {
          console.error(`${ROUTE_NAME} - GET customer data error:`, custError);
          return handleApiError(custError, 'Failed to retrieve customer data', 500, ROUTE_NAME);
        }
        
        // Create customer lookup map
        const customerMap = {};
        customers?.forEach(customer => {
          customerMap[customer.id] = customer;
        });
        
        // Attach customer data to invoices
        data.forEach(invoice => {
          if (invoice.customer_id) {
            invoice.customer = customerMap[invoice.customer_id] || null;
          }
        });
      }
    }
    
    return handleApiSuccess(data || [], 'Invoices retrieved successfully');
  } catch (err) {
    console.error(`${ROUTE_NAME} - GET error:`, err.message);
    return handleApiError('Server error processing your request', 500, ROUTE_NAME);
  }
}

// ---------- CREATE ----------
export async function POST(req) {
  console.log(`${ROUTE_NAME} - POST request received`);
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

    const body = await req.json();
    const materials = body.materials || [];
    console.log(`${ROUTE_NAME} - Creating invoice with ${materials.length} materials items for craftsman: ${craftsmanId}`);
    
    // Calculate total materials price
    let totalMaterialsPrice = 0;
    materials.forEach(material => {
      totalMaterialsPrice += (parseFloat(material.quantity) || 0) * (parseFloat(material.unit_price) || 0);
    });
    
    // Prepare data for insertion including materials as JSONB
    const insertBody = camelToSnake({ 
      ...body, // Include all fields from body
      craftsman_id: craftsmanId,
      total_materials_price: totalMaterialsPrice.toFixed(2),
      // Store materials directly as JSONB
      materials: materials,
      // Ensure numeric values are properly formatted
      amount: parseFloat(body.amount || 0).toFixed(2),
      tax_amount: parseFloat(body.tax_amount || 0).toFixed(2),
      total_amount: parseFloat(body.total_amount || 0).toFixed(2)
    });
    
    const { data: invoice, error } = await supabase
      .from('invoices')
      .insert(insertBody)
      .select()
      .single();
      
    if (error) {
      console.error(`${ROUTE_NAME} - Error inserting invoice:`, error);
      return handleApiError(`Error creating invoice: ${error.message}`, 500, ROUTE_NAME);
    }
    
    console.log(`${ROUTE_NAME} - Successfully created invoice ID: ${invoice.id}`);
    
    return handleApiSuccess(invoice, 'Invoice created successfully', 201);
  } catch (err) {
    console.error(`${ROUTE_NAME} - POST error:`, err.message);
    return handleApiError('Server error processing your request', 500, ROUTE_NAME);
  }
}
