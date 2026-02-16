import Link from 'next/link';
import { ROUTES } from '@/shared/config/routes';
import { Button } from '@/shared/ui/Button';

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <h1 className="text-3xl font-bold text-gray-900">Pricing</h1>
      <p className="text-gray-600">Plans and pricing coming soon.</p>
      <Link href={ROUTES.login}>
        <Button>Get started</Button>
      </Link>
    </div>
  );
}
