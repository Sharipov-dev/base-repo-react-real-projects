import { requireSession } from '@/features/auth/api/auth.server';
import { OrdersTable } from '@/features/orders';

export default async function OrdersPage() {
  // Ensure user is authenticated; redirects to /login if not
  await requireSession();

  return (
    <main className="max-w-5xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Orders</h1>
      <OrdersTable />
    </main>
  );
}
