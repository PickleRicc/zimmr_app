/**
 * Calendar Availability Check
 * Called by Vapi.ai during conversation to show available appointment slots
 * Returns available time slots based on existing appointments
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
  const supabase = createSupabaseClient('Calendar Check');
  
  try {
    const body = await request.json();
    console.log('Calendar Check - Raw request body:', JSON.stringify(body, null, 2));
    console.log('Calendar Check - Request headers:', {
      'content-type': request.headers.get('content-type'),
      'x-vapi-secret': request.headers.get('x-vapi-secret') ? 'present' : 'missing'
    });

    // Extract toolCallId for Vapi response format
    let toolCallId = null;
    
    // Vapi might send parameters in different formats
    // Format 1: Direct parameters
    let craftsmanId = body.craftsmanId;
    let date = body.date;
    let timeRange = body.timeRange;
    
    // Format 2: Wrapped in 'message.toolCalls'
    if (!craftsmanId && body.message?.toolCalls?.[0]) {
      const toolCall = body.message.toolCalls[0];
      toolCallId = toolCall.id;
      const args = toolCall.function.arguments;
      craftsmanId = args.craftsmanId;
      date = args.date;
      timeRange = args.timeRange;
      console.log('Calendar Check - Extracted from toolCalls:', { toolCallId, craftsmanId, date });
    }
    
    // Format 3: Wrapped in 'parameters'
    if (!craftsmanId && body.parameters) {
      craftsmanId = body.parameters.craftsmanId;
      date = body.parameters.date;
      timeRange = body.parameters.timeRange;
      console.log('Calendar Check - Extracted from parameters:', { craftsmanId, date });
    }

    // Verify Vapi.ai API key
    const apiKey = request.headers.get('x-vapi-secret');
    if (apiKey !== process.env.VAPI_API_KEY) {
      return handleApiError(new Error('Unauthorized'), 'Invalid API key', 401, 'Calendar Check');
    }

    // Validate required parameters
    if (!craftsmanId || !date) {
      console.error('Calendar Check - Missing parameters:', { craftsmanId, date, receivedBody: body });
      return handleApiError(
        new Error('Missing parameters'),
        'craftsmanId and date are required',
        400,
        'Calendar Check'
      );
    }

    console.log('Calendar Check - Checking availability:', { craftsmanId, date, timeRange });

    // Parse date to get start and end of day
    const requestDate = new Date(date);
    const startOfDay = new Date(requestDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(requestDate.setHours(23, 59, 59, 999));

    // Get all appointments for craftsman on requested date
    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('scheduled_at, duration')
      .eq('craftsman_id', craftsmanId)
      .gte('scheduled_at', startOfDay.toISOString())
      .lte('scheduled_at', endOfDay.toISOString())
      .order('scheduled_at', { ascending: true });

    if (error) {
      console.error('Calendar Check - Database error:', error);
      return handleApiError(error, 'Failed to fetch appointments', 500, 'Calendar Check');
    }

    // Calculate available slots (business hours: 8 AM - 5 PM)
    const businessHours = { start: 8, end: 17 }; // 8:00 - 17:00
    const slotDuration = 60; // 1-hour slots
    const availableSlots = [];

    // Generate all possible slots
    for (let hour = businessHours.start; hour < businessHours.end; hour++) {
      const slotStart = new Date(requestDate);
      slotStart.setHours(hour, 0, 0, 0);
      
      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotDuration);

      // Check if slot conflicts with existing appointment
      const hasConflict = appointments.some(apt => {
        const aptStart = new Date(apt.scheduled_at);
        const aptEnd = new Date(aptStart.getTime() + apt.duration * 60000);
        
        return (slotStart < aptEnd && slotEnd > aptStart);
      });

      if (!hasConflict) {
        availableSlots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
          displayTime: `${hour}:00`
        });
      }
    }

    console.log('Calendar Check - Found available slots:', availableSlots.length);

    // Format slots for AI consumption
    const slotsFormatted = availableSlots.map(slot => slot.displayTime).join(', ');
    
    // Create result string for Vapi
    const resultString = JSON.stringify({
      success: true,
      date,
      availableCount: availableSlots.length,
      slots: availableSlots,
      message: `Available slots on ${date}: ${slotsFormatted}`
    });

    // Vapi expects this exact format with toolCallId
    const vapiResponse = {
      results: [
        {
          toolCallId: toolCallId,
          result: resultString
        }
      ]
    };

    console.log('Calendar Check - Returning Vapi response:', JSON.stringify(vapiResponse, null, 2));

    // Return response with explicit headers
    const response = NextResponse.json(vapiResponse, { 
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

    return response;

  } catch (error) {
    console.error('Calendar Check - Error:', error);
    const response = handleApiError(error, 'Failed to check availability', 500, 'Calendar Check');
    
    // Add CORS headers to error response
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  }
}
