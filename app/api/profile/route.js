// API route for fetching and updating craftsman profile for the logged-in user
// GET    /api/profile        – fetch profile (craftsmen row)
// PUT    /api/profile        – update profile fields

import { 
  createSupabaseClient, 
  getUserFromRequest, 
  getOrCreateCraftsmanId,
  handleApiError,
  handleApiSuccess
} from '../../../lib/api-utils';

// Initialize Supabase client using shared utility
const ROUTE_NAME = 'Profile API';
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

    console.log(`${ROUTE_NAME} - Fetching craftsman profile for ID: ${craftsmanId}`);
    const { data, error } = await supabase
      .from('craftsmen')
      .select('*')
      .eq('id', craftsmanId)
      .single();

    if (error) {
      console.error(`${ROUTE_NAME} - Error fetching craftsman profile:`, error);
      return handleApiError(`Error fetching craftsman profile: ${error.message}`, 500, ROUTE_NAME);
    }
    
    return handleApiSuccess(data, 'Craftsman profile retrieved successfully');
  } catch (err) {
    console.error(`${ROUTE_NAME} - GET error:`, err.message);
    return handleApiError('Server error processing your request', 500, ROUTE_NAME);
  }
}

export async function PUT(req) {
  console.log(`${ROUTE_NAME} - PUT request received`);
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
    console.log(`${ROUTE_NAME} - Updating craftsman profile for ID: ${craftsmanId}`);
    
    // Safety measure: prevent changing ID
    delete body.id;
    
    const { data, error } = await supabase
      .from('craftsmen')
      .update(body)
      .eq('id', craftsmanId)
      .select()
      .single();

    if (error) {
      console.error(`${ROUTE_NAME} - Error updating craftsman profile:`, error);
      return handleApiError(`Error updating craftsman profile: ${error.message}`, 500, ROUTE_NAME);
    }
    
    return handleApiSuccess(data, 'Craftsman profile updated successfully');
  } catch (err) {
    console.error(`${ROUTE_NAME} - PUT error:`, err.message);
    return handleApiError('Server error processing your request', 500, ROUTE_NAME);
  }
}
