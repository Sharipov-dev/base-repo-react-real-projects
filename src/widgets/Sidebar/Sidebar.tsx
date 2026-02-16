import Link from 'next/link';
import { ROUTES } from '@/shared/config/routes';

const navItems = [
  { label: 'Dashboard', href: ROUTES.dashboard },
  { label: 'Settings', href: ROUTES.settings },
];

export function Sidebar() {
  return (
    <aside className="flex w-56 flex-col border-r border-gray-200 bg-white py-4">
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
