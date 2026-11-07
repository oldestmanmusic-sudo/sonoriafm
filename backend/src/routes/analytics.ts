import { Hono } from '@hono/hono';
import { zValidator } from '../lib/zvalidator.ts';
import { z } from 'zod';
import { verifyAuth, requireAdmin } from '../middleware/auth.ts';
import { analytics } from '../services/analytics.ts';

const analyticsRoute = new Hono<any>();

// Query schema
const analyticsQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  trackId: z.string().uuid().optional(),
  artistId: z.string().uuid().optional(),
  eventType: z.string().optional(),
  country: z.string().optional(),
  interval: z.enum(['hour', 'day', 'week', 'month']).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// POST /analytics/event - Record listen event (public, lightweight)
analyticsRoute.post('/event', zValidator('json', z.object({
  trackId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  sessionId: z.string().min(1).max(64),
  eventType: z.enum(['play', 'pause', 'end', 'skip', 'error']),
  positionMs: z.number().int().min(0).optional(),
  durationMs: z.number().int().min(0).optional(),
  userAgent: z.string().optional(),
  ipHash: z.string().max(64).optional(),
  country: z.string().length(2).optional(),
})), async (c) => {
  try {
    const event = c.req.valid('json');
    await analytics.recordEvent(event);
    return c.json({ success: true });
  } catch (error) {
    console.error('Analytics event error:', error);
    return c.json({ error: 'Failed to record event' }, 500);
  }
});

// POST /analytics/batch - Batch record events (public)
analyticsRoute.post('/batch', zValidator('json', z.object({
  events: z.array(z.object({
    trackId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),
    sessionId: z.string().min(1).max(64),
    eventType: z.enum(['play', 'pause', 'end', 'skip', 'error']),
    positionMs: z.number().int().min(0).optional(),
    durationMs: z.number().int().min(0).optional(),
    userAgent: z.string().optional(),
    ipHash: z.string().max(64).optional(),
    country: z.string().length(2).optional(),
  })).max(100),
})), async (c) => {
  try {
    const { events } = c.req.valid('json');
    await analytics.recordBatch(events);
    return c.json({ success: true, count: events.length });
  } catch (error) {
    console.error('Analytics batch error:', error);
    return c.json({ error: 'Failed to record batch' }, 500);
  }
});

// GET /analytics/realtime - Real-time stats (admin)
analyticsRoute.get('/realtime', verifyAuth, requireAdmin, async (c) => {
  try {
    const stats = await analytics.getRealtimeStats();
    return c.json(stats);
  } catch (error) {
    console.error('Realtime stats error:', error);
    return c.json({ error: 'Failed to get realtime stats' }, 500);
  }
});

// GET /analytics/tracks/:id - Track analytics (admin)
analyticsRoute.get('/tracks/:id', verifyAuth, requireAdmin, zValidator('query', analyticsQuerySchema), async (c) => {
  try {
    const trackId = c.req.param('id');
    const query = c.req.valid('query');

    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    const data = await analytics.getTrackAnalytics(trackId, { startDate, endDate });
    if (!data) return c.json({ error: 'Track not found' }, 404);

    return c.json(data);
  } catch (error) {
    console.error('Track analytics error:', error);
    return c.json({ error: 'Failed to get track analytics' }, 500);
  }
});

// GET /analytics/tracks - Top tracks analytics (admin)
analyticsRoute.get('/tracks', verifyAuth, requireAdmin, zValidator('query', analyticsQuerySchema), async (c) => {
  try {
    const query = c.req.valid('query');
    const limit = query.limit || 20;

    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    const data = await analytics.getTopTracksAnalytics({ startDate, endDate }, limit);
    return c.json({ items: data });
  } catch (error) {
    console.error('Top tracks analytics error:', error);
    return c.json({ error: 'Failed to get top tracks' }, 500);
  }
});

// GET /analytics/artists/:id - Artist analytics (admin)
analyticsRoute.get('/artists/:id', verifyAuth, requireAdmin, zValidator('query', analyticsQuerySchema), async (c) => {
  try {
    const artistId = c.req.param('id');
    const query = c.req.valid('query');

    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    const data = await analytics.getArtistAnalytics(artistId, { startDate, endDate });
    if (!data) return c.json({ error: 'Artist not found' }, 404);

    return c.json(data);
  } catch (error) {
    console.error('Artist analytics error:', error);
    return c.json({ error: 'Failed to get artist analytics' }, 500);
  }
});

// GET /analytics/timeseries - Time series data for charts (admin)
analyticsRoute.get('/timeseries', verifyAuth, requireAdmin, zValidator('query', analyticsQuerySchema.extend({
  interval: z.enum(['hour', 'day']).default('hour'),
})), async (c) => {
  try {
    const query = c.req.valid('query');
    const interval = query.interval || 'hour';

    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;
    const trackId = query.trackId;

    const data = await analytics.getTimeSeries({ startDate, endDate, trackId }, interval);
    return c.json({ items: data });
  } catch (error) {
    console.error('Timeseries error:', error);
    return c.json({ error: 'Failed to get timeseries' }, 500);
  }
});

// POST /analytics/cleanup - Clean old events (admin)
analyticsRoute.post('/cleanup', verifyAuth, requireAdmin, zValidator('json', z.object({
  olderThanDays: z.number().int().positive().default(90),
})), async (c) => {
  try {
    const { olderThanDays } = c.req.valid('json');
    const deleted = await analytics.cleanupOldEvents(olderThanDays);
    return c.json({ success: true, deleted });
  } catch (error) {
    console.error('Cleanup error:', error);
    return c.json({ error: 'Failed to cleanup' }, 500);
  }
});

export default analyticsRoute;