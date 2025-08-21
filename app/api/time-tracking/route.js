// Enhanced Time Tracking API route for Start/Pause/Stop functionality
// GET    /api/time-tracking      – fetch time tracking sessions with filters
// POST   /api/time-tracking      – start new time tracking session
// PUT    /api/time-tracking      – update session (stop, pause, resume)

import { NextResponse } from 'next/server';
import { 
  createSupabaseClient, 
  getUserFromRequest, 
  getOrCreateCraftsmanId,
  handleApiError,
  handleApiSuccess
} from '../../../lib/api-utils';

const ROUTE_NAME = 'Time Tracking API';
const supabase = createSupabaseClient(ROUTE_NAME);

export async function GET(req) {
  console.log(`${ROUTE_NAME} - GET request received`);
  try {
    // Authenticate request
    const user = await getUserFromRequest(req, supabase, ROUTE_NAME);
    if (!user) {
      return handleApiError('Unauthorized', 401, ROUTE_NAME);
    }

    // Get craftsman ID
    const craftsmanId = await getOrCreateCraftsmanId(user, supabase, ROUTE_NAME);
    if (!craftsmanId) {
      return handleApiError('Craftsman profile not found', 404, ROUTE_NAME);
    }

    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const date = url.searchParams.get('date');
    const customerId = url.searchParams.get('customer_id');
    const appointmentId = url.searchParams.get('appointment_id');

    let query = supabase
      .from('time_tracking')
      .select('*')
      .eq('craftsman_id', craftsmanId);

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (customerId) {
      query = query.eq('customer_id', customerId);
    }
    if (appointmentId) {
      query = query.eq('appointment_id', appointmentId);
    }
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      query = query
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString());
    }

    const { data: sessions, error } = await query
      .order('start_time', { ascending: false });

    if (error) {
      console.error(`${ROUTE_NAME} - Error fetching sessions:`, error);
      return handleApiError(`Error fetching sessions: ${error.message}`, 500, ROUTE_NAME);
    }

    return handleApiSuccess(sessions || [], 'Time tracking sessions retrieved successfully');
  } catch (err) {
    console.error(`${ROUTE_NAME} - GET error:`, err);
    return handleApiError('Server error processing your request', 500, ROUTE_NAME);
  }
}

export async function POST(req) {
  console.log(`${ROUTE_NAME} - POST request received`);
  try {
    // Authenticate request
    const user = await getUserFromRequest(req, supabase, ROUTE_NAME);
    if (!user) {
      return handleApiError('Unauthorized', 401, ROUTE_NAME);
    }

    // Get craftsman ID
    const craftsmanId = await getOrCreateCraftsmanId(user, supabase, ROUTE_NAME);
    if (!craftsmanId) {
      return handleApiError('Craftsman profile not found', 404, ROUTE_NAME);
    }

    const body = await req.json();
    console.log(`${ROUTE_NAME} - Starting new time tracking session`);

    const {
      description,
      start_time,
      end_time,
      duration_minutes,
      customer_id,
      appointment_id,
      is_billable,
      hourly_rate,
      notes,
      status = 'active'
    } = body;

    // Validation
    if (!description || !start_time) {
      return handleApiError('Description and start_time are required', 400, ROUTE_NAME);
    }

    // Additional validation for completed entries
    if (status === 'completed') {
      if (!end_time) {
        return handleApiError('end_time is required for completed entries', 400, ROUTE_NAME);
      }
      if (!duration_minutes || duration_minutes < 1) {
        return handleApiError('duration_minutes must be at least 1 for completed entries', 400, ROUTE_NAME);
      }
    }

    // Check for existing active session (only if creating new active session)
    if (status === 'active') {
      const { data: activeSessions, error: activeError } = await supabase
        .from('time_tracking')
        .select('id')
        .eq('craftsman_id', craftsmanId)
        .eq('status', 'active');

      if (activeError) {
        console.error(`${ROUTE_NAME} - Error checking active sessions:`, activeError);
        return handleApiError('Error checking active sessions', 500, ROUTE_NAME);
      }

      if (activeSessions && activeSessions.length > 0) {
        return handleApiError('You already have an active time tracking session. Please stop it before starting a new one.', 400, ROUTE_NAME);
      }
    }

    // Create new session
    const sessionData = {
      craftsman_id: craftsmanId,
      description,
      start_time,
      end_time: end_time || null,
      duration_minutes: duration_minutes || null,
      customer_id: customer_id || null,
      appointment_id: appointment_id || null,
      is_billable: customer_id ? true : (is_billable ?? false),
      hourly_rate: hourly_rate || null,
      notes: notes || null,
      status,
      is_manual_entry: false
    };

    const { data: session, error } = await supabase
      .from('time_tracking')
      .insert(sessionData)
      .select()
      .single();

    if (error) {
      console.error(`${ROUTE_NAME} - Error creating session:`, error);
      return handleApiError(`Error creating session: ${error.message}`, 500, ROUTE_NAME);
    }

    return handleApiSuccess(session, 'Time tracking session started successfully', 201);
  } catch (err) {
    console.error(`${ROUTE_NAME} - POST error:`, err);
    return handleApiError('Server error processing your request', 500, ROUTE_NAME);
  }
}

