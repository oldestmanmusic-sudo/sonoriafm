/**
 * Analytics Service - Listen events tracking and aggregation
 * Does NOT affect radio automation - only collects and aggregates listening data
 */

import { db } from '../db/connection.ts';
import { listenEvents, tracks, artists } from '../db/schema.ts';
import { eq, desc, asc, and, gte, lte, sql, count, sum, avg } from 'drizzle-orm';

export interface ListenEventInput {
  trackId?: string;
  userId?: string;
  sessionId: string;
  eventType: 'play' | 'pause' | 'end' | 'skip' | 'error';
  positionMs?: number;
  durationMs?: number;
  userAgent?: string;
  ipHash?: string;
  country?: string;
}

export interface AnalyticsQuery {
  startDate?: Date;
  endDate?: Date;
  trackId?: string;
  artistId?: string;
  eventType?: string;
  country?: string;
  interval?: 'hour' | 'day' | 'week' | 'month';
}

export interface TrackAnalytics {
  trackId: string;
  trackTitle: string;
  artistName: string;
  plays: number;
  completes: number;
  skips: number;
  errors: number;
  avgListenTimeMs: number;
  completionRate: number;
  uniqueListeners: number;
}

export interface RealtimeStats {
  currentListeners: number;
  peakListeners24h: number;
  totalPlays24h: number;
  topTracksNow: Array<{ trackId: string; title: string; artist: string; listeners: number }>;
  listenersByCountry: Record<string, number>;
}

class AnalyticsService {
  /**
   * Record a listen event
   * Lightweight - fire and forget for performance
   */
  async recordEvent(event: ListenEventInput): Promise<void> {
    try {
      await db.insert(listenEvents).values({
        trackId: event.trackId || null,
        userId: event.userId || null,
        sessionId: event.sessionId,
        eventType: event.eventType,
        positionMs: event.positionMs || null,
        durationMs: event.durationMs || null,
        userAgent: event.userAgent || null,
        ipHash: event.ipHash || null,
        country: event.country || null,
      });
    } catch (error) {
      // Don't throw - analytics should never break the radio
      console.error('Analytics record error:', error);
    }
  }

  /**
   * Batch record events (for client-side batching)
   */
  async recordBatch(events: ListenEventInput[]): Promise<void> {
    if (!events.length) return;

    try {
      await db.insert(listenEvents).values(events.map(e => ({
        trackId: e.trackId || null,
        userId: e.userId || null,
        sessionId: e.sessionId,
        eventType: e.eventType,
        positionMs: e.positionMs || null,
        durationMs: e.durationMs || null,
        userAgent: e.userAgent || null,
        ipHash: e.ipHash || null,
        country: e.country || null,
      })));
    } catch (error) {
      console.error('Analytics batch error:', error);
    }
  }

  /**
   * Get analytics for a specific track
   */
  async getTrackAnalytics(trackId: string, query: AnalyticsQuery = {}): Promise<TrackAnalytics | null> {
    const { startDate, endDate } = query;

    const conditions = [eq(listenEvents.trackId, trackId)];
    if (startDate) conditions.push(gte(listenEvents.createdAt, startDate));
    if (endDate) conditions.push(lte(listenEvents.createdAt, endDate));

    const whereClause = and(...conditions);

    const stats = await db.select({
      plays: count(sql`CASE WHEN ${listenEvents.eventType} = 'play' THEN 1 END`),
      completes: count(sql`CASE WHEN ${listenEvents.eventType} = 'end' THEN 1 END`),
      skips: count(sql`CASE WHEN ${listenEvents.eventType} = 'skip' THEN 1 END`),
      errors: count(sql`CASE WHEN ${listenEvents.eventType} = 'error' THEN 1 END`),
      avgListenTime: avg(sql`CASE WHEN ${listenEvents.eventType} = 'end' THEN ${listenEvents.durationMs} END`),
      uniqueListeners: count(sql`DISTINCT ${listenEvents.sessionId}`),
    }).from(listenEvents).where(whereClause);

    // Get track info
    const track = await db.select({
      id: tracks.id,
      title: tracks.title,
      artist: { name: artists.name },
    })
      .from(tracks)
      .leftJoin(artists, eq(tracks.artistId, artists.id))
      .where(eq(tracks.id, trackId))
      .limit(1);

    if (!track.length) return null;

    const s = stats[0];
    const plays = Number(s.plays) || 0;
    const completes = Number(s.completes) || 0;

    return {
      trackId,
      trackTitle: track[0].title,
      artistName: track[0].artist?.name || 'Unknown',
      plays,
      completes,
      skips: Number(s.skips) || 0,
      errors: Number(s.errors) || 0,
      avgListenTimeMs: Number(s.avgListenTime) || 0,
      completionRate: plays > 0 ? completes / plays : 0,
      uniqueListeners: Number(s.uniqueListeners) || 0,
    };
  }

