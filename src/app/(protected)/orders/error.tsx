'use client';

import { Button } from '@/shared/ui/Button';

export default function OrdersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="max-w-5xl mx-auto py-8 px-4">
      <div className="text-center space-y-4">
        <h2 className="text-xl font-semibold text-red-600">
          Something went wrong
        </h2>
        <p className="text-gray-600">{error.message}</p>
        <Button onClick={reset} variant="secondary">
          Try again
        </Button>
      </div>
    </main>
  );
}
