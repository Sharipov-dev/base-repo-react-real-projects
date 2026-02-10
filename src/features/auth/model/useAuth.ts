'use client';

import { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { login, logout } from '../api/auth.client';
import type { LoginCredentials } from '../types';

export function useAuth() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleLogin = useCallback(
    async (credentials: LoginCredentials) => {
      setError(null);
      try {
        await login(credentials);
        startTransition(() => {
          router.push('/orders');
          router.refresh();
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Login failed';
        setError(message);
      }
    },
    [router],
  );

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      startTransition(() => {
        router.push('/login');
        router.refresh();
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Logout failed';
      setError(message);
    }
  }, [router]);

  return { handleLogin, handleLogout, isPending, error };
}
