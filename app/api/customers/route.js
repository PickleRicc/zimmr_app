// API route for listing customers associated with the logged-in craftsman
// GET    /api/customers          – list all customers
// GET    /api/customers?id=123   - get specific customer
// POST   /api/customers          – create new customer
// PUT    /api/customers          - update customer
// DELETE /api/customers?id=123   - delete customer

import { NextResponse } from 'next/server';
import { 
  createSupabaseClient, 
  getUserFromRequest, 
  getOrCreateCraftsmanId,
  handleApiError,
  handleApiSuccess
} from '../../../lib/api-utils';

// Create a standardized Supabase client for this route
const ROUTE_NAME = 'Customers API';
const supabase = createSupabaseClient(ROUTE_NAME);

export async function GET(req) {
  try {
    console.log(`${ROUTE_NAME} - Processing GET request`);
    
    const user = await getUserFromRequest(req, supabase, ROUTE_NAME);
    if (!user) {
      return handleApiError({ message: 'Unauthorized' }, 'Unauthorized', 401, ROUTE_NAME);
    }
    
    console.log(`${ROUTE_NAME} - User authenticated:`, user.id);
    
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;
    
    console.log(`${ROUTE_NAME} - Request parameters:`, customerId ? `id: ${customerId}` : `listing all (page: ${page}, limit: ${limit})`);
    
    const craftsmanId = await getOrCreateCraftsmanId(user, supabase, ROUTE_NAME);
    if (!craftsmanId) {
      return NextResponse.json({ error: 'Craftsman profile not found' }, { status: 404 });
    }
    
    console.log(`${ROUTE_NAME} - Using craftsman ID:`, craftsmanId);
    
    if (customerId) {
      console.log(`${ROUTE_NAME} - Fetching customer ${customerId} for craftsman: ${craftsmanId}`);
      
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .eq('craftsman_id', craftsmanId)
        .single();
        
      if (error) {
        return handleApiError(error, 'Customer not found', 404, ROUTE_NAME);
      }
      
      return handleApiSuccess(data, 'Customer retrieved successfully');
    } else {
      console.log(`${ROUTE_NAME} - Fetching all customers for craftsman: ${craftsmanId}`);
      
      // Get total count for pagination
      const { count: totalCount, error: countError } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('craftsman_id', craftsmanId);

      if (countError) {
        return handleApiError(countError, 'Failed to get customer count', 500, ROUTE_NAME);
      }

      const { data: customers, error } = await supabase
        .from('customers')
        .select('*')
        .eq('craftsman_id', craftsmanId)
        .order('name', { ascending: true })
        .range(offset, offset + limit - 1);
        
      if (error) {
        return handleApiError(error, 'Failed to fetch customers', 500, ROUTE_NAME);
      }

      // Get document counts for each customer from unified registry
      const customersWithCounts = await Promise.all(
        (customers || []).map(async (customer) => {
          // Get total document count from registry
          const { count: totalDocumentCount, error: totalDocError } = await supabase
            .from('documents')
            .select('*', { count: 'exact', head: true })
            .eq('customer_id', customer.id)
            .eq('craftsman_id', craftsmanId)
            .eq('status', 'active')
            .eq('is_latest_version', true);
          
          // Get notes count from registry
          const { count: notesCount, error: notesCountError } = await supabase
            .from('documents')
            .select('*', { count: 'exact', head: true })
            .eq('customer_id', customer.id)
            .eq('craftsman_id', craftsmanId)
            .eq('document_type', 'note')
            .eq('status', 'active')
            .eq('is_latest_version', true);
          
          // Get invoices count from registry
          const { count: invoicesCount, error: invoicesCountError } = await supabase
            .from('documents')
            .select('*', { count: 'exact', head: true })
            .eq('customer_id', customer.id)
            .eq('craftsman_id', craftsmanId)
            .eq('document_type', 'invoice')
            .eq('status', 'active')
            .eq('is_latest_version', true);
          
          // Get quotes count from registry
          const { count: quotesCount, error: quotesCountError } = await supabase
            .from('documents')
            .select('*', { count: 'exact', head: true })
            .eq('customer_id', customer.id)
            .eq('craftsman_id', craftsmanId)
            .eq('document_type', 'quote')
            .eq('status', 'active')
            .eq('is_latest_version', true);
          
          return {
            ...customer,
            document_count: totalDocError ? 0 : (totalDocumentCount || 0),
            notes_count: notesCountError ? 0 : (notesCount || 0),
            invoices_count: invoicesCountError ? 0 : (invoicesCount || 0),
            quotes_count: quotesCountError ? 0 : (quotesCount || 0)
          };
        })
      );
      
      const totalPages = Math.ceil(totalCount / limit);
      
      console.log(`${ROUTE_NAME} - Successfully fetched ${customers ? customers.length : 0} customers with document counts (page ${page}/${totalPages})`);
      return handleApiSuccess({
        customers: customersWithCounts,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }, 'Customers retrieved successfully');
    }
  } catch (error) {
    return handleApiError(error, 'Server error', 500, ROUTE_NAME);
  }
}

