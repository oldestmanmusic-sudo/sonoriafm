/**
 * Radio Constants - Shared configuration to avoid circular imports
 */

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

// Find current slot
export function slotAt(ms: number) {
  const { dayIndex, secondsOfDay } = madridClock(ms);
  const slot = [...SLOTS].reverse().find((sl) => secondsOfDay >= sl.start);
  const foundSlot = slot || SLOTS[0];
  return { slot: foundSlot, dayIndex, secondsOfDay, slotKey: dayIndex * 100000 + foundSlot.id * 1000 };
}