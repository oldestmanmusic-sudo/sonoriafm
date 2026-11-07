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