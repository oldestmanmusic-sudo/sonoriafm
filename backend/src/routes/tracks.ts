import { Hono } from '@hono/hono';
import { zValidator } from '../lib/zvalidator.ts';
import { z } from 'zod';
import { db } from '../db/connection.ts';
import { tracks, artists, trackLikes } from '../db/schema.ts';
import { eq, desc, asc, and, or, ilike, sql, count } from 'drizzle-orm';
import { verifyAuth, requireAdmin } from '../middleware/auth.ts';

// Use any for context to bypass Hono 4.13 strict typing issues
const tracksRoute = new Hono<any>();

// Validation schemas
const createTrackSchema = z.object({
  artistId: z.string().uuid(),
  title: z.string().min(1).max(200),
  coverUrl: z.string().url().optional().nullable(),
  description: z.string().optional().nullable(),
  genre: z.enum(['electrónica', 'pop latino', 'pop rock latino', 'urbano/reguetón', 'baladas', 'pop rock', 'Otros']).default('Otros'),
  duration: z.string().regex(/^\d{1,2}:\d{2}$/).optional().nullable(), // MM:SS
  year: z.number().int().min(1900).max(2100).optional().nullable(),
  album: z.string().max(100).optional().nullable(),
  audioUrl: z.string().url(),
  language: z.enum(['Español', 'Otros idiomas']).default('Español'),
});

const updateTrackSchema = createTrackSchema.partial();

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sort: z.enum(['createdAt', 'title', 'artist', 'likes', 'playedAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  genre: z.string().optional(),
  artistId: z.string().uuid().optional(),
  search: z.string().optional(),
});

// Helper function
function parseDuration(d: string): number {
  const parts = d.split(':').map(p => parseInt(p, 10));
  if (parts.some(p => isNaN(p))) return 0;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

// GET /tracks - List tracks with pagination, filtering, sorting
tracksRoute.get('/', zValidator('query', querySchema), async (c) => {
  try {
    const { page, limit, sort, order, genre, artistId, search } = c.req.valid('query');
    const offset = (page - 1) * limit;

    const conditions = [];
    if (genre) conditions.push(eq(tracks.genre, genre as any));
    if (artistId) conditions.push(eq(tracks.artistId, artistId));
    if (search) {
      conditions.push(
        or(
          ilike(tracks.title, `%${search}%`),
          ilike(tracks.artist, `%${search}%`)
        )!
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const sortMap: Record<string, any> = {
      createdAt: tracks.createdAt,
      title: tracks.title,
      artist: tracks.artist,
      likes: tracks.likes,
      playedAt: tracks.playedAt,
    };
    const sortColumn = sortMap[sort] || tracks.createdAt;
    const orderFn = order === 'asc' ? asc : desc;

    const [items, totalResult] = await Promise.all([
      db.select({
        id: tracks.id,
        artistId: tracks.artistId,
        title: tracks.title,
        coverUrl: tracks.coverUrl,
        description: tracks.description,
        playedAt: tracks.playedAt,
        genre: tracks.genre,
        duration: tracks.duration,
        durationSeconds: tracks.durationSeconds,
        year: tracks.year,
        album: tracks.album,
        audioUrl: tracks.audioUrl,
        likes: tracks.likes,
        language: tracks.language,
        createdAt: tracks.createdAt,
        updatedAt: tracks.updatedAt,
        artist: {
          id: artists.id,
          name: artists.name,
          coverUrl: artists.coverUrl,
        },
      })
        .from(tracks)
        .leftJoin(artists, eq(tracks.artistId, artists.id))
        .where(whereClause)
        .orderBy(orderFn(sortColumn))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(tracks).where(whereClause),
    ]);

    const total = totalResult[0]?.count || 0;
    const totalPages = Math.ceil(total / limit);

    return c.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('Error fetching tracks:', error);
    return c.json({ error: 'Failed to fetch tracks' }, 500);
  }
});

// GET /tracks/:id - Get single track
tracksRoute.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const item = await db.query.tracks.findFirst({
      where: eq(tracks.id, id),
      with: {
        artist: true,
      },
    });

    if (!item) {
      return c.json({ error: 'Track not found' }, 404);
    }

    return c.json(item);
  } catch (error) {
    console.error('Error fetching track:', error);
    return c.json({ error: 'Failed to fetch track' }, 500);
  }
});

