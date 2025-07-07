// API route for fetching and creating time entries for the logged-in craftsman
// GET    /api/time-entries      – list entries for current craftsman
// POST   /api/time-entries      – create a new entry

import { 
  createSupabaseClient, 
  getUserFromRequest, 
  getOrCreateCraftsmanId,
  handleApiError,
  handleApiSuccess
} from '../../../lib/api-utils';

// Initialize Supabase client using shared utility
const ROUTE_NAME = 'Time Entries API';
const supabase = createSupabaseClient(ROUTE_NAME);

// Using shared utilities from api-utils.js for user authentication and craftsman ID retrieval

export async function GET(req) {
  console.log(`${ROUTE_NAME} - GET request received`);
  try {
    // Authenticate request using shared utility
    const user = await getUserFromRequest(req, supabase, ROUTE_NAME);
    if (!user) {
      return handleApiError('Unauthorized', 401, ROUTE_NAME);
    }

    // Get craftsman ID using shared utility
    const craftsmanId = await getOrCreateCraftsmanId(user, supabase, ROUTE_NAME);
    if (!craftsmanId) {
      return handleApiError('Craftsman profile not found', 404, ROUTE_NAME);
    }

    console.log(`${ROUTE_NAME} - Fetching time entries for craftsman: ${craftsmanId}`);
    const { data, error } = await supabase
      .from('time_entries')
      .select('*')
      .eq('craftsman_id', craftsmanId)
      .order('start_time', { ascending: false });

    if (error) {
      console.error(`${ROUTE_NAME} - Error fetching time entries:`, error);
      return handleApiError(`Error fetching time entries: ${error.message}`, 500, ROUTE_NAME);
    }
    
    return handleApiSuccess(data || [], 'Time entries retrieved successfully');
  } catch (err) {
    console.error(`${ROUTE_NAME} - GET error:`, err);
    return handleApiError('Server error processing your request', 500, ROUTE_NAME);
  }
}

export async function POST(req) {
  console.log(`${ROUTE_NAME} - POST request received`);
  try {
    // Authenticate request using shared utility
    const user = await getUserFromRequest(req, supabase, ROUTE_NAME);
    if (!user) {
      return handleApiError('Unauthorized', 401, ROUTE_NAME);
    }

    // Get craftsman ID using shared utility
    const craftsmanId = await getOrCreateCraftsmanId(user, supabase, ROUTE_NAME);
    if (!craftsmanId) {
      return handleApiError('Craftsman profile not found', 404, ROUTE_NAME);
    }

    const body = await req.json();
    console.log(`${ROUTE_NAME} - Processing time entry creation`);

    // Extract fields from request
    let {
      appointment_id,
      customer_id,
      description,
      start_time,
      end_time,
      duration_minutes,
      is_billable,
      hourly_rate,
      notes
    } = body;
    
    // Convert empty strings to null for integer and timestamp fields
    appointment_id = appointment_id === '' ? null : appointment_id;
    customer_id = customer_id === '' ? null : customer_id;
    duration_minutes = duration_minutes === '' ? null : duration_minutes;
    hourly_rate = hourly_rate === '' ? null : hourly_rate;
    
    // Handle timestamps - empty strings must be null
    end_time = end_time === '' ? null : end_time;

    if (!start_time) {
      return handleApiError('start_time is required', 400, ROUTE_NAME);
    }

    // Enforce is_billable = true when customer_id present
    // Note: using "billable" as the field name if "is_billable" causes schema cache issues
    const finalIsBillable = customer_id ? true : is_billable ?? true;

    // Auto-calculate duration if both timestamps present and duration missing
    let finalDuration = duration_minutes;
    if ((!finalDuration || finalDuration === '') && start_time && end_time) {
      const startMs = new Date(start_time).getTime();
      const endMs = new Date(end_time).getTime();
      const diffMs = endMs - startMs;
      finalDuration = Math.round(diffMs / 60000); // minutes
    }

    // Try both field names to handle potential schema inconsistency
    const insertPayload = {
      craftsman_id: craftsmanId,
      appointment_id,
      customer_id,
      description,
      start_time,
      end_time,
      duration_minutes: finalDuration,
      // Try both field names (one of them should work)
      is_billable: finalIsBillable,
      billable: finalIsBillable, // Use this if is_billable fails
      hourly_rate,
      notes
    };

    const { data, error } = await supabase
      .from('time_entries')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error(`${ROUTE_NAME} - Error creating time entry:`, error);
      return handleApiError(`Error creating time entry: ${error.message}`, 500, ROUTE_NAME);
    }
    
    return handleApiSuccess(data, 'Time entry created successfully', 201);
  } catch (err) {
    console.error(`${ROUTE_NAME} - POST error:`, err);
    return handleApiError('Server error processing your request', 500, ROUTE_NAME);
  }
}
