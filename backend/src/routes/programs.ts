import { Hono } from '@hono/hono';
import { zValidator } from '../lib/zvalidator.ts';
import { z } from 'zod';
import { db } from '../db/connection.ts';
import { programs } from '../db/schema.ts';
import { eq, desc, asc, and, sql, count } from 'drizzle-orm';
import { verifyAuth, requireAdmin } from '../middleware/auth.ts';

// Use any for context to bypass Hono 4.13 strict typing issues
const programsRoute = new Hono<any>();

const createProgramSchema = z.object({
  title: z.string().min(1).max(100),
  host: z.string().max(100).optional().nullable(),
  day: z.enum(['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  description: z.string().optional().nullable(),
  genre: z.string().max(50).optional().nullable(),
});

const updateProgramSchema = createProgramSchema.partial();

const querySchema = z.object({
  day: z.enum(['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']).optional(),
});

// GET /programs - List programs
programsRoute.get('/', zValidator('query', querySchema), async (c) => {
  try {
    const { day } = c.req.valid('query');
    const conditions = day ? [eq(programs.day, day)] : [];
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await db.select().from(programs)
      .where(whereClause)
      .orderBy(
        sql`CASE ${programs.day}
          WHEN 'Lun' THEN 1 WHEN 'Mar' THEN 2 WHEN 'Mié' THEN 3
          WHEN 'Jue' THEN 4 WHEN 'Vie' THEN 5 WHEN 'Sáb' THEN 6 WHEN 'Dom' THEN 7
          ELSE 8 END`,
        asc(programs.startTime)
      );

    return c.json({ items });
  } catch (error) {
    console.error('Error fetching programs:', error);
    return c.json({ error: 'Failed to fetch programs' }, 500);
  }
});

// GET /programs/:id
programsRoute.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const item = await db.query.programs.findFirst({ where: eq(programs.id, id) });
    if (!item) return c.json({ error: 'Program not found' }, 404);
    return c.json(item);
  } catch (error) {
    console.error('Error fetching program:', error);
    return c.json({ error: 'Failed to fetch program' }, 500);
  }
});

// POST /programs (admin)
programsRoute.post('/', verifyAuth, requireAdmin, zValidator('json', createProgramSchema), async (c) => {
  try {
    const data = c.req.valid('json');
    const [item] = await db.insert(programs).values(data).returning();
    return c.json(item, 201);
  } catch (error) {
    console.error('Error creating program:', error);
    return c.json({ error: 'Failed to create program' }, 500);
  }
});

// PUT /programs/:id (admin)
programsRoute.put('/:id', verifyAuth, requireAdmin, zValidator('json', updateProgramSchema), async (c) => {
  try {
    const id = c.req.param('id');
    const data = c.req.valid('json');
    const [item] = await db.update(programs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(programs.id, id))
      .returning();
    if (!item) return c.json({ error: 'Program not found' }, 404);
    return c.json(item);
  } catch (error) {
    console.error('Error updating program:', error);
    return c.json({ error: 'Failed to update program' }, 500);
  }
});

// DELETE /programs/:id (admin)
programsRoute.delete('/:id', verifyAuth, requireAdmin, async (c) => {
  try {
    const id = c.req.param('id');
    const result = await db.delete(programs).where(eq(programs.id, id)).returning({ id: programs.id });
    if (!result.length) return c.json({ error: 'Program not found' }, 404);
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting program:', error);
    return c.json({ error: 'Failed to delete program' }, 500);
  }
});

export default programsRoute;