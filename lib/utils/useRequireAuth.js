import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Hook that ensures a user is authenticated before allowing the page to continue.
 * If the user is not logged in (and the initial auth check has completed) the
 * browser is redirected to the supplied `redirectPath` (default `/auth/login`).
 *
 * Returns the same `{ user, loading }` shape as `useAuth`, making this a drop-in
 * replacement for pages that need the redirect side-effect.
 */
export function useRequireAuth(redirectPath = '/auth/login') {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push(redirectPath);
    }
  }, [loading, user, redirectPath, router]);

  return { user, loading };
}
