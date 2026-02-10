import type { User } from '@/entities/user';
import type { Order } from '@/entities/order';

// --- User DTO mapping ---

/** Raw user shape from the backend API */
export interface UserDTO {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export function mapUserDTO(dto: UserDTO): User {
  return {
    id: dto.id,
    email: dto.email,
    fullName: dto.full_name,
    avatarUrl: dto.avatar_url,
    createdAt: dto.created_at,
  };
}

// --- Order DTO mapping ---

/** Raw order shape from the backend API */
export interface OrderDTO {
  id: string;
  title: string;
  status: string;
  total_price: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export function mapOrderDTO(dto: OrderDTO): Order {
  return {
    id: dto.id,
    title: dto.title,
    status: dto.status as Order['status'],
    totalPrice: dto.total_price,
    currency: dto.currency,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}
