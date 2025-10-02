// API route for appointments CRUD using Supabase
// Location: app/api/appointments/route.js (Next.js App Router)
// Each HTTP verb is exported as a function (GET, POST, PUT, DELETE)

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
const ROUTE_NAME = 'Appointments API';

// Initialize Supabase client with route name for better logging
const supabase = createSupabaseClient(ROUTE_NAME);

console.log(`${ROUTE_NAME} - Using shared Supabase client`);

export async function GET(req) {
  console.log('Appointments API - GET request received');
  try {
    // Authenticate request
    const user = await getUserFromRequest(req, supabase, 'Appointments API');
    if (!user) {
      return handleApiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    // Get craftsman ID using shared utility
    const craftsmanId = await getOrCreateCraftsmanId(user, supabase, 'Appointments API');
    if (!craftsmanId) {
      return handleApiError('Craftsman profile not found', 404);
    }

    if (id) {
      // Fetch single appointment by id (and craftsman check)
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('id', id)
        .eq('craftsman_id', craftsmanId)
        .single();
      
      if (error) {
        console.error('Appointments API - Error fetching appointment:', error);
        return handleApiError(`Error fetching appointment: ${error.message}`, 500);
      }
      
      if (!data) {
        return handleApiError('Appointment not found or does not belong to this craftsman', 404);
      }
      
      return handleApiSuccess(data, 'Appointment retrieved successfully');
    }

    // List appointments for logged-in craftsman
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('craftsman_id', craftsmanId)
      .order('scheduled_at', { ascending: false });
    
    if (error) {
      console.error('Appointments API - Error fetching appointments:', error);
      return handleApiError(`Error fetching appointments: ${error.message}`, 500);
    }
    
    // If we have appointments, fetch customer data for each appointment
    if (data && data.length > 0) {
      const customerIds = data
        .filter(appointment => appointment.customer_id)
        .map(appointment => appointment.customer_id);
        
      if (customerIds.length > 0) {
        const { data: customers, error: custError } = await supabase
          .from('customers')
          .select('id, name, email')
          .in('id', customerIds);
          
        if (custError) {
          console.error('Appointments API - Error fetching customer data:', custError);
          // Don't fail the whole request, just log the error
        } else {
          // Create customer lookup map
          const customerMap = {};
          customers?.forEach(customer => {
            customerMap[customer.id] = customer;
          });
          
          // Attach customer data to appointments
          data.forEach(appointment => {
            if (appointment.customer_id) {
              const customer = customerMap[appointment.customer_id];
              appointment.customers = customer || null;
              // Also set customer_name for backward compatibility
              appointment.customer_name = customer?.name || null;
            }
          });
        }
      }
    }
    
    return handleApiSuccess(data, 'Appointments retrieved successfully');
  } catch (err) {
    console.error('Appointments API - GET error:', err.message);
    return handleApiError('Server error processing your request', 500);
  }
}

export async function POST(req) {
  console.log('Appointments API - POST request received');
  try {
    // Authenticate request
    const user = await getUserFromRequest(req, supabase, 'Appointments API');
    if (!user) {
      return handleApiError('Unauthorized', 401);
    }

    // Parse the request body
    const body = await req.json();

    // Get craftsman ID using shared utility which includes retry logic
    const craftsmanId = await getOrCreateCraftsmanId(user, supabase, 'Appointments API');
    if (!craftsmanId) {
      return handleApiError('Failed to retrieve or create craftsman profile', 500);
    }

    // Prepare appointment data with craftsman ID
    const appointmentData = {
      ...body,
      craftsman_id: craftsmanId
    };
    
    // Handle field name conversion if needed
    if ('is_private' in appointmentData) {
      appointmentData.private = appointmentData.is_private;
      delete appointmentData.is_private;
    }
    
    console.log('Appointments API - Creating appointment:', appointmentData);
    
    // Create the appointment
    const { data, error } = await supabase
      .from('appointments')
      .insert(appointmentData)
      .select()
      .single();
      
    if (error) {
      console.error('Appointments API - Error creating appointment:', error);
      return handleApiError(`Error creating appointment: ${error.message}`, 500);
    }
    
    return handleApiSuccess(data, 'Appointment created successfully', 201);
  } catch (err) {
    console.error('Appointments API - POST error:', err.message);
    return handleApiError('Server error processing your request', 500);
  }
}

export async function PUT(req) {
  console.log('Appointments API - PUT request received');
  try {
    // Authenticate request
    const user = await getUserFromRequest(req, supabase, 'Appointments API');
    if (!user) {
      return handleApiError('Unauthorized', 401);
    }

    // Parse request body
    const body = await req.json();
    if (!body.id) {
      return handleApiError('Appointment ID is required', 400);
    }

    // Get craftsman ID using shared utility
    const craftsmanId = await getOrCreateCraftsmanId(user, supabase, 'Appointments API');
    if (!craftsmanId) {
      return handleApiError('Craftsman profile not found', 404);
    }
    
    // Extract ID and prepare data for update
    const { id, ...updateData } = body;
    
    // Prevent craftsman_id change explicitly; always ensure belongs to user
    delete updateData.craftsman_id;
    
    // Update the appointment
    const { data, error } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', id)
      .eq('craftsman_id', craftsmanId) // Ensure appointment belongs to this craftsman
      .select()
      .single();
      
    if (error) {
      console.error('Appointments API - Error updating appointment:', error);
      return handleApiError(`Error updating appointment: ${error.message}`, 500);
    }
    
    if (!data) {
      return handleApiError('Appointment not found or does not belong to this craftsman', 404);
    }
    
    return handleApiSuccess(data, 'Appointment updated successfully');
  } catch (err) {
    console.error('Appointments API - PUT error:', err.message);
    return handleApiError('Server error processing your request', 500);
  }
}

export async function DELETE(req) {
  console.log('Appointments API - DELETE request received');
  try {
    // Authenticate request
    const user = await getUserFromRequest(req, supabase, 'Appointments API');
    if (!user) {
      return handleApiError('Unauthorized', 401);
    }

    // Get ID from query params
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return handleApiError('Appointment ID is required', 400);
    }
    
    // Get craftsman ID using shared utility
    const craftsmanId = await getOrCreateCraftsmanId(user, supabase, 'Appointments API');
    if (!craftsmanId) {
      return handleApiError('Craftsman profile not found', 404);
    }

    // Delete the appointment ensuring it belongs to this craftsman
    const { error, count } = await supabase
      .from('appointments')
      .delete({ count: 'exact' }) // Get count of deleted rows
      .eq('id', id)
      .eq('craftsman_id', craftsmanId); // Ensure appointment belongs to this craftsman
      
    if (error) {
      console.error('Appointments API - Error deleting appointment:', error);
      return handleApiError(`Error deleting appointment: ${error.message}`, 500);
    }
    
    if (count === 0) {
      return handleApiError('Appointment not found or does not belong to this craftsman', 404);
    }
    
    return handleApiSuccess(null, 'Appointment deleted successfully');
  } catch (err) {
    console.error('Appointments API - DELETE error:', err.message);
    return handleApiError('Server error processing your request', 500);
  }
}
