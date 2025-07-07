// Individual appointment resource CRUD at /api/appointments/[id]
// Supports GET, PUT, DELETE using same logic as generic route but path param instead of query.

import { NextResponse } from 'next/server';
import {
  createSupabaseClient,
  getUserFromRequest,
  getOrCreateCraftsmanId,
  handleApiError,
  handleApiSuccess
} from '../../../../lib/api-utils';

const ROUTE_NAME = 'Appointments Detail API';
const supabase = createSupabaseClient(ROUTE_NAME);

export async function GET(req, { params }) {
  try {
    const user = await getUserFromRequest(req, supabase, ROUTE_NAME);
    if (!user) {
      return handleApiError(
        { message: 'Unauthorized' },
        'Unauthorized',
        401,
        ROUTE_NAME
      );
    }
    
    const craftsmanId = await getOrCreateCraftsmanId(user, supabase, ROUTE_NAME);
    if (!craftsmanId) {
      return handleApiError(
        { message: 'Craftsman profile not found' },
        'Craftsman profile not found',
        404,
        ROUTE_NAME
      );
    }
    
    const { id } = await params;
    console.log(`${ROUTE_NAME} - Fetching appointment with ID: ${id}`);
    
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', id)
      .eq('craftsman_id', craftsmanId)
      .single();
      
    if (error) {
      console.error(`${ROUTE_NAME} - Error fetching appointment:`, error);
      if (error.code === 'PGRST116') { // not found error
        return handleApiError(
          error,
          'Appointment not found',
          404,
          ROUTE_NAME
        );
      }
      return handleApiError(error, 'Failed to fetch appointment', 500, ROUTE_NAME);
    }
    
    if (!data) {
      return handleApiError(
        { message: 'Appointment not found' },
        'Appointment not found',
        404,
        ROUTE_NAME
      );
    }
    
    console.log(`${ROUTE_NAME} - Successfully fetched appointment: ${id}`);
    return handleApiSuccess(data, 'Appointment retrieved successfully');
  } catch (err) {
    console.error(`${ROUTE_NAME} - GET error:`, err);
    return handleApiError(err, 'Server error', 500, ROUTE_NAME);
  }
}

export async function PUT(req, { params }) {
  try {
    const user = await getUserFromRequest(req, supabase, ROUTE_NAME);
    if (!user) {
      return handleApiError(
        { message: 'Unauthorized' },
        'Unauthorized',
        401,
        ROUTE_NAME
      );
    }
    
    const craftsmanId = await getOrCreateCraftsmanId(user, supabase, ROUTE_NAME);
    if (!craftsmanId) {
      return handleApiError(
        { message: 'Craftsman profile not found' },
        'Craftsman profile not found',
        404,
        ROUTE_NAME
      );
    }
    
    const { id } = await params;
    const body = await req.json();
    
    // Prevent updating craftsman_id - security check
    delete body.craftsman_id;
    
    // Handle legacy field mapping
    if ('is_private' in body) {
      body.private = body.is_private;
      delete body.is_private;
    }
    
    console.log(`${ROUTE_NAME} - Updating appointment with ID: ${id}`);
    
    // First verify the appointment exists and belongs to this craftsman
    const { data: existingAppointment, error: findError } = await supabase
      .from('appointments')
      .select('id')
      .eq('id', id)
      .eq('craftsman_id', craftsmanId)
      .single();
      
    if (findError) {
      console.error(`${ROUTE_NAME} - Error verifying appointment ownership:`, findError);
      if (findError.code === 'PGRST116') { // not found
        return handleApiError(
          { message: 'Appointment not found' },
          'Appointment not found',
          404,
          ROUTE_NAME
        );
      }
      return handleApiError(findError, 'Failed to verify appointment ownership', 500, ROUTE_NAME);
    }
    
    if (!existingAppointment) {
      return handleApiError(
        { message: 'Appointment not found' },
        'Appointment not found',
        404,
        ROUTE_NAME
      );
    }
    
    // Update the appointment
    const { data, error } = await supabase
      .from('appointments')
      .update(body)
      .eq('id', id)
      .eq('craftsman_id', craftsmanId)
      .select()
      .single();
      
    if (error) {
      console.error(`${ROUTE_NAME} - Error updating appointment:`, error);
      return handleApiError(error, 'Failed to update appointment', 500, ROUTE_NAME);
    }
    
    if (!data) {
      return handleApiError(
        { message: 'Appointment not found after update' },
        'Appointment not found after update',
        404,
        ROUTE_NAME
      );
    }
    
    console.log(`${ROUTE_NAME} - Successfully updated appointment: ${id}`);
    return handleApiSuccess(data, 'Appointment updated successfully');
  } catch (err) {
    console.error(`${ROUTE_NAME} - PUT error:`, err);
    return handleApiError(err, 'Server error', 500, ROUTE_NAME);
  }
}

export async function DELETE(req, { params }) {
  try {
    const user = await getUserFromRequest(req, supabase, ROUTE_NAME);
    if (!user) {
      return handleApiError(
        { message: 'Unauthorized' },
        'Unauthorized',
        401,
        ROUTE_NAME
      );
    }
    
    const craftsmanId = await getOrCreateCraftsmanId(user, supabase, ROUTE_NAME);
    if (!craftsmanId) {
      return handleApiError(
        { message: 'Craftsman profile not found' },
        'Craftsman profile not found',
        404,
        ROUTE_NAME
      );
    }
    
    const { id } = await params;
    console.log(`${ROUTE_NAME} - Deleting appointment with ID: ${id}`);
    
    // First verify the appointment exists and belongs to this craftsman
    const { data: appointment, error: findError } = await supabase
      .from('appointments')
      .select('id, title, customer_name, start_date')
      .eq('id', id)
      .eq('craftsman_id', craftsmanId)
      .single();
      
    if (findError) {
      if (findError.code === 'PGRST116') { // not found
        console.log(`${ROUTE_NAME} - Appointment not found for deletion: ${id}`);
        return handleApiError(
          { message: 'Appointment not found' },
          'Appointment not found',
          404,
          ROUTE_NAME
        );
      }
      
      console.error(`${ROUTE_NAME} - Error finding appointment for deletion:`, findError);
      return handleApiError(findError, 'Failed to verify appointment ownership', 500, ROUTE_NAME);
    }
    
    if (!appointment) {
      return handleApiError(
        { message: 'Appointment not found' },
        'Appointment not found',
        404,
        ROUTE_NAME
      );
    }
    
    // Delete the appointment
    const { error: deleteError } = await supabase
      .from('appointments')
      .delete()
      .eq('id', id)
      .eq('craftsman_id', craftsmanId);
      
    if (deleteError) {
      console.error(`${ROUTE_NAME} - Error deleting appointment:`, deleteError);
      return handleApiError(deleteError, 'Failed to delete appointment', 500, ROUTE_NAME);
    }
    
    // Include information about what was deleted in the success response
    const appointmentTitle = appointment.title || `Appointment #${id}`;
    const customerName = appointment.customer_name || 'customer';
    const dateInfo = appointment.start_date ? ` on ${new Date(appointment.start_date).toLocaleDateString()}` : '';
    const successMessage = `Appointment ${appointmentTitle} for ${customerName}${dateInfo} deleted successfully`;
    
    console.log(`${ROUTE_NAME} - ${successMessage}`);
    return handleApiSuccess(null, successMessage);
  } catch (err) {
    console.error(`${ROUTE_NAME} - DELETE error:`, err);
    return handleApiError(err, 'Server error', 500, ROUTE_NAME);
  }
}
