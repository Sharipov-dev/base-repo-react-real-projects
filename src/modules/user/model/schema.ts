import { z } from 'zod';

export const userDTOSchema = z.object({
  id: z.string(),
  email: z.string(),
  full_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type ValidatedUserDTO = z.infer<typeof userDTOSchema>;
