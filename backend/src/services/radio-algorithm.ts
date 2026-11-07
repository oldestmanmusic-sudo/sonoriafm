/**
 * Radio Algorithm - Core deterministic scheduling logic
 * Pure functions, no side effects, fully testable
 * Ported from Base44 radioQueue/entry.ts and radioContext.jsx
 */

import { SLOTS, ELECTRONIC_GENRES, LATINO_GENRES, BALADAS_GENRES, POPROCK_GENRES, TOP_SIZE, MAX_CYCLES_PER_DAY, PARRILLA_TZ, FALLBACK_DURATION } from './radio-constants.ts';

export type Track = {
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
};

export type SlotLists = {
  electronic: Track[];
  latino: Track[];
  poprock: Track[];
  baladas: Track[];
  idiomas: Track[];
  top: Track[];
  rest: Track[];
};

// Deterministic hash (FNV-1a)
export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Fisher-Yates shuffle with deterministic seed
export function seededShuffle(list: Track[], seed: number): Track[] {
  const arr = [...list].sort((a, b) => hashStr(String(a.id)) - hashStr(String(b.id)));
  for (let i = arr.length - 1; i > 0; i--) {
    const j = hashStr(String(arr[i].id) + ':' + seed) % (i + 1);
    const temp = arr[i];
    arr[i] = arr[j]!;
    arr[j] = temp;
  }
  return arr;
}

// Interleave artists to avoid consecutive same artist
export function interleaveArtists(order: Track[], prevArtist: string | null): Track[] {
  const groups = new Map<string, Track[]>();
  order.forEach((t) => {
    if (!groups.has(t.artist)) groups.set(t.artist, []);
    groups.get(t.artist)!.push(t);
  });
  const out: Track[] = [];
  let prev = prevArtist || null;
  while (out.length < order.length) {
    let candidates = [...groups.entries()].filter(([, g]) => g.length > 0 && g[0].artist !== prev);
    if (!candidates.length) candidates = [...groups.entries()].filter(([, g]) => g.length > 0);
    candidates.sort((a, b) => b[1].length - a[1].length);
    const group = candidates[0][1];
    const pick = group.shift();
    if (!pick) continue;
    prev = pick.artist;
    out.push(pick);
  }
  return out;
}

