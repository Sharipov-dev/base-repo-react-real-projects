import type { User } from '../model/types';

interface UserCardProps {
  user: User;
}

export function UserCard({ user }: UserCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt={user.fullName ?? user.email}
            className="h-10 w-10 rounded-full"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700">
            {user.email[0].toUpperCase()}
          </div>
        )}
        <div>
          <p className="text-sm font-medium text-gray-900">
            {user.fullName ?? user.email}
          </p>
          <p className="text-xs text-gray-500">{user.email}</p>
        </div>
      </div>
    </div>
  );
}
