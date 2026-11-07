import { Hono } from '@hono/hono';
import { zValidator } from '../lib/zvalidator.ts';
import { z } from 'zod';
import { db } from '../db/connection.ts';
import { tracks, radioQueue, artists } from '../db/schema.ts';
import { eq, desc, asc, and, lt, gt, sql } from 'drizzle-orm';
import { RadioScheduler, RadioNowService, type Track } from '../services/radio-scheduler.ts';

// Use any for context to bypass Hono 4.13 strict typing issues
const radioRoute = new Hono<any>();

// RadioNow query params
const radioNowQuerySchema = z.object({
  count: z.coerce.number().int().positive().max(60).default(12),
  at: z.coerce.number().optional(),
  backMs: z.coerce.number().int().min(0).default(0),
});

// Helper: fetch tracks with artist names for scheduler
async function fetchSchedulerTracks(): Promise<Track[]> {
  const rows = await db.select({
    id: tracks.id,
    title: tracks.title,
    artistId: tracks.artistId,
    artistName: artists.name,
    coverUrl: tracks.coverUrl,
    genre: tracks.genre,
    duration: tracks.duration,
    durationSeconds: tracks.durationSeconds,
    audioUrl: tracks.audioUrl,
    likes: tracks.likes,
    language: tracks.language,
    createdAt: tracks.createdAt,
  })
    .from(tracks)
    .leftJoin(artists, eq(tracks.artistId, artists.id))
    .orderBy(desc(tracks.createdAt));

  return rows.map(t => ({
    id: t.id,
    title: t.title,
    artist: t.artistName || 'Unknown Artist',
    cover_url: t.coverUrl || undefined,
    genre: t.genre,
    duration: t.duration || undefined,
    durationSeconds: t.durationSeconds || undefined,
    audio_url: t.audioUrl,
    likes: t.likes,
    language: t.language,
    created_date: t.createdAt.toISOString(),
  })).filter(t => t.audio_url);
}

// GET /radio/now - Get current and upcoming tracks (public)
radioRoute.get('/now', zValidator('query', radioNowQuerySchema), async (c) => {
  try {
    const { count, at, backMs } = c.req.valid('query');

    const schedulerTracks = await fetchSchedulerTracks();

    if (schedulerTracks.length === 0) {
      return c.json({
        serverTime: Date.now(),
        tracks: [],
      }, {
        headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }
      });
    }

    const radioNow = new RadioNowService(schedulerTracks);
    const response = await radioNow.getNow(count, at, backMs);

    return c.json(response, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }
    });
  } catch (error) {
    console.error('Error in radio/now:', error);
    return c.json({ error: 'Failed to get radio schedule' }, 500);
  }
});

// RadioQueue generation endpoint (admin or scheduled job)
const radioQueueGenerateSchema = z.object({
  force: z.boolean().default(false),
});

