export interface AuthProfile {
  id: string;
  email: string;
  role: string;
  createdAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export type AuthRole = 'user' | 'admin';
