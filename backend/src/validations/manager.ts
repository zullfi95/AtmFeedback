import { z } from 'zod';

const taskStatusEnum = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE']);

export const taskIdParamSchema = z.object({
  id: z.string().min(1, 'Task id is required'),
});

export const createTaskBodySchema = z.object({
  servicePointId: z.string().min(1, 'Service Point is required'),
  cleanerId: z.string().min(1, 'Cleaner is required'),
  scheduledAt: z.string().optional(),
});

export const updateTaskBodySchema = z.object({
  servicePointId: z.string().min(1).optional(),
  cleanerId: z.string().min(1).optional(),
  scheduledAt: z.string().optional().nullable(),
  status: taskStatusEnum.optional(),
});

export const taskCommentBodySchema = z.object({
  managerNotes: z.string().min(1, 'Comment is required').transform((s) => s.trim()),
});

export const routeIdParamSchema = z.object({
  id: z.string().min(1, 'Route id is required'),
});

export const createRouteBodySchema = z.object({
  name: z.string().min(1, 'Route name is required').transform((s) => s.trim()),
  cleanerId: z.string().min(1, 'Cleaner is required'),
  servicePointIds: z.array(z.string().min(1)).default([]),
});

export const updateRouteBodySchema = z.object({
  name: z.string().min(1).transform((s) => s.trim()).optional(),
  cleanerId: z.string().min(1).optional(),
  servicePointIds: z.array(z.string().min(1)).optional(),
});

export type CreateTaskBody = z.infer<typeof createTaskBodySchema>;
export type UpdateTaskBody = z.infer<typeof updateTaskBodySchema>;
export type TaskCommentBody = z.infer<typeof taskCommentBodySchema>;
export type CreateRouteBody = z.infer<typeof createRouteBodySchema>;
export type UpdateRouteBody = z.infer<typeof updateRouteBodySchema>;
