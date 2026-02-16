import type { AuthRole } from '../model/types';

export function hasRole(userRole: string, required: AuthRole): boolean {
  if (required === 'user') return true;
  return userRole === required;
}

export function isAdmin(role: string): boolean {
  return role === 'admin';
}
