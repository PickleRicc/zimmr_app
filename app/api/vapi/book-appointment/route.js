/**
 * Book Appointment from Vapi.ai
 * Creates pending appointment from AI conversation
 * Finds or creates customer and sends notification to craftsman
 */

import { NextResponse } from 'next/server';
import { createSupabaseClient, handleApiError } from '@/app/lib/api-utils';

// CORS headers for Vapi.ai
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-vapi-secret',
};

// Handle OPTIONS preflight request
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function POST(request) {
  const supabase = createSupabaseClient('Book Appointment');
  
  try {
    const body = await request.json();
    console.log('Book Appointment - Raw request body:', JSON.stringify(body, null, 2));
    console.log('Book Appointment - Request headers:', {
      'content-type': request.headers.get('content-type'),
      'x-vapi-secret': request.headers.get('x-vapi-secret') ? 'present' : 'missing'
    });

    // Vapi might send parameters in different formats
    // Format 1: Direct parameters
    let craftsmanId = body.craftsmanId;
    let customerPhone = body.customerPhone;
    let customerName = body.customerName;
    let preferredDate = body.preferredDate;
    let callId = body.callId;
    let notes = body.notes;
    
    // Format 2: Wrapped in 'message.toolCalls'
    if (!craftsmanId && body.message?.toolCalls?.[0]?.function?.arguments) {
      const args = body.message.toolCalls[0].function.arguments;
      craftsmanId = args.craftsmanId;
      customerPhone = args.customerPhone;
      customerName = args.customerName;
      preferredDate = args.preferredDate;
      callId = args.callId;
      notes = args.notes;
      console.log('Book Appointment - Extracted from toolCalls:', { craftsmanId, customerPhone, customerName, preferredDate });
    }
    
    // Format 3: Wrapped in 'parameters'
    if (!craftsmanId && body.parameters) {
      craftsmanId = body.parameters.craftsmanId;
      customerPhone = body.parameters.customerPhone;
      customerName = body.parameters.customerName;
      preferredDate = body.parameters.preferredDate;
      callId = body.parameters.callId;
      notes = body.parameters.notes;
      console.log('Book Appointment - Extracted from parameters:', { craftsmanId, customerPhone, customerName, preferredDate });
    }

    // Verify Vapi.ai API key
    const apiKey = request.headers.get('x-vapi-secret');
    if (apiKey !== process.env.VAPI_API_KEY) {
      return handleApiError(new Error('Unauthorized'), 'Invalid API key', 401, 'Book Appointment');
    }

    // Validate required fields
    if (!craftsmanId || !customerPhone || !preferredDate) {
      console.error('Book Appointment - Missing fields:', { craftsmanId, customerPhone, preferredDate, receivedBody: body });
      return handleApiError(
        new Error('Missing fields'),
        'craftsmanId, customerPhone, and preferredDate are required',
        400,
        'Book Appointment'
      );
    }

    console.log('Book Appointment - Processing:', { craftsmanId, customerPhone, customerName, preferredDate, notes });

    // Find or create customer
    let customer = await findOrCreateCustomer(customerPhone, customerName, craftsmanId, supabase);

    // Create pending appointment
    const { data: appointment, error: aptError } = await supabase
      .from('appointments')
      .insert({
        craftsman_id: craftsmanId,
        customer_id: customer.id,
        call_id: callId,
        scheduled_at: new Date(preferredDate).toISOString(),
        duration: 60, // Default 1 hour
        status: 'scheduled',
        approval_status: 'pending',
        notes: notes || 'Created from phone assistant',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (aptError) {
      console.error('Book Appointment - Database error:', aptError);
      return handleApiError(aptError, 'Failed to create appointment', 500, 'Book Appointment');
    }

    console.log('Book Appointment - Appointment created:', appointment.id);

    // Send SMS notification to craftsman (optional)
    if (process.env.TWILIO_PHONE_NUMBER) {
      await sendCraftsmanNotification(craftsmanId, appointment, customer, supabase);
    }

    // Vapi expects the result directly or in a specific format
    const result = {
      appointmentId: appointment.id,
      customerId: customer.id,
      status: 'pending_approval',
      message: 'Appointment created successfully'
    };

    console.log('Book Appointment - Returning result:', JSON.stringify(result, null, 2));

    // Return response in Vapi's expected format
    const response = NextResponse.json(result, { status: 200 });

    // Add CORS headers to response
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;

  } catch (error) {
    console.error('Book Appointment - Error:', error);
    const response = handleApiError(error, 'Failed to book appointment', 500, 'Book Appointment');
    
    // Add CORS headers to error response
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  }
}

/**
 * Find existing customer or create new one
 */
async function findOrCreateCustomer(phone, name, craftsmanId, supabase) {
  // Try to find existing customer by phone and craftsman
  const { data: existing } = await supabase
    .from('customers')
    .select('*')
    .eq('phone', phone)
    .eq('craftsman_id', craftsmanId)
    .single();

  if (existing) {
    console.log('Book Appointment - Found existing customer:', existing.id);
    return existing;
  }

  // Create new customer
  const { data: newCustomer, error } = await supabase
    .from('customers')
    .insert({
      craftsman_id: craftsmanId,
      name: name || 'Phone Customer',
      phone: phone,
      source: 'phone_ai_assistant',
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('Book Appointment - Error creating customer:', error);
    throw error;
  }

  console.log('Book Appointment - Created new customer:', newCustomer.id);
  return newCustomer;
}

/**
 * Send SMS notification to craftsman about pending appointment
 */
async function sendCraftsmanNotification(craftsmanId, appointment, customer, supabase) {
  try {
    // Get craftsman phone number
    const { data: craftsman } = await supabase
      .from('craftsmen')
      .select('phone, name')
      .eq('id', craftsmanId)
      .single();

    if (!craftsman?.phone) {
      console.log('Book Appointment - No phone number for craftsman');
      return;
    }

    // Import Twilio only if needed
    const twilio = require('twilio');
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    const appointmentDate = new Date(appointment.scheduled_at);
    const dateStr = appointmentDate.toLocaleDateString('de-DE');
    const timeStr = appointmentDate.toLocaleTimeString('de-DE', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    await client.messages.create({
      body: `📞 Neuer Termin von KI-Assistent:\n\nKunde: ${customer.name}\nDatum: ${dateStr} um ${timeStr}\n\nBitte in ZIMMR App überprüfen.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: craftsman.phone
    });

    console.log('Book Appointment - SMS notification sent');
  } catch (error) {
    console.error('Book Appointment - SMS notification failed:', error);
    // Don't throw - notification failure shouldn't fail the booking
  }
}
