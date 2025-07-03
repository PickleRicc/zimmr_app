/**
 * Auth helper functions to maintain consistent auth state across pages
 */

import { supabase } from './supabase-client';

/**
 * Check if the user is authenticated and return the session
 * This should be used in client components that need auth state
 */
export async function checkAuth() {
  try {
    // First try to get session from existing state
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error getting session:', error);
      return { user: null, session: null };
    }
    
    // If we have a session, get the user
    if (session) {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error('Error getting user:', userError);
        return { user: null, session: null };
      }
      
      return { user, session };
    }
    
    return { user: null, session: null };
  } catch (error) {
    console.error('Unexpected error in checkAuth:', error);
    return { user: null, session: null };
  }
}

/**
 * Check if a valid token exists in local storage
 * This is a lightweight check for client-side redirects
 */
export function hasAuthToken() {
  try {
    // Check localStorage for Supabase auth data
    // This is just a quick check - not a replacement for proper auth validation
    const hasToken = localStorage.getItem('sb-' + process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/^https?:\/\//, '') + '-auth-token');
    return !!hasToken;
  } catch (err) {
    // Handle case where localStorage is not available
    return false;
  }
}