// NOTE: Using shared getUserFromRequest from api-utils.js

// NOTE: Using shared getOrCreateCraftsmanId from api-utils.js

// ---------- CREATE ----------
export async function POST(req) {
  try {
    const user = await getUserFromRequest(req, supabase, ROUTE_NAME);
    if (!user) return handleApiError({ message: 'Unauthorized' }, 'Unauthorized', 401, ROUTE_NAME);

    const body = await req.json();
    const craftsmanId = await getOrCreateCraftsmanId(user, supabase, ROUTE_NAME);

    if (!craftsmanId) {
      return handleApiError(
        { message: 'Craftsman profile not found' }, 
        'Craftsman profile not found', 
        404, 
        ROUTE_NAME
      );
    }

    if (!body.name) {
      return handleApiError(
        { message: 'Name is required' }, 
        'Name is required', 
        400, 
        ROUTE_NAME
      );
    }

    const { data, error } = await supabase
      .from('customers')
      .insert({
        craftsman_id: craftsmanId,
        name: body.name,
        email: body.email || null,
        phone: body.phone || null,
        address: body.address || null,
        service_type: body.service_type || null,
        notes: body.notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('*')
      .single();

    if (error) {
      console.error(`${ROUTE_NAME} - POST error:`, error);
      return handleApiError(error, 'Failed to create customer', 500, ROUTE_NAME);
    }

    return handleApiSuccess(data, 'Customer created successfully', 201);
  } catch (err) {
    return handleApiError(err, 'Server error', 500, ROUTE_NAME);
  }
}

// ---------- UPDATE ----------
export async function PUT(req) {
  try {
    const user = await getUserFromRequest(req, supabase, ROUTE_NAME);
    if (!user) return handleApiError({ message: 'Unauthorized' }, 'Unauthorized', 401, ROUTE_NAME);
    
    const body = await req.json();
    const { id } = body;
    
    if (!id) {
      return handleApiError(
        { message: 'Customer ID is required' }, 
        'Customer ID is required', 
        400, 
        ROUTE_NAME
      );
    }
    
    // First, verify this customer belongs to this craftsman
    const craftsmanId = await getOrCreateCraftsmanId(user, supabase, ROUTE_NAME);
    
    const { data: existing, error: findError } = await supabase
      .from('customers')
      .select('id, craftsman_id')
      .eq('id', id)
      .single();
      
    if (findError || !existing) {
      return handleApiError(
        findError || { message: 'Customer not found' },
        'Customer not found',
        404,
        ROUTE_NAME
      );
    }
    
    if (existing.craftsman_id !== craftsmanId) {
      return handleApiError(
        { message: 'Not authorized to update this customer' },
        'Unauthorized: Not your customer',
        403,
        ROUTE_NAME
      );
    }
    
    // Remove id from update payload
    const { id: removeId, ...updateData } = body;
    
    // Add updated_at timestamp
    updateData.updated_at = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('customers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
      
    if (error) {
      console.error(`${ROUTE_NAME} - PUT error:`, error);
      return handleApiError(error, 'Failed to update customer', 500, ROUTE_NAME);
    }
    
    return handleApiSuccess(data, 'Customer updated successfully');
  } catch (err) {
    return handleApiError(err, 'Server error', 500, ROUTE_NAME);
  }
}

// ---------- DELETE ----------
export async function DELETE(req) {
  try {
    const user = await getUserFromRequest(req, supabase, ROUTE_NAME);
    if (!user) return handleApiError({ message: 'Unauthorized' }, 'Unauthorized', 401, ROUTE_NAME);
    
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return handleApiError(
        { message: 'Customer ID is required' },
        'Customer ID is required',
        400,
        ROUTE_NAME
      );
    }
    
    // First verify this customer belongs to this craftsman
    const craftsmanId = await getOrCreateCraftsmanId(user, supabase, ROUTE_NAME);
    
    const { data: existing, error: findError } = await supabase
      .from('customers')
      .select('id, craftsman_id')
      .eq('id', id)
      .single();
      
    if (findError || !existing) {
      return handleApiError(
        findError || { message: 'Customer not found' },
        'Customer not found',
        404,
        ROUTE_NAME
      );
    }
    
    if (existing.craftsman_id !== craftsmanId) {
      return handleApiError(
        { message: 'Not authorized to delete this customer' },
        'Unauthorized: Not your customer',
        403,
        ROUTE_NAME
      );
    }
    
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id);
      
    if (error) {
      console.error(`${ROUTE_NAME} - DELETE error:`, error);
      return handleApiError(error, 'Failed to delete customer', 500, ROUTE_NAME);
    }
    
    return handleApiSuccess(null, 'Customer deleted successfully');
  } catch (err) {
    return handleApiError(err, 'Server error', 500, ROUTE_NAME);
  }
}