export async function PUT(req) {
  console.log(`${ROUTE_NAME} - PUT request received`);
  try {
    // Authenticate request
    const user = await getUserFromRequest(req, supabase, ROUTE_NAME);
    if (!user) {
      return handleApiError('Unauthorized', 401, ROUTE_NAME);
    }

    // Get craftsman ID
    const craftsmanId = await getOrCreateCraftsmanId(user, supabase, ROUTE_NAME);
    if (!craftsmanId) {
      return handleApiError('Craftsman profile not found', 404, ROUTE_NAME);
    }

    const body = await req.json();
    const { id, action, end_time, ...updateData } = body;

    if (!id) {
      return handleApiError('Session ID is required', 400, ROUTE_NAME);
    }

    // Verify session ownership
    const { data: session, error: fetchError } = await supabase
      .from('time_tracking')
      .select('*')
      .eq('id', id)
      .eq('craftsman_id', craftsmanId)
      .single();

    if (fetchError || !session) {
      return handleApiError('Session not found or access denied', 404, ROUTE_NAME);
    }

    let updatePayload = { ...updateData };

    // Handle different actions
    switch (action) {
      case 'stop':
        updatePayload.status = 'completed';
        updatePayload.end_time = end_time || new Date().toISOString();
        break;
      case 'pause':
        updatePayload.status = 'paused';
        // Add break entry
        const breakStart = new Date().toISOString();
        await supabase
          .from('time_tracking_breaks')
          .insert({
            time_tracking_id: id,
            break_start: breakStart
          });
        break;
      case 'resume':
        updatePayload.status = 'active';
        // End current break
        const { error: breakError } = await supabase
          .from('time_tracking_breaks')
          .update({ break_end: new Date().toISOString() })
          .eq('time_tracking_id', id)
          .is('break_end', null);
        
        if (breakError) {
          console.error(`${ROUTE_NAME} - Error ending break:`, breakError);
        }
        break;
      default:
        // General update
        break;
    }

    const { data: updatedSession, error } = await supabase
      .from('time_tracking')
      .update(updatePayload)
      .eq('id', id)
      .eq('craftsman_id', craftsmanId)
      .select()
      .single();

    if (error) {
      console.error(`${ROUTE_NAME} - Error updating session:`, error);
      return handleApiError(`Error updating session: ${error.message}`, 500, ROUTE_NAME);
    }

    return handleApiSuccess(updatedSession, `Session ${action || 'updated'} successfully`);
  } catch (err) {
    console.error(`${ROUTE_NAME} - PUT error:`, err);
    return handleApiError('Server error processing your request', 500, ROUTE_NAME);
  }
}
