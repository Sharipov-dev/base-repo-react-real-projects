import { backendFetch } from '@/services/http/backendClient';
import { userDTOSchema } from '../model/schema';
import { mapUser } from '../lib/mapUser';
import type { User } from '../model/types';

export async function getMe(accessToken: string): Promise<User> {
  const data = await backendFetch('/users/me', { accessToken });
  const dto = userDTOSchema.parse(data);
  return mapUser(dto);
}