// POST /radio/queue/generate - Generate/update radio queue (admin or cron)
radioRoute.post('/queue/generate', zValidator('json', radioQueueGenerateSchema), async (c) => {
  try {
    const { force } = c.req.valid('json');
    const now = Date.now();

    const schedulerTracks = await fetchSchedulerTracks();

    if (schedulerTracks.length === 0) {
      return c.json({ ok: false, reason: 'sin canciones' });
    }

    const scheduler = new RadioScheduler(schedulerTracks);

    // Load existing queue
    const existingRows = await db.select().from(radioQueue)
      .orderBy(desc(radioQueue.seq))
      .limit(300);

    const existingEntries = existingRows
      .sort((a, b) => a.seq - b.seq)
      .map(row => ({
        seq: row.seq,
        kind: row.kind,
        track_id: row.trackId,
        title: row.title,
        artist: row.artist,
        genre: row.genre,
        language: row.language,
        audio_url: row.audioUrl,
        cover_url: row.coverUrl,
        duration: row.duration,
        durationMs: row.durationMs,
        startsAt: new Date(row.startsAt),
        endsAt: new Date(row.endsAt),
        slotKey: row.slotKey,
        cycle: row.cycle,
        position: row.position,
        order: row.order,
      }));

    // Filter out future entries that don't match current schedule
    const validEntries = existingEntries.filter(e => {
      if (e.startsAt > now) {
        const { slotKey } = scheduler['slotAt'](e.startsAt.getTime());
        return e.slotKey === slotKey;
      }
      return true;
    });

    // Generate full queue
    const { entries, seeded } = scheduler.generateFullQueue(now, validEntries);

    // Persist new entries
    const newEntries = entries.slice(validEntries.length);
    let created = 0;
    if (newEntries.length > 0) {
      await db.insert(radioQueue).values(newEntries.map(e => ({
        seq: e.seq,
        kind: e.kind,
        trackId: e.track_id,
        title: e.title,
        artist: e.artist,
        genre: e.genre,
        language: e.language,
        audioUrl: e.audio_url,
        coverUrl: e.cover_url,
        duration: e.duration,
        durationMs: e.durationMs,
        startsAt: e.startsAt,
        endsAt: e.endsAt,
        slotKey: e.slotKey,
        cycle: e.cycle,
        position: e.position,
        order: e.order,
      })));
      created = newEntries.length;
    }

    // Prune old entries
    const cutoff = new Date(now - 3 * 3600 * 1000);
    const deletedResult = await db.delete(radioQueue).where(lt(radioQueue.endsAt, cutoff));

    const lastEntry = entries[entries.length - 1];
    const aheadMinutes = lastEntry ? Math.round((lastEntry.endsAt.getTime() - now) / 60000) : 0;

    return c.json({
      ok: true,
      seeded,
      created,
      pruned: deletedResult.rowCount || 0,
      lastEndsAt: lastEntry?.endsAt.getTime(),
      aheadMinutes,
    });
  } catch (error) {
    console.error('Error generating radio queue:', error);
    return c.json({ error: 'Failed to generate radio queue' }, 500);
  }
});

// GET /radio/queue - Get raw queue entries (for debugging)
radioRoute.get('/queue', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '50');
    const fromSeq = parseInt(c.req.query('fromSeq') || '0');

    let query = db.select().from(radioQueue)
      .orderBy(asc(radioQueue.seq))
      .limit(limit);

    if (fromSeq > 0) {
      query = query.where(gt(radioQueue.seq, fromSeq));
    }

    const items = await query;
    return c.json({ items });
  } catch (error) {
    console.error('Error fetching radio queue:', error);
    return c.json({ error: 'Failed to fetch radio queue' }, 500);
  }
});

// GET /radio/current - Get currently playing track (lightweight)
radioRoute.get('/current', async (c) => {
  try {
    const now = Date.now();

    // Try to get from persisted queue first
    const currentEntry = await db.select().from(radioQueue)
      .where(and(
        lt(radioQueue.startsAt, new Date(now)),
        gt(radioQueue.endsAt, new Date(now))
      ))
      .orderBy(desc(radioQueue.startsAt))
      .limit(1);

    if (currentEntry.length > 0) {
      const entry = currentEntry[0];
      const offsetMs = now - entry.startsAt.getTime();
      return c.json({
        track: {
          id: entry.trackId,
          title: entry.title,
          artist: entry.artist,
          genre: entry.genre,
          language: entry.language,
          audio_url: entry.audioUrl,
          cover_url: entry.coverUrl,
          duration: entry.duration,
        },
        offsetMs,
        startsAt: entry.startsAt.getTime(),
        endsAt: entry.endsAt.getTime(),
        serverTime: now,
      });
    }

    // Fallback to scheduler
    const schedulerTracks = await fetchSchedulerTracks();

    if (schedulerTracks.length === 0) {
      return c.json({ error: 'No tracks available' }, 404);
    }

    const scheduler = new RadioScheduler(schedulerTracks);
    const { schedule, index, offset } = scheduler.findLegacyPosition(now);
    const current = schedule[index];

    return c.json({
      track: {
        id: current.track.id,
        title: current.track.title,
        artist: current.track.artist,
        genre: current.track.genre,
        language: current.track.language,
        audio_url: current.track.audio_url,
        cover_url: current.track.cover_url,
        duration: current.track.duration,
      },
      offsetMs: offset * 1000,
      serverTime: now,
    });
  } catch (error) {
    console.error('Error fetching current track:', error);
    return c.json({ error: 'Failed to get current track' }, 500);
  }
});

export default radioRoute;