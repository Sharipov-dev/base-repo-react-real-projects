import Link from 'next/link';
import { ROUTES } from '@/shared/config/routes';
import { Button } from '@/shared/ui/Button';

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900">RoadTrack</h1>
        <p className="mt-3 text-lg text-gray-600">
          Track and manage your road infrastructure with ease.
        </p>
      </div>
      <div className="flex gap-4">
        <Link href={ROUTES.login}>
          <Button>Sign in</Button>
        </Link>
        <Link href={ROUTES.pricing}>
          <Button variant="secondary">Pricing</Button>
        </Link>
      </div>
    </div>
  );
}