  /**
   * Get analytics for multiple tracks (top tracks)
   */
  async getTopTracksAnalytics(query: AnalyticsQuery = {}, limit: number = 20): Promise<TrackAnalytics[]> {
    const { startDate, endDate, interval = 'day' } = query;

    const conditions = [];
    if (startDate) conditions.push(gte(listenEvents.createdAt, startDate));
    if (endDate) conditions.push(lte(listenEvents.createdAt, endDate));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get track stats
    const trackStats = await db.select({
      trackId: listenEvents.trackId,
      plays: count(sql`CASE WHEN ${listenEvents.eventType} = 'play' THEN 1 END`),
      completes: count(sql`CASE WHEN ${listenEvents.eventType} = 'end' THEN 1 END`),
      skips: count(sql`CASE WHEN ${listenEvents.eventType} = 'skip' THEN 1 END`),
      errors: count(sql`CASE WHEN ${listenEvents.eventType} = 'error' THEN 1 END`),
      avgListenTime: avg(sql`CASE WHEN ${listenEvents.eventType} = 'end' THEN ${listenEvents.durationMs} END`),
      uniqueListeners: count(sql`DISTINCT ${listenEvents.sessionId}`),
    })
      .from(listenEvents)
      .where(and(whereClause, sql`${listenEvents.trackId} IS NOT NULL`))
      .groupBy(listenEvents.trackId)
      .orderBy(desc(count()))
      .limit(limit);

    if (!trackStats.length) return [];

    // Get track info
    const trackIds = trackStats.map(s => s.trackId).filter(Boolean) as string[];
    const trackInfo = await db.select({
      id: tracks.id,
      title: tracks.title,
      artist: { name: artists.name },
    })
      .from(tracks)
      .leftJoin(artists, eq(tracks.artistId, artists.id))
      .where(sql`${tracks.id} IN (${sql.join(trackIds.map(id => sql`${id}`), sql`, `)})`);

    const infoMap = new Map(trackInfo.map(t => [t.id, t]));

    return trackStats.map(s => {
      const info = infoMap.get(s.trackId!);
      const plays = Number(s.plays) || 0;
      const completes = Number(s.completes) || 0;

      return {
        trackId: s.trackId!,
        trackTitle: info?.title || 'Unknown',
        artistName: info?.artist?.name || 'Unknown',
        plays,
        completes,
        skips: Number(s.skips) || 0,
        errors: Number(s.errors) || 0,
        avgListenTimeMs: Number(s.avgListenTime) || 0,
        completionRate: plays > 0 ? completes / plays : 0,
        uniqueListeners: Number(s.uniqueListeners) || 0,
      };
    });
  }

  /**
   * Get artist analytics
   */
  async getArtistAnalytics(artistId: string, query: AnalyticsQuery = {}): Promise<{
    artistId: string;
    artistName: string;
    totalPlays: number;
    totalListeners: number;
    topTracks: TrackAnalytics[];
  } | null> {
    const artist = await db.query.artists.findFirst({
      where: eq(artists.id, artistId),
      columns: { id: true, name: true },
    });

    if (!artist) return null;

    // Get artist's tracks
    const artistTracks = await db.query.tracks.findMany({
      where: eq(tracks.artistId, artistId),
      columns: { id: true },
    });

    const trackIds = artistTracks.map(t => t.id);
    if (!trackIds.length) {
      return { artistId, artistName: artist.name, totalPlays: 0, totalListeners: 0, topTracks: [] };
    }

    const conditions = [sql`${listenEvents.trackId} IN (${sql.join(trackIds.map(id => sql`${id}`), sql`, `)})`];
    if (query.startDate) conditions.push(gte(listenEvents.createdAt, query.startDate));
    if (query.endDate) conditions.push(lte(listenEvents.createdAt, query.endDate));

    const whereClause = and(...conditions);

    // Get top tracks for this artist
    const topTracks = await this.getTopTracksAnalytics(query, 10);

    // Aggregate totals
    const totals = await db.select({
      totalPlays: count(sql`CASE WHEN ${listenEvents.eventType} = 'play' THEN 1 END`),
      uniqueListeners: count(sql`DISTINCT ${listenEvents.sessionId}`),
    }).from(listenEvents).where(whereClause);

    return {
      artistId,
      artistName: artist.name,
      totalPlays: Number(totals[0]?.totalPlays) || 0,
      totalListeners: Number(totals[0]?.uniqueListeners) || 0,
      topTracks: topTracks.filter(t => trackIds.includes(t.trackId)),
    };
  }

