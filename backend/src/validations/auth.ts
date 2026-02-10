import { z } from 'zod';

export const loginBodySchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginBody = z.infer<typeof loginBodySchema>;
