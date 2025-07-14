// Debug endpoint to help diagnose authentication issues
// This endpoint provides detailed information about the current user's auth state

import { 
  createSupabaseClient, 
  getUserFromRequest, 
  handleApiError,
  handleApiSuccess 
} from '../../../lib/api-utils';

const ROUTE_NAME = 'Debug Auth API';
const supabase = createSupabaseClient(ROUTE_NAME);

export async function GET(req) {
  console.log(`${ROUTE_NAME} - Debug request received`);
  
  try {
    // Get user from request
    const user = await getUserFromRequest(req, supabase, ROUTE_NAME);
    
    const debugInfo = {
      timestamp: new Date().toISOString(),
      authentication: {
        hasUser: !!user,
        userId: user?.id || null,
        userEmail: user?.email || null,
        hasMetadata: !!(user?.user_metadata),
        metadata: user?.user_metadata || null
      },
      craftsman: null,
      errors: []
    };
    
    if (user) {
      // Try to find craftsman record
      try {
        const { data: craftsman, error: craftsmanError } = await supabase
          .from('craftsmen')
          .select('id, name, email, active, created_at, updated_at')
          .eq('user_id', user.id)
          .single();
        
        debugInfo.craftsman = {
          found: !!craftsman,
          data: craftsman || null,
          error: craftsmanError ? {
            message: craftsmanError.message,
            code: craftsmanError.code,
            details: craftsmanError.details
          } : null
        };
        
        if (craftsmanError) {
          debugInfo.errors.push({
            type: 'craftsman_lookup',
            error: craftsmanError.message
          });
        }
      } catch (craftsmanErr) {
        debugInfo.errors.push({
          type: 'craftsman_exception',
          error: craftsmanErr.message
        });
      }
      
      // Test if we can create a craftsman (dry run)
      if (!debugInfo.craftsman?.found) {
        try {
          const testCraftsmanData = {
            user_id: user.id,
            name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Test User',
            email: user.email,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            active: true
          };
          
          debugInfo.craftsmanCreationTest = {
            wouldCreateWith: testCraftsmanData,
            note: "This is a dry run - no actual creation attempted"
          };
        } catch (testErr) {
          debugInfo.errors.push({
            type: 'craftsman_creation_test',
            error: testErr.message
          });
        }
      }
    } else {
      debugInfo.errors.push({
        type: 'authentication',
        error: 'No authenticated user found'
      });
    }
    
    // Add environment info (without sensitive data)
    debugInfo.environment = {
      hasSupabaseUrl: !!(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),
      hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasAnonKey: !!(process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      nodeEnv: process.env.NODE_ENV
    };
    
    console.log(`${ROUTE_NAME} - Debug info compiled:`, {
      hasUser: debugInfo.authentication.hasUser,
      hasCraftsman: debugInfo.craftsman?.found,
      errorCount: debugInfo.errors.length
    });
    
    return handleApiSuccess(debugInfo, 'Debug information retrieved successfully');
    
  } catch (err) {
    console.error(`${ROUTE_NAME} - Debug error:`, err);
    return handleApiError(err.message, 'Error retrieving debug information', 500, ROUTE_NAME);
  }
}
