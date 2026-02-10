import { z } from 'zod';

const userRoleEnum = z.enum([
  'ADMIN', 'PROJECT_LEAD', 'OPERATIONS_MANAGER', 'MANAGER', 'SUPERVISOR', 'OBSERVER', 'CLEANER'
]);

const servicePointTypeEnum = z.enum(['ATM', 'BUS_STOP']);

export const createUserBodySchema = z.object({
  username: z.string().min(1, 'Username is required'),
  email: z.string().email().optional().or(z.literal('')),
  password: z.string().min(1, 'Password is required'),
  role: userRoleEnum,
  companyId: z.string().optional().nullable(),
});

export const updateUserBodySchema = z.object({
  username: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal('')),
  role: userRoleEnum.optional(),
  companyId: z.string().optional().nullable(),
});

export const userIdParamSchema = z.object({
  id: z.string().min(1, 'User id is required'),
});

export const createCompanyBodySchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  description: z.string().optional(),
  address: z.string().optional(),
});

export const updateCompanyBodySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  address: z.string().optional(),
});

export const companyIdParamSchema = z.object({
  id: z.string().min(1, 'Company id is required'),
});

export const createServicePointBodySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: servicePointTypeEnum.default('ATM'),
  address: z.string().min(1, 'Address is required'),
  latitude: z.union([z.number(), z.string()]).transform((v) => typeof v === 'string' ? parseFloat(v) : v).refine((n) => !Number.isNaN(n), 'Invalid latitude'),
  longitude: z.union([z.number(), z.string()]).transform((v) => typeof v === 'string' ? parseFloat(v) : v).refine((n) => !Number.isNaN(n), 'Invalid longitude'),
  companyId: z.string().min(1, 'Company is required'),
});

export const updateServicePointBodySchema = z.object({
  name: z.string().min(1).optional(),
  type: servicePointTypeEnum.optional(),
  address: z.string().min(1).optional(),
  latitude: z.union([z.number(), z.string()]).optional().transform((v) => v === undefined ? undefined : (typeof v === 'string' ? parseFloat(v) : v)).refine((n) => n === undefined || !Number.isNaN(n), 'Invalid latitude'),
  longitude: z.union([z.number(), z.string()]).optional().transform((v) => v === undefined ? undefined : (typeof v === 'string' ? parseFloat(v) : v)).refine((n) => n === undefined || !Number.isNaN(n), 'Invalid longitude'),
  companyId: z.string().optional().nullable(),
});

export const servicePointIdParamSchema = z.object({
  id: z.string().min(1, 'Service point id is required'),
});

export const assignPointsBodySchema = z.object({
  pointIds: z.array(z.string().min(1)).default([]),
});

export type CreateUserBody = z.infer<typeof createUserBodySchema>;
export type UpdateUserBody = z.infer<typeof updateUserBodySchema>;
export type CreateCompanyBody = z.infer<typeof createCompanyBodySchema>;
export type UpdateCompanyBody = z.infer<typeof updateCompanyBodySchema>;
export type CreateServicePointBody = z.infer<typeof createServicePointBodySchema>;
export type UpdateServicePointBody = z.infer<typeof updateServicePointBodySchema>;
export type AssignPointsBody = z.infer<typeof assignPointsBodySchema>;
