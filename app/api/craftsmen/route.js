// GET handler returns the craftsman row that matches the logged-in Supabase user.
// Auth via bearer token (Next.js App Router – server component)

import { 
  createSupabaseClient, 
  getUserFromRequest, 
  getOrCreateCraftsmanId,
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
    
    // First try to get existing craftsman, or create if needed
    const craftsmanId = await getOrCreateCraftsmanId(user, supabase, ROUTE_NAME);
    
    // Now fetch the full craftsman record
    const { data: craftsmen, error } = await supabase
      .from('craftsmen')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      console.error(`${ROUTE_NAME} - Error fetching craftsman:`, error.message);
      return handleApiError(`Error fetching craftsman profile: ${error.message}`, 500, ROUTE_NAME);
    }
    
    // Handle multiple records by taking the first one
    const data = craftsmen && craftsmen.length > 0 ? craftsmen[0] : null;
    
    if (!data) {
      return handleApiError('Craftsman profile not found after creation attempt', 404, ROUTE_NAME);
    }
    
    return handleApiSuccess(data, 'Craftsman profile retrieved successfully');
  } catch (err) {
    console.error(`${ROUTE_NAME} - GET error:`, err.message);
    return handleApiError('Server error processing your request', 500, ROUTE_NAME);
  }
}
