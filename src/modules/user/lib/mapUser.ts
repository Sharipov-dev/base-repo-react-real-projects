import type { UserDTO, User } from '../model/types';

export function mapUser(dto: UserDTO): User {
  return {
    id: dto.id,
    email: dto.email,
    fullName: dto.full_name,
    avatarUrl: dto.avatar_url,
    createdAt: new Date(dto.created_at),
    updatedAt: new Date(dto.updated_at),
  };
}
