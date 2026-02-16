'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/services/supabase/client';
import { ROUTES } from '@/shared/config/routes';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    // The Supabase client automatically exchanges the code from the URL hash.
    // We just wait for the session to be established and redirect.
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        router.push(ROUTES.dashboard);
        router.refresh();
      }
    });
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-gray-500">Completing sign in...</p>
    </div>
  );
}
