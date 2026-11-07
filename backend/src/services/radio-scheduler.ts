/**
 * Radio Scheduler - Deterministic 24/7 emission scheduling
 * Ported from Base44 radioQueue function with improvements
 */

import { hashStr, seededShuffle, interleaveArtists, parseDuration, slotLists, cycleList, slotAt, legacyPosition, entryFor, nextEntry, madridClock, createdMs, normGenre } from './radio-algorithm.ts';

// Re-export algorithm functions for use in services
export { hashStr, seededShuffle, interleaveArtists, parseDuration, slotLists, cycleList, slotAt, legacyPosition, entryFor, nextEntry, madridClock, createdMs, normGenre };

// Configuration constants
export const FALLBACK_DURATION = 240; // 4 minutes in seconds
export const FALLBACK_DURATION_MS = FALLBACK_DURATION * 1000;
export const HORIZON_MS = 2 * 3600 * 1000; // 2 hours ahead
export const KEEP_PAST_MS = 3 * 3600 * 1000; // Keep 3 hours of history
export const MAX_NEW_ENTRIES = 80;
export const TOP_SIZE = 10;
export const MAX_CYCLES_PER_DAY = 500;

// Madrid timezone for schedule
export const PARRILLA_TZ = 'Europe/Madrid';

// Schedule slots (same as frontend)
export const SLOTS = [
  { id: 0, start: 0, kind: 'electronic' },        // Club Electrónico 00-02
  { id: 7, start: 2 * 3600, kind: 'latino' },     // Latino Total 02-05
  { id: 1, start: 5 * 3600, kind: 'poprock' },    // Pop Rock 05-10
  { id: 4, start: 10 * 3600, kind: 'top' },       // Top Sonoria 10-16
  { id: 2, start: 16 * 3600, kind: 'latino' },    // Latino Total 16-20
  { id: 5, start: 20 * 3600, kind: 'baladas' },   // Baladas 20-22
  { id: 3, start: 22 * 3600, kind: 'idiomas' },   // Música en otros idiomas 22-24
];

export const ELECTRONIC_GENRES = new Set(['electrónica']);
export const LATINO_GENRES = new Set(['pop latino', 'pop rock latino', 'urbano/reguetón']);
export const BALADAS_GENRES = new Set(['baladas']);
export const POPROCK_GENRES = new Set(['pop rock', 'pop rock latino']);

// Types
export interface Track {
  id: string;
  title: string;
  artist: string;
  cover_url?: string;
  genre: string;
  duration?: string;
  durationSeconds?: number;
  audio_url: string;
  likes: number;
  language: string;
  created_date?: string;
}

export interface RadioQueueEntry {
  seq: number;
  kind: 'song' | 'jingle' | 'ad';
  track_id: string | null;
  title: string;
  artist: string;
  genre: string;
  language: string;
  audio_url: string;
  cover_url: string;
  duration: string;
  durationMs: number;
  startsAt: Date;
  endsAt: Date;
  slotKey: number;
  cycle: number;
  position: number;
  order: string;
}

export interface SchedulerState {
  entries: RadioQueueEntry[];
  lastEndsAt: number;
  aheadMinutes: number;
}

/**
 * Main scheduler class - generates and maintains the radio queue
 */
export class RadioScheduler {
  private tracks: Track[] = [];
  private trackById: Map<string, Track> = new Map();
  private slotMemo: Map<string, ReturnType<typeof slotLists>> = new Map();
  private cycleCache: Map<number, { schedule: Array<{ track: Track; dur: number }>; list: Track[]; prevList: Track[] | null }> = new Map();

  constructor(tracks: Track[]) {
    this.setTracks(tracks);
  }

  setTracks(tracks: Track[]) {
    this.tracks = tracks.filter(t => t && t.audio_url && t.genre !== 'Cuña');
    this.trackById = new Map(this.tracks.map(t => [t.id, t]));
    this.slotMemo.clear();
    this.cycleCache.clear();
  }

  /**
   * Get or compute slot lists for current track catalog
   */
  getSlotLists() {
    const cacheKey = this.tracks.map(t => t.id).join(',');
    if (this.slotMemo.has(cacheKey)) {
      return this.slotMemo.get(cacheKey)!;
    }
    const lists = slotLists(this.tracks);
    this.slotMemo.set(cacheKey, lists);
    return lists;
  }

  /**
   * Build a cycle schedule with memoization
   */
  buildCycle(list: Track[], cycle: number, prevList: Track[] | null) {
    if (cycle < 0) cycle = 0;
    const cached = this.cycleCache.get(cycle);
    if (cached && cached.list === list && cached.prevList === prevList) {
      return cached.schedule;
    }
    const wrap = (t: Track, fallback: number) => ({ track: t, dur: parseDuration(t.duration) || fallback });
    const base = seededShuffle(list, cycle);
    const prevLast = prevList
      ? interleaveArtists(seededShuffle(prevList, cycle - 1)).slice(-1)[0].artist
      : null;
    const schedule = interleaveArtists(base, prevLast).map(t => wrap(t, FALLBACK_DURATION));
    if (this.cycleCache.size > 500) this.cycleCache.clear();
    this.cycleCache.set(cycle, { list, prevList, schedule });
    return schedule;
  }

