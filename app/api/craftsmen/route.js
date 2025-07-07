// GET handler returns the craftsman row that matches the logged-in Supabase user.
// Auth via bearer token (Next.js App Router – server component)

import { 
  createSupabaseClient, 
  getUserFromRequest, 
  handleApiError,
  handleApiSuccess 
} from '../../../lib/api-utils';

// Initialize Supabase client using shared utility
const ROUTE_NAME = 'Craftsmen API';
const supabase = createSupabaseClient(ROUTE_NAME);

export async function GET(req) {
  console.log(`${ROUTE_NAME} - GET request received`);
  try {
    // Authenticate request using shared utility
    const user = await getUserFromRequest(req, supabase, ROUTE_NAME);
    if (!user) {
      return handleApiError('Unauthorized', 401, ROUTE_NAME);
    }

    console.log(`${ROUTE_NAME} - Fetching craftsman profile for user: ${user.id}`);
    const { data, error } = await supabase
      .from('craftsmen')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error(`${ROUTE_NAME} - Error fetching craftsman:`, error.message);
      return handleApiError(`Error fetching craftsman profile: ${error.message}`, 500, ROUTE_NAME);
    }
    
    if (!data) {
      return handleApiError('Craftsman profile not found', 404, ROUTE_NAME);
    }
    
    return handleApiSuccess(data, 'Craftsman profile retrieved successfully');
  } catch (err) {
    console.error(`${ROUTE_NAME} - GET error:`, err.message);
    return handleApiError('Server error processing your request', 500, ROUTE_NAME);
  }
}
