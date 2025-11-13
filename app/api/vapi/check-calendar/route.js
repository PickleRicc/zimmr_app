/**
 * Calendar Availability Check
 * Called by Vapi.ai during conversation to show available appointment slots
 * Returns available time slots based on existing appointments
 */

import { createSupabaseClient, handleApiError, handleApiSuccess } from '@/app/lib/api-utils';

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
    const { craftsmanId, date, timeRange } = await request.json();

    // Verify Vapi.ai API key
    const apiKey = request.headers.get('x-vapi-secret');
    if (apiKey !== process.env.VAPI_API_KEY) {
      return handleApiError(new Error('Unauthorized'), 'Invalid API key', 401, 'Calendar Check');
    }

    // Validate required parameters
    if (!craftsmanId || !date) {
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

    const response = handleApiSuccess({
      date,
      availableSlots,
      bookedCount: appointments.length,
      totalSlots: businessHours.end - businessHours.start
    }, 'Availability retrieved', 200);

    // Add CORS headers to response
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
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
