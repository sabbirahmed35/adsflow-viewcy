import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

type Source = 'body' | 'query' | 'params';

/**
 * Validate an Express request against a Zod schema.
 * Attaches the parsed (coerced + stripped) data back onto the request object.
 *
 * Usage:
 *   router.post('/ads', validate(createAdSchema), handler)
 *   router.get('/ads', validate(paginationSchema, 'query'), handler)
 */
export function validate(schema: ZodSchema, source: Source = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req[source]);
      // Replace raw input with coerced, stripped data
      (req as any)[source] = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: err.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        });
      } else {
        next(err);
      }
    }
  };
}

/**
 * Validate pagination query parameters with sensible defaults.
 */
import { z } from 'zod';

export const paginationSchema = z.object({
  page:   z.coerce.number().int().positive().default(1),
  limit:  z.coerce.number().int().positive().max(100).default(20),
  status: z.string().optional(),
  search: z.string().max(200).optional(),
});

export type PaginationQuery = z.infer<typeof paginationSchema>;
