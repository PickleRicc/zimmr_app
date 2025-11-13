/**
 * Vapi.ai Webhook Handler
 * Receives AI conversation results after call completes
 * Creates call record and triggers appointment booking if discussed
 */

import { createSupabaseClient, handleApiError, handleApiSuccess } from '@/app/lib/api-utils';

export async function POST(request) {
  const supabase = createSupabaseClient('Vapi Webhook');
  
  try {
    const payload = await request.json();
    
    console.log('Vapi Webhook - Received payload:', {
      type: payload.type,
      craftsmanId: payload.craftsmanId,
      hasTranscript: !!payload.transcript
    });

    // Verify webhook authenticity (optional but recommended)
    const apiKey = request.headers.get('x-vapi-secret');
    if (apiKey !== process.env.VAPI_API_KEY) {
      console.error('Vapi Webhook - Invalid API key');
      return handleApiError(new Error('Unauthorized'), 'Invalid API key', 401, 'Vapi Webhook');
    }

    // Extract conversation data from Vapi payload
    const {
      craftsmanId,
      customerPhone,
      customerName,
      callReason,
      preferredDate,
      transcript,
      shouldBookAppointment = false
    } = payload;

    // Validate required fields
    if (!craftsmanId || !customerPhone) {
      return handleApiError(
        new Error('Missing required fields'),
        'craftsmanId and customerPhone are required',
        400,
        'Vapi Webhook'
      );
    }

    // Create call record in database
    const { data: callRecord, error: callError } = await supabase
      .from('calls')
      .insert({
        user_id: craftsmanId,
        caller_number: customerPhone,
        caller_name: customerName,
        call_reason: callReason,
        preferred_date: preferredDate,
        transcript: transcript
      })
      .select()
      .single();

    if (callError) {
      console.error('Vapi Webhook - Error creating call record:', callError);
      return handleApiError(callError, 'Failed to save call record', 500, 'Vapi Webhook');
    }

    console.log('Vapi Webhook - Call record created:', callRecord.id);

    // If appointment discussed, trigger booking
    let appointmentId = null;
    if (shouldBookAppointment && preferredDate) {
      try {
        // Call internal book-appointment endpoint
        const bookingResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/vapi/book-appointment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            craftsmanId,
            customerPhone,
            customerName,
            preferredDate,
            callId: callRecord.id,
            notes: callReason
          })
        });

        const bookingResult = await bookingResponse.json();
        appointmentId = bookingResult.data?.appointmentId;
        
        console.log('Vapi Webhook - Appointment created:', appointmentId);
      } catch (bookingError) {
        console.error('Vapi Webhook - Error booking appointment:', bookingError);
        // Don't fail the entire webhook if booking fails
      }
    }

    return handleApiSuccess({
      callId: callRecord.id,
      appointmentId,
      message: 'Call processed successfully'
    }, 'Success', 200);

  } catch (error) {
    console.error('Vapi Webhook - Error:', error);
    return handleApiError(error, 'Failed to process call', 500, 'Vapi Webhook');
  }
}
