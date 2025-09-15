// API route for managing individual notes
// GET    /api/notes/[id]             – get single note
// PUT    /api/notes/[id]             – update note
// DELETE /api/notes/[id]             – delete note

import { NextResponse } from 'next/server';
import { 
  createSupabaseClient, 
  getUserFromRequest, 
  getOrCreateCraftsmanId,
  handleApiError,
  handleApiSuccess
} from '../../../../lib/api-utils';

// Create a standardized Supabase client for this route
const ROUTE_NAME = 'Notes Detail API';
const supabase = createSupabaseClient(ROUTE_NAME);

export async function GET(req, { params }) {
  try {
    console.log(`${ROUTE_NAME} - Processing GET request for note:`, params.id);
    
    const user = await getUserFromRequest(req, supabase, ROUTE_NAME);
    if (!user) {
      return handleApiError({ message: 'Unauthorized' }, 'Unauthorized', 401, ROUTE_NAME);
    }
    
    const craftsmanId = await getOrCreateCraftsmanId(user, supabase, ROUTE_NAME);
    if (!craftsmanId) {
      return NextResponse.json({ error: 'Craftsman profile not found' }, { status: 404 });
    }
    
    const { data, error } = await supabase
      .from('notes')
      .select(`
        *,
        customers!inner(id, name, phone, email),
        appointments(id, scheduled_at, status, notes)
      `)
      .eq('id', params.id)
      .eq('craftsman_id', craftsmanId)
      .single();
      
    if (error) {
      return handleApiError(error, 'Note not found', 404, ROUTE_NAME);
    }
    
    console.log(`${ROUTE_NAME} - Successfully retrieved note:`, params.id);
    return handleApiSuccess(data, 'Note retrieved successfully');
    
  } catch (error) {
    return handleApiError(error, 'Server error', 500, ROUTE_NAME);
  }
}

export async function PUT(req, { params }) {
  try {
    console.log(`${ROUTE_NAME} - Processing PUT request for note:`, params.id);
    
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
    
    // First, verify this note belongs to this craftsman
    const { data: existing, error: findError } = await supabase
      .from('notes')
      .select('id, craftsman_id, customer_id')
      .eq('id', params.id)
      .single();
      
    if (findError || !existing) {
      return handleApiError(
        findError || { message: 'Note not found' },
        'Note not found',
        404,
        ROUTE_NAME
      );
    }
    
    if (existing.craftsman_id !== craftsmanId) {
      return handleApiError(
        { message: 'Not authorized to update this note' },
        'Unauthorized: Not your note',
        403,
        ROUTE_NAME
      );
    }
    
    // Validate required fields if provided
    if (body.title !== undefined && !body.title) {
      return handleApiError(
        { message: 'Title cannot be empty' }, 
        'Title is required', 
        400, 
        ROUTE_NAME
      );
    }
    
    if (body.content !== undefined && !body.content) {
      return handleApiError(
        { message: 'Content cannot be empty' }, 
        'Content is required', 
        400, 
        ROUTE_NAME
      );
    }
    
    // If customer_id is being changed, verify the new customer belongs to this craftsman
    if (body.customer_id && body.customer_id !== existing.customer_id) {
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id')
        .eq('id', body.customer_id)
        .eq('craftsman_id', craftsmanId)
        .single();

      if (customerError || !customer) {
        return handleApiError(
          { message: 'Customer not found or not authorized' },
          'Invalid customer',
          400,
          ROUTE_NAME
        );
      }
    }
    
    // If appointment_id is provided, verify it belongs to this craftsman and customer
    if (body.appointment_id) {
      const customerId = body.customer_id || existing.customer_id;
      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .select('id')
        .eq('id', body.appointment_id)
        .eq('craftsman_id', craftsmanId)
        .eq('customer_id', customerId)
        .single();

      if (appointmentError || !appointment) {
        return handleApiError(
          { message: 'Appointment not found or not authorized' },
          'Invalid appointment',
          400,
          ROUTE_NAME
        );
      }
    }
    
    // Prepare update data
    const updateData = {
      updated_at: new Date().toISOString()
    };
    
    // Only update fields that are provided
    if (body.title !== undefined) updateData.title = body.title;
    if (body.content !== undefined) updateData.content = body.content;
    if (body.customer_id !== undefined) updateData.customer_id = body.customer_id;
    if (body.appointment_id !== undefined) updateData.appointment_id = body.appointment_id;
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.is_private !== undefined) updateData.is_private = body.is_private;
    
    const { data, error } = await supabase
      .from('notes')
      .update(updateData)
      .eq('id', params.id)
      .select(`
        *,
        customers!inner(id, name, phone, email),
        appointments(id, scheduled_at, status, notes)
      `)
      .single();
      
    if (error) {
      console.error(`${ROUTE_NAME} - PUT error:`, error);
      return handleApiError(error, 'Failed to update note', 500, ROUTE_NAME);
    }
    
    console.log(`${ROUTE_NAME} - Successfully updated note:`, params.id);
    return handleApiSuccess(data, 'Note updated successfully');
  } catch (err) {
    return handleApiError(err, 'Server error', 500, ROUTE_NAME);
  }
}

export async function DELETE(req, { params }) {
  try {
    console.log(`${ROUTE_NAME} - Processing DELETE request for note:`, params.id);
    
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
    
    // First verify this note belongs to this craftsman
    const { data: existing, error: findError } = await supabase
      .from('notes')
      .select('id, craftsman_id')
      .eq('id', params.id)
      .single();
      
    if (findError || !existing) {
      return handleApiError(
        findError || { message: 'Note not found' },
        'Note not found',
        404,
        ROUTE_NAME
      );
    }
    
    if (existing.craftsman_id !== craftsmanId) {
      return handleApiError(
        { message: 'Not authorized to delete this note' },
        'Unauthorized: Not your note',
        403,
        ROUTE_NAME
      );
    }
    
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', params.id);
      
    if (error) {
      console.error(`${ROUTE_NAME} - DELETE error:`, error);
      return handleApiError(error, 'Failed to delete note', 500, ROUTE_NAME);
    }
    
    console.log(`${ROUTE_NAME} - Successfully deleted note:`, params.id);
    return handleApiSuccess(null, 'Note deleted successfully');
  } catch (err) {
    return handleApiError(err, 'Server error', 500, ROUTE_NAME);
  }
}
