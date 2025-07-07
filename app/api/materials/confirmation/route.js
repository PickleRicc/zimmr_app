// API route for handling material confirmation status
import { NextResponse } from 'next/server';
import { 
  createSupabaseClient, 
  getUserFromRequest, 
  getOrCreateCraftsmanId,
  handleApiError,
  handleApiSuccess
} from '../../../../lib/api-utils';

// Create a standardized Supabase client for this route
const ROUTE_NAME = 'Materials Confirmation API';
const supabase = createSupabaseClient(ROUTE_NAME);

// GET: Check if user has confirmed the materials notice
export async function GET(req) {
  try {
    const user = await getUserFromRequest(req, supabase, ROUTE_NAME);
    if (!user) {
      return handleApiError(
        { message: 'Unauthorized' },
        'Unauthorized',
        401,
        ROUTE_NAME
      );
    }

    const craftsmanId = await getOrCreateCraftsmanId(user, supabase, ROUTE_NAME);
    if (!craftsmanId) {
      return handleApiError(
        { message: 'Craftsman profile not found' },
        'Craftsman profile not found',
        404,
        ROUTE_NAME
      );
    }

    console.log(`${ROUTE_NAME} - Checking material confirmation status for craftsman: ${craftsmanId}`);

    // Check if confirmation exists
    const { data, error } = await supabase
      .from('materials_confirmations')
      .select('*')
      .eq('craftsman_id', craftsmanId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error(`${ROUTE_NAME} - Error checking confirmation:`, error);
      return handleApiError(
        error,
        'Failed to check material confirmation status',
        500,
        ROUTE_NAME
      );
    }

    // Return confirmation status and timestamp if exists
    const responseData = {
      confirmed: !!data,
      confirmed_at: data?.confirmed_at || null
    };
    
    console.log(`${ROUTE_NAME} - Material confirmation status: ${responseData.confirmed}`);
    return handleApiSuccess(
      responseData,
      responseData.confirmed ? 
        'Materials terms have been confirmed' : 
        'Materials terms have not been confirmed yet'
    );
  } catch (err) {
    console.error(`${ROUTE_NAME} - GET error:`, err);
    return handleApiError(err, 'Server error', 500, ROUTE_NAME);
  }
}

// POST: Record user's confirmation of the materials notice
export async function POST(req) {
  try {
    const user = await getUserFromRequest(req, supabase, ROUTE_NAME);
    if (!user) {
      return handleApiError(
        { message: 'Unauthorized' },
        'Unauthorized',
        401,
        ROUTE_NAME
      );
    }

    const craftsmanId = await getOrCreateCraftsmanId(user, supabase, ROUTE_NAME);
    if (!craftsmanId) {
      return handleApiError(
        { message: 'Craftsman profile not found' },
        'Craftsman profile not found',
        404,
        ROUTE_NAME
      );
    }

    console.log(`${ROUTE_NAME} - Saving materials confirmation for craftsman: ${craftsmanId}`);

    // Insert confirmation record
    const { data, error } = await supabase
      .from('materials_confirmations')
      .upsert({ craftsman_id: craftsmanId })
      .select()
      .single();
    
    if (error) {
      console.error(`${ROUTE_NAME} - Error saving confirmation:`, error);
      return handleApiError(
        error,
        'Failed to save materials confirmation',
        500,
        ROUTE_NAME
      );
    }

    const responseData = {
      confirmed: true,
      confirmed_at: data.confirmed_at
    };

    console.log(`${ROUTE_NAME} - Successfully recorded materials confirmation at ${data.confirmed_at}`);
    return handleApiSuccess(
      responseData,
      'Materials terms have been successfully confirmed',
      201
    );
  } catch (err) {
    console.error(`${ROUTE_NAME} - POST error:`, err);
    return handleApiError(err, 'Server error', 500, ROUTE_NAME);
  }
}
