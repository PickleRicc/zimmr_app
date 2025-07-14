/**
 * Authentication debugging utilities
 * Use these functions to diagnose authentication issues
 */

import { createClient } from '@supabase/supabase-js';

const FALLBACK_SUPABASE_URL = 'https://xnsymruxpuxjmfqajdjg.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhuc3ltcnV4cHV4am1mcWFqZGpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4ODQwMzYsImV4cCI6MjA2NjQ2MDAzNn0.U2k-zp0Pz5OVW3bX4rgdTT2m0MP4ANMbS-6GU43FUZY';

/**
 * Debug current authentication state
 */
export async function debugAuthState() {
  console.log('=== AUTH DEBUG START ===');
  
  try {
    // Check environment variables
    console.log('Environment check:', {
      hasNextPublicUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasNextPublicKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasUrl: !!process.env.SUPABASE_URL,
      hasKey: !!process.env.SUPABASE_ANON_KEY,
      hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    });
    
    // Check localStorage
    if (typeof window !== 'undefined') {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || FALLBACK_SUPABASE_URL;
      const urlWithoutProtocol = supabaseUrl.replace(/^https?:\/\//, '');
      const storageKey = `sb-${urlWithoutProtocol}-auth-token`;
      
      console.log('LocalStorage check:', {
        storageKey,
        hasToken: !!localStorage.getItem(storageKey),
        allSupabaseKeys: Object.keys(localStorage).filter(key => key.startsWith('sb-'))
      });
    }
    
    // Create Supabase client and check session
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY
    );
    
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    console.log('Session check:', {
      hasSession: !!sessionData?.session,
      hasUser: !!sessionData?.session?.user,
      userId: sessionData?.session?.user?.id,
      userEmail: sessionData?.session?.user?.email,
      hasAccessToken: !!sessionData?.session?.access_token,
      tokenPrefix: sessionData?.session?.access_token ? 
        `${sessionData.session.access_token.substring(0, 10)}...` : 'none',
      sessionError: sessionError?.message
    });
    
    // Check user
    if (sessionData?.session?.access_token) {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      console.log('User check:', {
        hasUser: !!userData?.user,
        userId: userData?.user?.id,
        userEmail: userData?.user?.email,
        userError: userError?.message
      });
    }
    
  } catch (error) {
    console.error('Debug auth error:', error);
  }
  
  console.log('=== AUTH DEBUG END ===');
}

/**
 * Debug craftsman record for current user
 */
export async function debugCraftsmanRecord() {
  console.log('=== CRAFTSMAN DEBUG START ===');
  
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY
    );
    
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    
    if (!user) {
      console.log('No authenticated user found');
      return;
    }
    
    console.log('Checking craftsman record for user:', user.id);
    
    // Try to find craftsman record
    const { data: craftsman, error: craftsmanError } = await supabase
      .from('craftsmen')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    console.log('Craftsman record check:', {
      hasCraftsman: !!craftsman,
      craftsmanId: craftsman?.id,
      craftsmanName: craftsman?.name,
      craftsmanActive: craftsman?.active,
      error: craftsmanError?.message,
      errorCode: craftsmanError?.code
    });
    
    // If no craftsman found, check if we can create one
    if (!craftsman) {
      console.log('No craftsman found, checking if we can create one...');
      
      const craftsmanData = {
        user_id: user.id,
        name: user.user_metadata?.full_name || user.email || 'New User',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        active: true
      };
      
      console.log('Would create craftsman with data:', craftsmanData);
    }
    
  } catch (error) {
    console.error('Debug craftsman error:', error);
  }
  
  console.log('=== CRAFTSMAN DEBUG END ===');
}

/**
 * Test API call with current authentication
 */
export async function testApiCall(endpoint = '/api/craftsmen') {
  console.log('=== API TEST START ===');
  
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY
    );
    
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    
    console.log('Making test API call:', {
      endpoint,
      hasToken: !!token,
      tokenPrefix: token ? `${token.substring(0, 10)}...` : 'none'
    });
    
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    
    const responseText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }
    
    console.log('API call result:', {
      status: response.status,
      ok: response.ok,
      statusText: response.statusText,
      responseData
    });
    
  } catch (error) {
    console.error('API test error:', error);
  }
  
  console.log('=== API TEST END ===');
}

/**
 * Test the debug API endpoint
 */
export async function testDebugEndpoint() {
  console.log('=== DEBUG API TEST START ===');
  
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY
    );
    
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    
    console.log('Making debug API call:', {
      hasToken: !!token,
      tokenPrefix: token ? `${token.substring(0, 10)}...` : 'none'
    });
    
    const response = await fetch('/api/debug-auth', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    
    const responseData = await response.json();
    
    console.log('Debug API response:', {
      status: response.status,
      ok: response.ok,
      data: responseData
    });
    
    if (responseData.data) {
      console.log('=== DETAILED DEBUG INFO ===');
      console.log('Authentication:', responseData.data.authentication);
      console.log('Craftsman:', responseData.data.craftsman);
      console.log('Errors:', responseData.data.errors);
      console.log('Environment:', responseData.data.environment);
    }
    
  } catch (error) {
    console.error('Debug API test error:', error);
  }
  
  console.log('=== DEBUG API TEST END ===');
}

// Export all debug functions for easy access
export const debugAuth = {
  state: debugAuthState,
  craftsman: debugCraftsmanRecord,
  apiCall: testApiCall,
  debugEndpoint: testDebugEndpoint
};
