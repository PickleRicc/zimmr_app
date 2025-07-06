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
        endpoint: input
      });
      
      // If token not found in session, try to get a fresh one
      if (!token && (user || session)) {
        console.log('Token not found in session, trying to get a fresh one...');
        
        // Create a new Supabase client to get a fresh session
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY,
          { auth: { persistSession: true } }
        );
        
        const { data } = await supabase.auth.getSession();
        token = data?.session?.access_token;
        
        console.log('Retrieved fresh token:', {
          success: !!token,
          tokenPrefix: token ? `${token.substring(0, 10)}...` : 'none'
        });
      }
      
      // Build headers with token if available
      const headers = {
        ...(init.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };
      
      // Make the fetch request with auth headers
      const res = await fetch(input, { ...init, headers });
      
      // For debugging, log the response status
      console.log(`Fetch ${init.method || 'GET'} ${input} response:`, {
        status: res.status,
        ok: res.ok,
        hasAuthHeader: !!token
      });
      
      return res;
    } catch (err) {
      console.error('Error in authed fetch:', err);
      // If authentication fails, try unauthenticated as a fallback
      return fetch(input, init);
    }
  };
}