  /**
   * Get realtime stats (last 5 minutes)
   */
  async getRealtimeStats(): Promise<RealtimeStats> {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Current listeners (active sessions in last 5 min)
    const currentResult = await db.select({
      count: count(sql`DISTINCT ${listenEvents.sessionId}`),
    })
      .from(listenEvents)
      .where(and(
        gte(listenEvents.createdAt, fiveMinAgo),
        eq(listenEvents.eventType, 'play')
      ));

    // 24h peak (max concurrent in any 5-min window - simplified)
    const peakResult = await db.select({
      count: count(sql`DISTINCT ${listenEvents.sessionId}`),
    })
      .from(listenEvents)
      .where(and(
        gte(listenEvents.createdAt, dayAgo),
        eq(listenEvents.eventType, 'play')
      ));

    // Top tracks now
    const topTracksResult = await db.select({
      trackId: listenEvents.trackId,
      listeners: count(sql`DISTINCT ${listenEvents.sessionId}`),
    })
      .from(listenEvents)
      .where(and(
        gte(listenEvents.createdAt, fiveMinAgo),
        eq(listenEvents.eventType, 'play'),
        sql`${listenEvents.trackId} IS NOT NULL`
      ))
      .groupBy(listenEvents.trackId)
      .orderBy(desc(count()))
      .limit(5);

    // Get track info for top tracks
    const trackIds = topTracksResult.map(t => t.trackId).filter(Boolean) as string[];
    const trackInfo = trackIds.length > 0 ? await db.select({
      id: tracks.id,
      title: tracks.title,
      artist: { name: artists.name },
    })
      .from(tracks)
      .leftJoin(artists, eq(tracks.artistId, artists.id))
      .where(sql`${tracks.id} IN (${sql.join(trackIds.map(id => sql`${id}`), sql`, `)})`)
      : [];

    const infoMap = new Map(trackInfo.map(t => [t.id, t]));

    // Listeners by country (last 24h)
    const countryResult = await db.select({
      country: listenEvents.country,
      listeners: count(sql`DISTINCT ${listenEvents.sessionId}`),
    })
      .from(listenEvents)
      .where(and(
        gte(listenEvents.createdAt, dayAgo),
        eq(listenEvents.eventType, 'play'),
        sql`${listenEvents.country} IS NOT NULL`
      ))
      .groupBy(listenEvents.country)
      .orderBy(desc(count()))
      .limit(20);

    return {
      currentListeners: Number(currentResult[0]?.count) || 0,
      peakListeners24h: Number(peakResult[0]?.count) || 0,
      totalPlays24h: Number(peakResult[0]?.count) || 0, // Simplified
      topTracksNow: topTracksResult.map(t => ({
        trackId: t.trackId!,
        title: infoMap.get(t.trackId!)?.title || 'Unknown',
        artist: infoMap.get(t.trackId!)?.artist?.name || 'Unknown',
        listeners: Number(t.listeners),
      })),
      listenersByCountry: Object.fromEntries(
        countryResult.map(c => [c.country!, Number(c.listeners)])
      ),
    };
  }

  /**
   * Get time-series data for charts
   */
  async getTimeSeries(query: AnalyticsQuery = {}, interval: 'hour' | 'day' = 'hour'): Promise<Array<{
    period: string;
    plays: number;
    listeners: number;
    avgDuration: number;
  }>> {
    const { startDate, endDate, trackId } = query;
    const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate || new Date();

    const conditions = [
      gte(listenEvents.createdAt, start),
      lte(listenEvents.createdAt, end),
      eq(listenEvents.eventType, 'play'),
    ];
    if (trackId) conditions.push(eq(listenEvents.trackId, trackId));

    const whereClause = and(...conditions);

    const dateFormat = interval === 'hour'
      ? sql`date_trunc('hour', ${listenEvents.createdAt})`
      : sql`date_trunc('day', ${listenEvents.createdAt})`;

    const results = await db.select({
      period: dateFormat,
      plays: count(),
      listeners: count(sql`DISTINCT ${listenEvents.sessionId}`),
      avgDuration: avg(listenEvents.durationMs),
    })
      .from(listenEvents)
      .where(whereClause)
      .groupBy(dateFormat)
      .orderBy(asc(dateFormat));

    return results.map(r => ({
      period: r.period.toISOString(),
      plays: Number(r.plays),
      listeners: Number(r.listeners),
      avgDuration: Number(r.avgDuration) || 0,
    }));
  }

  /**
   * Clean old events (run periodically)
   */
  async cleanupOldEvents(olderThanDays: number = 90): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const result = await db.delete(listenEvents)
      .where(lte(listenEvents.createdAt, cutoff));
    return result.rowCount || 0;
  }
}

export const analytics = new AnalyticsService();