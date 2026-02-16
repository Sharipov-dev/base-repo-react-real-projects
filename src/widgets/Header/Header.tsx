'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/services/supabase/client';
import { Button } from '@/shared/ui/Button';
import { ROUTES } from '@/shared/config/routes';

interface HeaderProps {
  email?: string | null;
}

export function Header({ email }: HeaderProps) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(ROUTES.login);
    router.refresh();
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div className="flex items-center gap-4">
        <span className="text-lg font-semibold text-gray-900">RoadTrack</span>
      </div>
      <div className="flex items-center gap-4">
        {email && (
          <span className="text-sm text-gray-500">{email}</span>
        )}
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          Logout
        </Button>
      </div>
    </header>
  );
}
