import { Header } from '@/widgets/Header';
import { Sidebar } from '@/widgets/Sidebar';

interface PageShellProps {
  email?: string | null;
  children: React.ReactNode;
}

export function PageShell({ email, children }: PageShellProps) {
  return (
    <div className="flex h-screen flex-col">
      <Header email={email} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