// Parse MM:SS or H:MM:SS duration to seconds
export function parseDuration(d: string | undefined): number {
  if (!d || typeof d !== 'string') return 0;
  const parts = d.split(':').map((p) => parseInt(p, 10));
  if (parts.some((p) => isNaN(p))) return 0;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

// Normalize genre string
export function normGenre(g: string): string {
  return (g || '').toString().trim().toLowerCase();
}

// Split tracks into slot-specific lists
export function slotLists(list: Track[]): SlotLists {
  const electronic = list.filter((t) => ELECTRONIC_GENRES.has(normGenre(t.genre)));
  const latino = list.filter((t) => LATINO_GENRES.has(normGenre(t.genre)));
  const poprock = list.filter((t) => POPROCK_GENRES.has(normGenre(t.genre)));
  const baladas = list.filter((t) => BALADAS_GENRES.has(normGenre(t.genre)));
  const idiomas = list.filter((t) => normGenre(t.language) === 'otros idiomas');
  const byLikes = [...list].sort(
    (a, b) => (b.likes || 0) - (a.likes || 0) || String(a.id).localeCompare(String(b.id))
  );
  const top = byLikes.slice(0, TOP_SIZE);
  const topIds = new Set(top.map((t) => t.id));
  const rest = list.filter((t) => !topIds.has(t.id));
  return {
    electronic: electronic.length ? electronic : list,
    latino: latino.length ? latino : list,
    poprock,
    baladas,
    idiomas,
    top,
    rest,
  };
}

// Select which list to use for a cycle in a slot
export function cycleList(lists: SlotLists, slot: typeof SLOTS[0], k: number): Track[] {
  if (slot.kind === 'electronic') return lists.electronic;
  if (slot.kind === 'latino') return lists.latino;
  if (slot.kind === 'poprock' && lists.poprock.length) return lists.poprock;
  if (slot.kind === 'baladas' && lists.baladas.length) return lists.baladas;
  if (slot.kind === 'idiomas' && lists.idiomas.length) return lists.idiomas;
  if (!lists.rest.length) return lists.top;
  return k % 3 === 1 ? lists.rest : lists.top;
}

// Madrid clock utilities
const madridFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: PARRILLA_TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

export function madridClock(nowMs: number) {
  const p: Record<string, string> = {};
  for (const part of madridFmt.formatToParts(new Date(nowMs))) p[part.type] = part.value;
  const year = parseInt(p.year || '1970', 10);
  const month = parseInt(p.month || '01', 10);
  const day = parseInt(p.day || '01', 10);
  const hour = parseInt(p.hour || '00', 10);
  const minute = parseInt(p.minute || '00', 10);
  const second = parseInt(p.second || '00', 10);
  const dayIndex = Math.floor(Date.UTC(year, month - 1, day) / 86400000);
  const frac = (((nowMs % 1000) + 1000) % 1000) / 1000;
  const secondsOfDay = (hour % 24) * 3600 + minute * 60 + second + frac;
  return { dayIndex, secondsOfDay };
}

// Track creation time in ms
export function createdMs(t: Track): number {
  const s = String((t && t.created_date) || '');
  if (!s) return 0;
  const ms = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`);
  return Number.isFinite(ms) ? ms : 0;
}

// Find current slot
export function slotAt(ms: number) {
  const { dayIndex, secondsOfDay } = madridClock(ms);
  const slot = [...SLOTS].reverse().find((sl) => secondsOfDay >= sl.start);
  const foundSlot = slot || SLOTS[0];
  return { slot: foundSlot, dayIndex, secondsOfDay, slotKey: dayIndex * 100000 + foundSlot.id * 1000 };
}

// Legacy position finder (clock-based, used for seeding)
export function legacyPosition(list: Track[], nowMs: number, lists: SlotLists) {
  const { slot, dayIndex, secondsOfDay, slotKey } = slotAt(nowMs);
  const secondsInSlot = secondsOfDay - slot.start;
  const slotStartMs = nowMs - secondsOfDay * 1000 + slot.start * 1000;

  const cycleFor = (k: number, acc: number, prevList: Track[] | null) => {
    const raw = cycleList(lists, slot, k);
    const startMs = slotStartMs + acc * 1000;
    let cl = raw.filter((t) => createdMs(t) <= startMs);
    if (!cl.length) cl = raw;
    const sched = interleaveArtists(seededShuffle(cl, slotKey + k), prevList?.slice(-1)[0]?.artist || null);
    return { cl, sched };
  };

  const durOf = (t: Track) => parseDuration(t.duration) || FALLBACK_DURATION;
  let acc = 0;
  let prevList: Track[] | null = null;

  for (let k = 0; k < MAX_CYCLES_PER_DAY; k++) {
    const prevLast = prevList
      ? interleaveArtists(seededShuffle(prevList, slotKey + k - 1)).slice(-1)[0].artist
      : null;
    const { cl, sched } = cycleFor(k, acc, prevList);
    prevList = cl;
    const len = sched.reduce((s, t) => s + durOf(t), 0) || FALLBACK_DURATION;
    if (secondsInSlot < acc + len) {
      let t = secondsInSlot - acc;
      for (let i = 0; i < sched.length; i++) {
        if (t < durOf(sched[i])) return { sched, index: i, offset: t, k, slotKey };
        t -= durOf(sched[i]);
      }
      return { sched, index: 0, offset: 0, k, slotKey };
    }
    acc += len;
  }
  const { sched } = cycleFor(0, 0, null);
  return { sched, index: 0, offset: 0, k: 0, slotKey };
}

// Create a RadioQueue entry object
export function entryFor(track: Track, startsAt: number, meta: { seq: number; slotKey: number; k: number; pos: number; order: string }) {
  const dur = parseDuration(track.duration) || FALLBACK_DURATION;
  const s = Math.round(startsAt);
  return {
    seq: meta.seq,
    kind: 'song' as const,
    track_id: track.id,
    title: track.title || '',
    artist: track.artist || '',
    genre: track.genre || '',
    language: track.language || '',
    audio_url: track.audio_url || '',
    cover_url: track.cover_url || '',
    duration: track.duration || '',
    durationMs: dur * 1000,
    startsAt: new Date(s),
    endsAt: new Date(s + dur * 1000),
    slotKey: meta.slotKey,
    cycle: meta.k,
    position: meta.pos,
    order: meta.order,
  };
}

// Generate next entry in queue
export function nextEntry(last: ReturnType<typeof entryFor>, lists: SlotLists, byId: Map<string, Track>) {
  const start = last.endsAt.getTime();
  const { slot, slotKey } = slotAt(start);
  let k = 0;

  if (last.slotKey === slotKey && last.order) {
    const ids = String(last.order).split(',');
    let pos = (last.position || 0) + 1;
    while (pos < ids.length && !byId.has(ids[pos])) pos++;
    if (pos < ids.length) {
      const track = byId.get(ids[pos])!;
      return entryFor(track, start, {
        seq: last.seq + 1,
        slotKey,
        k: last.cycle,
        pos,
        order: last.order,
      });
    }
    k = (last.cycle || 0) + 1;
  }

  const raw = cycleList(lists, slot, k);
  let cl = raw.filter((t) => createdMs(t) <= start);
  if (!cl.length) cl = raw;
  const sched = interleaveArtists(seededShuffle(cl, slotKey + k), last.artist);
  return entryFor(sched[0], start, {
    seq: last.seq + 1,
    slotKey,
    k,
    pos: 0,
    order: sched.map((t) => t.id).join(','),
  });
}