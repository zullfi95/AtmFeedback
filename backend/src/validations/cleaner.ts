import { z } from 'zod';

export const taskIdParamSchema = z.object({
  id: z.string().min(1, 'Task id is required'),
});

export const servicePointIdParamSchema = z.object({
  servicePointId: z.string().min(1, 'Service point id is required'),
});

export const completeTaskBodySchema = z.object({
  notes: z.string().optional().nullable(),
});

export type CompleteTaskBody = z.infer<typeof completeTaskBodySchema>;