  /**
   * Find position in emission for a given time (legacy clock-based)
   */
  findLegacyPosition(nowMs: number) {
    return legacyPosition(this.tracks, nowMs, this.getSlotLists());
  }

  /**
   * Generate initial queue from a starting point
   */
  generateInitialQueue(nowMs: number): RadioQueueEntry[] {
    const pos = this.findLegacyPosition(nowMs);
    const track = pos.sched[pos.index];
    const startsAt = new Date(nowMs - pos.offset * 1000);
    const entry = entryFor(track, startsAt.getTime(), {
      seq: 1,
      slotKey: pos.slotKey,
      k: pos.k,
      pos: pos.index,
      order: pos.sched.map(t => t.id).join(','),
    });
    return [entry];
  }

  /**
   * Extend queue forward to cover horizon
   */
  extendQueue(entries: RadioQueueEntry[], nowMs: number): RadioQueueEntry[] {
    const lists = this.getSlotLists();
    const newEntries: RadioQueueEntry[] = [];
    let last = entries[entries.length - 1];

    while (last.endsAt < nowMs + HORIZON_MS && newEntries.length < MAX_NEW_ENTRIES) {
      const next = nextEntry(last, lists, this.trackById);
      newEntries.push(next);
      last = next;
    }

    return newEntries;
  }

  /**
   * Full queue generation: seed if needed, then extend
   */
  generateFullQueue(nowMs: number, existingEntries: RadioQueueEntry[] = []): { entries: RadioQueueEntry[]; seeded: boolean } {
    let entries = [...existingEntries].sort((a, b) => a.seq - b.seq);
    let seeded = false;

    // Remove future entries that no longer match current schedule slots
    const validEntries = entries.filter(e => {
      if (e.startsAt > nowMs) {
        const { slotKey } = slotAt(e.startsAt);
        return e.slotKey === slotKey;
      }
      return true;
    });

    if (validEntries.length !== entries.length) {
      entries = validEntries;
    }

    let last = entries[entries.length - 1] || null;

    if (!last || last.endsAt < nowMs) {
      // Need to seed from current position
      const initial = this.generateInitialQueue(nowMs);
      if (last && last.endsAt > initial[0].startsAt) {
        // Adjust previous entry end time
        last.endsAt = initial[0].startsAt;
      }
      entries.push(...initial);
      last = initial[0];
      seeded = true;
    }

    // Extend to horizon
    const extended = this.extendQueue(entries, nowMs);
    entries.push(...extended);

    return { entries, seeded };
  }

  /**
   * Prune old entries
   */
  pruneOldEntries(entries: RadioQueueEntry[], nowMs: number): RadioQueueEntry[] {
    const cutoff = nowMs - KEEP_PAST_MS;
    return entries.filter(e => e.endsAt >= cutoff);
  }

  /**
   * Get queue stats
   */
  getQueueStats(entries: RadioQueueEntry[], nowMs: number): { lastEndsAt: number; aheadMinutes: number } {
    const last = entries[entries.length - 1];
    return {
      lastEndsAt: last?.endsAt || nowMs,
      aheadMinutes: last ? Math.round((last.endsAt - nowMs) / 60000) : 0,
    };
  }
}

/**
 * RadioNow service - serves current/upcoming tracks to frontend
 */
export interface RadioNowResponse {
  serverTime: number;
  tracks: Array<{
    id: string;
    kind: string;
    title: string;
    artist: string;
    genre: string;
    language: string;
    audio_url: string;
    cover_url: string;
    duration: string;
    startsAt: number;
    endsAt: number;
  }>;
}

export class RadioNowService {
  private scheduler: RadioScheduler;

  constructor(tracks: Track[]) {
    this.scheduler = new RadioScheduler(tracks);
  }

  async getNow(count: number = 12, at?: number, backMs: number = 0): Promise<RadioNowResponse> {
    const now = at && at > 0 ? at : Date.now();
    const targetTime = now - backMs;

    // For now, we'll use the scheduler directly
    // In production, this would read from persisted RadioQueue table
    const { entries } = this.scheduler.generateFullQueue(targetTime);

    const from = entries.findIndex(e => e.endsAt > targetTime);
    const slice = from < 0 ? [] : entries.slice(from, from + Math.min(count, 60));

    return {
      serverTime: Date.now(),
      tracks: slice.map(e => ({
        id: e.track_id || '',
        kind: e.kind,
        title: e.title,
        artist: e.artist,
        genre: e.genre,
        language: e.language,
        audio_url: e.audio_url,
        cover_url: e.cover_url,
        duration: e.duration,
        startsAt: e.startsAt,
        endsAt: e.endsAt,
      })),
    };
  }
}