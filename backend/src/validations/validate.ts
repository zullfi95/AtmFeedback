import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Validates req.body with the given schema. On success assigns parsed value to req.body and calls next().
 * On error sends 400 with first error message or formatted Zod errors.
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (result.success) {
      req.body = result.data;
      next();
      return;
    }
    const err = result.error as ZodError;
    const first = err.issues[0];
    const message = first ? `${first.path.length ? first.path.join('.') + ': ' : ''}${first.message}` : 'Validation failed';
    res.status(400).json({ error: message });
  };
}

/**
 * Validates req.params with the given schema. On success assigns parsed value to req.params and calls next().
 */
export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (result.success) {
      req.params = { ...req.params, ...result.data } as typeof req.params;
      next();
      return;
    }
    const err = result.error as ZodError;
    const first = err.issues[0];
    const message = first ? first.message : 'Invalid parameters';
    res.status(400).json({ error: message });
  };
}
