'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Create auth context
const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  
  // Initialize Supabase auth - with dynamic import for SSR compatibility
  useEffect(() => {
    // Only run on client-side
    if (typeof window === 'undefined') return;
    
    const initializeAuth = async () => {
      setLoading(true);
      
      // Dynamically import supabase client to avoid SSR issues
      const { supabase } = await import('../utils/supabase-client');
      
      try {
        // Get session from Supabase
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error retrieving session:', error);
        } else {
          setSession(data.session);
          setUser(data.session?.user || null);
        }
        
        // Set up auth state listener
        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
          setSession(session);
          setUser(session?.user || null);
        });
        
        // Cleanup subscription on unmount
        return () => {
          authListener.subscription.unsubscribe();
        };
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        setLoading(false);
      }
    };
    
    initializeAuth();
  }, []);

  // Sign in with email and password
  const signIn = async (email, password) => {
    try {
      // Dynamically import supabase client
      const { supabase } = await import('../utils/supabase-client');
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  };

  // Sign up with email and password
  const signUp = async (email, password, userData) => {
    try {
      // Dynamically import supabase client
      const { supabase } = await import('../utils/supabase-client');
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: userData // Store user metadata
        }
      });
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error signing up:', error);
      throw error;
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      // Dynamically import supabase client
      const { supabase } = await import('../utils/supabase-client');
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.push('/auth/login');
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  // Request password reset
  const resetPassword = async (email) => {
    try {
      // Dynamically import supabase client
      const { supabase } = await import('../utils/supabase-client');
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error requesting password reset:', error);
      throw error;
    }
  };

  // Update user profile
  const updateProfile = async (userData) => {
    try {
      // Dynamically import supabase client
      const { supabase } = await import('../utils/supabase-client');
      const { error } = await supabase.auth.updateUser({
        data: userData
      });
      
      if (error) throw error;
      
      // Update the local user state with the new data
      setUser({ ...user, user_metadata: { ...user.user_metadata, ...userData } });
      return true;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  };

  // Get current user with fresh data
  const refreshUser = async () => {
    try {
      // Dynamically import supabase client
      const { supabase } = await import('../utils/supabase-client');
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error) throw error;
      
      setUser(user);
      return user;
    } catch (error) {
      console.error('Error refreshing user:', error);
      throw error;
    }
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updateProfile,
    refreshUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
