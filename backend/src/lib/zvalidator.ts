import { validator } from '@hono/hono/validator';
import { z } from 'zod';

/**
 * Zod validator wrapper compatible with Hono 4.13+
 * Usage: zValidator('query', schema) or zValidator('json', schema)
 */
export const zValidator = (
  target: 'query' | 'json' | 'form' | 'param',
  schema: z.ZodSchema
) =>
  validator(target, (value, c) => {
    const result = schema.safeParse(value);
    if (!result.success) {
      return c.json({ error: 'Validation failed', details: result.error.flatten() }, 400);
    }
    return result.data;
  });