// POST /tracks - Create track (admin only)
tracksRoute.post('/', verifyAuth, requireAdmin, zValidator('json', createTrackSchema), async (c) => {
  try {
    const data = c.req.valid('json');

    // Calculate duration in seconds
    const durationSeconds = data.duration ? parseDuration(data.duration) : null;

    const [track] = await db.insert(tracks).values({
      ...data,
      durationSeconds,
    }).returning();

    return c.json(track, 201);
  } catch (error) {
    console.error('Error creating track:', error);
    return c.json({ error: 'Failed to create track' }, 500);
  }
});

// PUT /tracks/:id - Update track (admin only)
tracksRoute.put('/:id', verifyAuth, requireAdmin, zValidator('json', updateTrackSchema), async (c) => {
  try {
    const id = c.req.param('id');
    const data = c.req.valid('json');

    const updateData: typeof data = { ...data };
    if (data.duration !== undefined) {
      updateData.durationSeconds = data.duration ? parseDuration(data.duration) : null;
    }
    delete updateData.duration;

    const [track] = await db.update(tracks)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(tracks.id, id))
      .returning();

    if (!track) {
      return c.json({ error: 'Track not found' }, 404);
    }

    return c.json(track);
  } catch (error) {
    console.error('Error updating track:', error);
    return c.json({ error: 'Failed to update track' }, 500);
  }
});

// DELETE /tracks/:id - Delete track (admin only)
tracksRoute.delete('/:id', verifyAuth, requireAdmin, async (c) => {
  try {
    const id = c.req.param('id');
    const result = await db.delete(tracks).where(eq(tracks.id, id)).returning({ id: tracks.id });

    if (!result.length) {
      return c.json({ error: 'Track not found' }, 404);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting track:', error);
    return c.json({ error: 'Failed to delete track' }, 500);
  }
});

// POST /tracks/:id/like - Like/unlike track (authenticated)
tracksRoute.post('/:id/like', verifyAuth, async (c) => {
  try {
    const trackId = c.req.param('id');
    const user = c.get('user');

    // Check if track exists
    const track = await db.query.tracks.findFirst({ where: eq(tracks.id, trackId) });
    if (!track) {
      return c.json({ error: 'Track not found' }, 404);
    }

    // Check existing like
    const existingLike = await db.query.trackLikes.findFirst({
      where: and(eq(trackLikes.trackId, trackId), eq(trackLikes.userId, user.id)),
    });

    if (existingLike) {
      // Unlike
      await db.delete(trackLikes)
        .where(and(eq(trackLikes.trackId, trackId), eq(trackLikes.userId, user.id)));

      await db.update(tracks)
        .set({ likes: sql`${tracks.likes} - 1`, updatedAt: new Date() })
        .where(eq(tracks.id, trackId));

      return c.json({ liked: false, likes: track.likes - 1 });
    } else {
      // Like
      await db.insert(trackLikes).values({ trackId, userId: user.id });

      await db.update(tracks)
        .set({ likes: sql`${tracks.likes} + 1`, updatedAt: new Date() })
        .where(eq(tracks.id, trackId));

      return c.json({ liked: true, likes: track.likes + 1 });
    }
  } catch (error) {
    console.error('Error toggling like:', error);
    return c.json({ error: 'Failed to toggle like' }, 500);
  }
});

// GET /tracks/:id/likes - Get like count and user's like status
tracksRoute.get('/:id/likes', verifyAuth, async (c) => {
  try {
    const trackId = c.req.param('id');
    const user = c.get('user');

    const track = await db.query.tracks.findFirst({
      where: eq(tracks.id, trackId),
      columns: { likes: true },
    });

    if (!track) {
      return c.json({ error: 'Track not found' }, 404);
    }

    const userLike = await db.query.trackLikes.findFirst({
      where: and(eq(trackLikes.trackId, trackId), eq(trackLikes.userId, user.id)),
    });

    return c.json({
      likes: track.likes,
      liked: !!userLike,
    });
  } catch (error) {
    console.error('Error fetching likes:', error);
    return c.json({ error: 'Failed to fetch likes' }, 500);
  }
});

export default tracksRoute;