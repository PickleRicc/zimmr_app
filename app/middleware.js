'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { hasAuthToken } from '../utils/auth-helpers';

export function OnboardingMiddleware({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, session, loading, refreshUser } = useAuth();
  const [isChecking, setIsChecking] = useState(true);
  
  useEffect(() => {
    // Skip middleware for auth pages
    if (pathname.startsWith('/auth')) {
      setIsChecking(false);
      return;
    }

    // Quick preliminary check for token existence to prevent flash of login redirect
    const hasToken = hasAuthToken();
    
    const handleAuth = async () => {
      try {
        // If we're still loading auth state, wait
        if (loading) return;
        
        // Debug info
        console.log('Middleware Auth state:', { 
          hasToken, 
          user: user ? { id: user.id, email: user.email } : 'null',
          session: session ? { hasAccessToken: !!session.access_token } : 'null',
          loading,
          pathname,
          timestamp: new Date().toISOString()
        });

        // If no session but we have a token, try refreshing the user
        // This helps when auth context hasn't fully loaded but token exists
        if (!user && hasToken) {
          try {
            console.log('Trying to refresh user data...');
            await refreshUser();
          } catch (error) {
            console.error('Error refreshing user:', error);
          }
        }

        // Final check - if still no user after refresh attempt, redirect to login
        if (!user && !loading) {
          console.log('No authenticated user, redirecting to login');
          router.push('/auth/login');
        } else if (user) {
          console.log('User authenticated:', user.email);
        }
      } finally {
        setIsChecking(false);
      }
    };

    handleAuth();
  }, [pathname, user, session, loading, router, refreshUser]);

  // Show nothing while checking auth to prevent flash of content
  if (isChecking && !pathname.startsWith('/auth')) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-[#121212]">
        <div className="animate-pulse">
          <div className="w-12 h-12 rounded-full bg-[#ffcb00]/30"></div>
        </div>
      </div>
    );
  }

  return children;
}
