// API route for creating and listing quotes associated with the logged-in craftsman
// GET    /api/quotes            – list all quotes for craftsman (optionally filter by ?status=)
// POST   /api/quotes            – create new quote
//
// NOTE: Detail operations (GET/PUT/DELETE) live in /api/quotes/[id]/route.js

import { NextResponse } from 'next/server';
import { 
  createSupabaseClient, 
  getUserFromRequest, 
  getOrCreateCraftsmanId,
  handleApiError,
  handleApiSuccess,
  camelToSnake
} from '../../../lib/api-utils';

// Create a standardized Supabase client for this route
const ROUTE_NAME = 'Quotes API';
const supabase = createSupabaseClient(ROUTE_NAME);

// ---------- READ COLLECTION ----------
export async function GET(req) {
  try {
    const user = await getUserFromRequest(req, supabase, ROUTE_NAME);
    if (!user) return handleApiError({ message: 'Unauthorized' }, 'Unauthorized', 401, ROUTE_NAME);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const includeCustomer = searchParams.get('include_customer') === 'true';
    const includeMaterials = searchParams.get('include_materials') === 'true';
    
    // Get craftsman ID for the logged-in user
    const craftsmanId = await getOrCreateCraftsmanId(user, supabase, ROUTE_NAME);
    if (!craftsmanId) {
      return handleApiError(
        { message: 'Craftsman profile not found' },
        'Craftsman profile not found',
        404,
        ROUTE_NAME
      );
    }
    
    // Start building the query
    let query = supabase
      .from('quotes')
      .select('*')
      .eq('craftsman_id', craftsmanId)
      .order('created_at', { ascending: false });
      
    // Apply status filter if provided
    if (status) {
      query = query.eq('status', status);
    }
    
    // Execute the query
    const { data, error } = await query;
      
    if (error) {
      console.error(`${ROUTE_NAME} - GET error:`, error);
      return handleApiError(error, 'Failed to retrieve quotes', 500, ROUTE_NAME);
    }
    
    // If including customer data, fetch customer details for each quote
    if (includeCustomer && data && data.length > 0) {
      const customerIds = data
        .filter(quote => quote.customer_id)
        .map(quote => quote.customer_id);
        
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
        
        // Attach customer data to quotes
        data.forEach(quote => {
          if (quote.customer_id) {
            quote.customer = customerMap[quote.customer_id] || null;
          }
        });
      }
    }
    
    // If including materials, fetch materials for quotes
    if (includeMaterials && data && data.length > 0) {
      const quoteIds = data.map(quote => quote.id);
      
      const { data: materials, error: materialsError } = await supabase
        .from('materials')
        .select('*')
        .in('quote_id', quoteIds);
        
      if (materialsError) {
        console.error(`${ROUTE_NAME} - GET materials error:`, materialsError);
        return handleApiError(materialsError, 'Failed to retrieve materials', 500, ROUTE_NAME);
      }
      
      // Group materials by quote_id
      const materialsByQuote = {};
      materials?.forEach(material => {
        if (!materialsByQuote[material.quote_id]) {
          materialsByQuote[material.quote_id] = [];
        }
        materialsByQuote[material.quote_id].push(material);
      });
      
      // Attach materials to each quote
      data.forEach(quote => {
        quote.materials = materialsByQuote[quote.id] || [];
      });
    }
    
    return handleApiSuccess(data || [], 'Quotes retrieved successfully');
  } catch (err) {
    return handleApiError(err, 'Server error', 500, ROUTE_NAME);
  }
}

// ---------- CREATE ----------
export async function POST(req) {
  try {
    const user = await getUserFromRequest(req, supabase, ROUTE_NAME);
    if (!user) return handleApiError({ message: 'Unauthorized' }, 'Unauthorized', 401, ROUTE_NAME);

    const body = await req.json();
    const craftsmanId = await getOrCreateCraftsmanId(user, supabase, ROUTE_NAME);
    const materials = body.materials || [];

    // Validate the request
    if (!craftsmanId) {
      return handleApiError(
        { message: 'Craftsman ID is required' },
        'Craftsman ID is required',
        400,
        ROUTE_NAME
      );
    }

    // Parse materials for pricing calculations
    let totalMaterialsPrice = 0;
    materials.forEach(material => {
      totalMaterialsPrice += (parseFloat(material.quantity) || 0) * (parseFloat(material.unit_price) || 0);
    });

    // Transform the payload to match the actual database schema
    // Remove fields that don't exist and map fields to their correct names
    const { 
      id, description, tax_rate, title, total_price, materials: materialsList,
      ...validFields 
    } = body;
    
    // Extract uploaded files from the request
    const uploadedFiles = body.uploadedFiles || [];
    
    // Store materials and uploaded files directly in JSONB fields
    console.log(`${ROUTE_NAME} - Adding ${materials.length} materials and ${uploadedFiles.length} uploaded files to quote JSONB fields`);

    // Ensure we have proper numeric values for the database
    const insertBody = camelToSnake({
      ...validFields,
      craftsman_id: craftsmanId,
      // Include materials and uploaded files directly in JSONB fields
      materials: materials,
      uploaded_files: uploadedFiles,
      // Use the values from the form explicitly, with fallbacks
      amount: parseFloat(body.amount || 0).toFixed(2),
      tax_amount: parseFloat(body.tax_amount || 0).toFixed(2),
      total_amount: parseFloat(body.total_amount || 0).toFixed(2),
      total_materials_price: totalMaterialsPrice.toFixed(2),
      notes: validFields.notes || description || '', // Store any description in notes
      status: validFields.status || 'draft',
      vat_exempt: body.vat_exempt || false
    });

    // Make sure the numeric fields are properly formatted
    const quoteInsert = {
      ...insertBody,
      amount: parseFloat(insertBody.amount || 0).toFixed(2),
      tax_amount: parseFloat(insertBody.tax_amount || 0).toFixed(2),
      total_amount: parseFloat(insertBody.total_amount || 0).toFixed(2),
      total_materials_price: parseFloat(insertBody.total_materials_price || 0).toFixed(2)
    };

    console.log(`${ROUTE_NAME} - Inserting quote with materials in JSONB field`);
    const { data: quoteData, error: quoteError } = await supabase
      .from('quotes')
      .insert([quoteInsert])
      .select('*')
      .single();
      
    if (quoteError) {
      console.error(`${ROUTE_NAME} - Error inserting quote with materials:`, quoteError);
      return handleApiError(quoteError, 'Failed to create quote', 500, ROUTE_NAME);
    }
    
    // Create corresponding entry in documents registry
    const { error: docError } = await supabase
      .from('documents')
      .insert({
        craftsman_id: craftsmanId,
        customer_id: body.customer_id || null,
        quote_id: quoteData.id,
        title: `Angebot #${quoteData.id}`,
        description: quoteData.notes || '',
        folder_type: 'quotes',
        document_type: 'quote',
        tags: [],
        status: 'active'
      });

    if (docError) {
      console.error('Error creating document registry entry:', docError);
      // Don't fail the request, just log the error
    }

    console.log(`${ROUTE_NAME} - Successfully created quote with materials in JSONB field`);
    
    return handleApiSuccess(quoteData, 'Quote created successfully', 201);
  } catch (err) {
    return handleApiError(err, 'Server error', 500, ROUTE_NAME);
  }
}
