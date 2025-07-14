import { useAuth } from '../../contexts/AuthContext';
import { createClient } from '@supabase/supabase-js';

// Fallback values if needed
const FALLBACK_SUPABASE_URL = 'https://xnsymruxpuxjmfqajdjg.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhuc3ltcnV4cHV4am1mcWFqZGpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4ODQwMzYsImV4cCI6MjA2NjQ2MDAzNn0.U2k-zp0Pz5OVW3bX4rgdTT2m0MP4ANMbS-6GU43FUZY';

// Hook returns a fetch wrapper that automatically attaches the user's JWT
export function useAuthedFetch() {
  // Get both user and session to handle cases where session might be incomplete
  const { user, session } = useAuth();

  return async (input, init = {}) => {
    try {
      // Try multiple methods to get the access token
      let token = session?.access_token;
      
      // Log the authentication state for debugging
      console.log('Auth state for fetch request:', {
        hasSession: !!session,
        hasUser: !!user,
        hasToken: !!token,
        endpoint: input,
        userId: user?.id,
        userEmail: user?.email
      });
      
      // If token not found in session, try to get a fresh one
      if (!token && user) {
        console.log('Token not found in session, trying to get a fresh one...');
        
        // Create a new Supabase client to get a fresh session
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY,
          { auth: { persistSession: true } }
        );
        
        try {
          const { data, error } = await supabase.auth.getSession();
          if (error) {
            console.error('Error getting fresh session:', error);
          } else {
            token = data?.session?.access_token;
            console.log('Retrieved fresh token:', {
              success: !!token,
              tokenPrefix: token ? `${token.substring(0, 10)}...` : 'none',
              sessionUser: data?.session?.user?.id
            });
          }
        } catch (sessionError) {
          console.error('Exception getting fresh session:', sessionError);
        }
      }
      
      // If still no token but we have a user, this is a problem
      if (!token && user) {
        console.error('WARNING: User exists but no token available for API call:', {
          userId: user.id,
          userEmail: user.email,
          endpoint: input
        });
      }
      
      // Build headers with token if available
      const headers = {
        'Content-Type': 'application/json',
        ...(init.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };
      
      // Make the fetch request with auth headers
      const res = await fetch(input, { ...init, headers });
      
      // For debugging, log the response status
      console.log(`Fetch ${init.method || 'GET'} ${input} response:`, {
        status: res.status,
        ok: res.ok,
        hasAuthHeader: !!token,
        statusText: res.statusText
      });
      
      // If we get a 401, log additional debug info
      if (res.status === 401) {
        console.error('401 Unauthorized response:', {
          endpoint: input,
          hasToken: !!token,
          hasUser: !!user,
          userId: user?.id,
          tokenPrefix: token ? `${token.substring(0, 10)}...` : 'none'
        });
      }
      
      return res;
    } catch (err) {
      console.error('Error in authed fetch:', err);
      // If authentication fails, try unauthenticated as a fallback
      return fetch(input, init);
    }
  };
}
