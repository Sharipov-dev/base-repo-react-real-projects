import { requireSession } from '@/services/auth/requireSession';

export default async function DashboardPage() {
  const { user } = await requireSession();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="text-gray-600">
        Welcome, <span className="font-medium">{user.email}</span>
      </p>
    </div>
  );
}
