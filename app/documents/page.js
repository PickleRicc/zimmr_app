'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '../../lib/utils/useRequireAuth';

export default function DocumentsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useRequireAuth();

  useEffect(() => {
    if (!authLoading && user) {
      // Redirect to customers view as the main documents view
      router.replace('/documents/customers');
    }
  }, [authLoading, user, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 flex items-center justify-center">
        <div className="text-white">Laden...</div>
      </div>
    );
  }

  return null; // This component will redirect, so no UI needed
}
