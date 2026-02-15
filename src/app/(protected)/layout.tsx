import { requireSession } from '@/services/auth/requireSession';
import { PageShell } from '@/widgets/PageShell';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireSession();

  return <PageShell email={user.email}>{children}</PageShell>;
}
