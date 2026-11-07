import { Hono } from '@hono/hono';
import { zValidator } from '../lib/zvalidator.ts';
import { z } from 'zod';
import { db } from '../db/connection.ts';
import { artists, tracks, users } from '../db/schema.ts';
import { eq, desc, asc, and, or, ilike, sql, count } from 'drizzle-orm';
import { verifyAuth, requireAdmin } from '../middleware/auth.ts';

// Use any for context to bypass Hono 4.13 strict typing issues
const artistsRoute = new Hono<any>();

const createArtistSchema = z.object({
  userId: z.string().uuid().optional().nullable(),
  name: z.string().min(1).max(100),
  bio: z.string().optional().nullable(),
  coverUrl: z.string().url().optional().nullable(),
  socialLinks: z.record(z.string()).default({}),
});

const updateArtistSchema = createArtistSchema.partial();

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sort: z.enum(['createdAt', 'name', 'likes']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(),
  verified: z.coerce.boolean().optional(),
});

// GET /artists - List artists
artistsRoute.get('/', zValidator('query', querySchema), async (c) => {
  try {
    const { page, limit, sort, order, search, verified } = c.req.valid('query');
    const offset = (page - 1) * limit;

    const conditions = [];
    if (search) {
      conditions.push(ilike(artists.name, `%${search}%`));
    }
    if (verified !== undefined) {
      conditions.push(eq(artists.isVerified, verified));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const sortColumn = sort === 'name' ? artists.name : sort === 'likes' ? artists.likes : artists.createdAt;
    const orderFn = order === 'asc' ? asc : desc;

    const [items, totalResult] = await Promise.all([
      db.select({
        id: artists.id,
        userId: artists.userId,
        name: artists.name,
        bio: artists.bio,
        coverUrl: artists.coverUrl,
        socialLinks: artists.socialLinks,
        likes: artists.likes,
        isVerified: artists.isVerified,
        createdAt: artists.createdAt,
        updatedAt: artists.updatedAt,
        user: {
          id: users.id,
          email: users.email,
          name: users.name,
        },
        _count: {
          tracks: sql<number>`(SELECT COUNT(*) FROM ${tracks} WHERE ${tracks.artistId} = ${artists.id})`,
        },
      })
        .from(artists)
        .leftJoin(users, eq(artists.userId, users.id))
        .where(whereClause)
        .orderBy(orderFn(sortColumn))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(artists).where(whereClause),
    ]);

    const total = totalResult[0]?.count || 0;
    const totalPages = Math.ceil(total / limit);

    return c.json({
      items,
      pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    });
  } catch (error) {
    console.error('Error fetching artists:', error);
    return c.json({ error: 'Failed to fetch artists' }, 500);
  }
});

// GET /artists/:id - Get single artist with tracks
artistsRoute.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const artist = await db.query.artists.findFirst({
      where: eq(artists.id, id),
      with: {
        user: true,
        tracks: {
          orderBy: desc(tracks.createdAt),
          limit: 20,
        },
      },
    });

    if (!artist) {
      return c.json({ error: 'Artist not found' }, 404);
    }

    return c.json(artist);
  } catch (error) {
    console.error('Error fetching artist:', error);
    return c.json({ error: 'Failed to fetch artist' }, 500);
  }
});

// POST /artists - Create artist (admin only)
artistsRoute.post('/', verifyAuth, requireAdmin, zValidator('json', createArtistSchema), async (c) => {
  try {
    const data = c.req.valid('json');
    const [artist] = await db.insert(artists).values(data).returning();
    return c.json(artist, 201);
  } catch (error) {
    console.error('Error creating artist:', error);
    return c.json({ error: 'Failed to create artist' }, 500);
  }
});

// PUT /artists/:id - Update artist (admin only)
artistsRoute.put('/:id', verifyAuth, requireAdmin, zValidator('json', updateArtistSchema), async (c) => {
  try {
    const id = c.req.param('id');
    const data = c.req.valid('json');
    const [artist] = await db.update(artists)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(artists.id, id))
      .returning();

    if (!artist) return c.json({ error: 'Artist not found' }, 404);
    return c.json(artist);
  } catch (error) {
    console.error('Error updating artist:', error);
    return c.json({ error: 'Failed to update artist' }, 500);
  }
});

// DELETE /artists/:id - Delete artist (admin only)
artistsRoute.delete('/:id', verifyAuth, requireAdmin, async (c) => {
  try {
    const id = c.req.param('id');
    const result = await db.delete(artists).where(eq(artists.id, id)).returning({ id: artists.id });
    if (!result.length) return c.json({ error: 'Artist not found' }, 404);
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting artist:', error);
    return c.json({ error: 'Failed to delete artist' }, 500);
  }
});

export default artistsRoute;