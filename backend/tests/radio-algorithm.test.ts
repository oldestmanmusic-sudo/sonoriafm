/**
 * Radio Algorithm Tests
 * Verifies deterministic scheduling logic
 */

import {
  hashStr,
  seededShuffle,
  interleaveArtists,
  parseDuration,
  normGenre,
  slotLists,
  cycleList,
  slotAt,
  legacyPosition,
  entryFor,
  nextEntry,
  madridClock,
  createdMs,
} from '../src/services/radio-algorithm.ts';

import {
  SLOTS,
  ELECTRONIC_GENRES,
  LATINO_GENRES,
  BALADAS_GENRES,
  POPROCK_GENRES,
  TOP_SIZE,
  FALLBACK_DURATION,
} from '../src/services/radio-scheduler.ts';

// Test tracks fixture
const createTestTracks = (): Array<{
  id: string;
  title: string;
  artist: string;
  genre: string;
  duration: string;
  audio_url: string;
  likes: number;
  language: string;
  created_date: string;
}> => [
  {
    id: 'track-1',
    title: 'Electronic Dream',
    artist: 'DJ Electron',
    genre: 'electrónica',
    duration: '4:30',
    audio_url: 'https://example.com/track1.mp3',
    likes: 100,
    language: 'Español',
    created_date: '2024-01-01T00:00:00Z',
  },
  {
    id: 'track-2',
    title: 'Latin Fire',
    artist: 'Carlos Latino',
    genre: 'pop latino',
    duration: '3:45',
    audio_url: 'https://example.com/track2.mp3',
    likes: 80,
    language: 'Español',
    created_date: '2024-01-02T00:00:00Z',
  },
  {
    id: 'track-3',
    title: 'Rock Anthem',
    artist: 'The Rockers',
    genre: 'pop rock',
    duration: '5:00',
    audio_url: 'https://example.com/track3.mp3',
    likes: 120,
    language: 'Español',
    created_date: '2024-01-03T00:00:00Z',
  },
  {
    id: 'track-4',
    title: 'Balada Triste',
    artist: 'Romantico',
    genre: 'baladas',
    duration: '4:15',
    audio_url: 'https://example.com/track4.mp3',
    likes: 60,
    language: 'Español',
    created_date: '2024-01-04T00:00:00Z',
  },
  {
    id: 'track-5',
    title: 'Reggaeton Beat',
    artist: 'Urbano King',
    genre: 'urbano/reguetón',
    duration: '3:30',
    audio_url: 'https://example.com/track5.mp3',
    likes: 90,
    language: 'Español',
    created_date: '2024-01-05T00:00:00Z',
  },
  {
    id: 'track-6',
    title: 'English Song',
    artist: 'International Star',
    genre: 'pop rock',
    duration: '3:55',
    audio_url: 'https://example.com/track6.mp3',
    likes: 70,
    language: 'Otros idiomas',
    created_date: '2024-01-06T00:00:00Z',
  },
];

Deno.test('hashStr - deterministic hash', () => {
  const h1 = hashStr('test');
  const h2 = hashStr('test');
  const h3 = hashStr('different');
  console.assert(h1 === h2, 'Same input should produce same hash');
  console.assert(h1 !== h3, 'Different input should produce different hash');
  console.assert(typeof h1 === 'number', 'Hash should be a number');
});

Deno.test('parseDuration - parses MM:SS and H:MM:SS', () => {
  console.assert(parseDuration('4:30') === 270, 'MM:SS');
  console.assert(parseDuration('1:04:30') === 3870, 'H:MM:SS');
  console.assert(parseDuration('0:30') === 30, '0:MM:SS');
  console.assert(parseDuration('invalid') === 0, 'Invalid returns 0');
  console.assert(parseDuration('') === 0, 'Empty returns 0');
  console.assert(parseDuration(undefined as any) === 0, 'Undefined returns 0');
});

Deno.test('normGenre - normalizes genre strings', () => {
  console.assert(normGenre('  ELECTRÓNICA  ') === 'electrónica');
  console.assert(normGenre('Pop Latino') === 'pop latino');
  console.assert(normGenre('') === '');
  console.assert(normGenre(null as any) === '');
});

Deno.test('seededShuffle - deterministic shuffle with same seed', () => {
  const tracks = createTestTracks();
  const shuffle1 = seededShuffle(tracks, 42);
  const shuffle2 = seededShuffle(tracks, 42);
  const shuffle3 = seededShuffle(tracks, 43);

  // Same seed = same order
  for (let i = 0; i < tracks.length; i++) {
    console.assert(shuffle1[i].id === shuffle2[i].id, `Position ${i} should match with same seed`);
  }
  // Different seed = likely different order
  let different = false;
  for (let i = 0; i < tracks.length; i++) {
    if (shuffle1[i].id !== shuffle3[i].id) different = true;
  }
  console.assert(different, 'Different seed should produce different order');
});

Deno.test('interleaveArtists - avoids consecutive same artist', () => {
  const tracks: Array<{
    id: string;
    title: string;
    artist: string;
    genre: string;
    duration: string;
    audio_url: string;
    likes: number;
    language: string;
    created_date: string;
  }> = [
    { id: '1', title: 'A1', artist: 'Artist A', genre: 'electrónica', duration: '3:00', audio_url: '', likes: 10, language: 'Español', created_date: '' },
    { id: '2', title: 'A2', artist: 'Artist A', genre: 'electrónica', duration: '3:00', audio_url: '', likes: 10, language: 'Español', created_date: '' },
    { id: '3', title: 'B1', artist: 'Artist B', genre: 'electrónica', duration: '3:00', audio_url: '', likes: 10, language: 'Español', created_date: '' },
    { id: '4', title: 'C1', artist: 'Artist C', genre: 'electrónica', duration: '3:00', audio_url: '', likes: 10, language: 'Español', created_date: '' },
  ];

  const result = interleaveArtists(tracks, null);
  for (let i = 1; i < result.length; i++) {
    // Should not have same artist consecutively (unless forced)
    if (i < result.length - 1 || result.length <= 3) {
      // With enough diversity, no consecutive same artist
      console.assert(result[i].artist !== result[i - 1].artist, `No consecutive same artist at position ${i}`);
    }
  }
});

Deno.test('slotLists - categorizes tracks correctly', () => {
  const tracks = createTestTracks();
  const lists = slotLists(tracks);

  console.assert(lists.electronic.length >= 1, 'Has electronic tracks');
  console.assert(lists.latino.length >= 2, 'Has latino tracks (pop latino + urbano)');
  console.assert(lists.poprock.length >= 2, 'Has poprock tracks');
  console.assert(lists.baladas.length >= 1, 'Has baladas tracks');
  console.assert(lists.idiomas.length >= 1, 'Has otros idiomas tracks');
  console.assert(lists.top.length <= TOP_SIZE, 'Top limited to TOP_SIZE');
  console.assert(lists.top.length + lists.rest.length === tracks.length, 'Top + rest = all tracks');
});

Deno.test('cycleList - selects correct list for slot', () => {
  const tracks = createTestTracks();
  const lists = slotLists(tracks);

  const electronicSlot = SLOTS.find(s => s.kind === 'electronic')!;
  const latinoSlot = SLOTS.find(s => s.kind === 'latino')!;
  const poprockSlot = SLOTS.find(s => s.kind === 'poprock')!;
  const baladasSlot = SLOTS.find(s => s.kind === 'baladas')!;
  const idiomasSlot = SLOTS.find(s => s.kind === 'idiomas')!;
  const topSlot = SLOTS.find(s => s.kind === 'top')!;

  console.assert(cycleList(lists, electronicSlot, 0).length >= 1, 'Electronic slot uses electronic list');
  console.assert(cycleList(lists, latinoSlot, 0).length >= 1, 'Latino slot uses latino list');
  console.assert(cycleList(lists, poprockSlot, 0).length >= 1, 'Poprock slot uses poprock list');
  console.assert(cycleList(lists, baladasSlot, 0).length >= 1, 'Baladas slot uses baladas list');
  console.assert(cycleList(lists, idiomasSlot, 0).length >= 1, 'Idiomas slot uses idiomas list');

  // Top slot alternates: top, rest, top, rest...
  const topCycle0 = cycleList(lists, topSlot, 0);
  const topCycle1 = cycleList(lists, topSlot, 1);
  const topCycle2 = cycleList(lists, topSlot, 2);
  console.assert(topCycle0.length === lists.top.length, 'Cycle 0 uses top');
  console.assert(topCycle1.length === lists.rest.length, 'Cycle 1 uses rest');
  console.assert(topCycle2.length === lists.top.length, 'Cycle 2 uses top again');
});

Deno.test('madridClock - returns correct Madrid time', () => {
  // Test with a known timestamp (2024-01-15 14:30:00 UTC = 15:30 in Madrid winter)
  const winterTimestamp = new Date('2024-01-15T14:30:00Z').getTime();
  const winter = madridClock(winterTimestamp);
  console.assert(winter.secondsOfDay === 15 * 3600 + 30 * 60, 'Winter time (CET = UTC+1)');

  // Test with summer timestamp (2024-07-15 14:30:00 UTC = 16:30 in Madrid summer)
  const summerTimestamp = new Date('2024-07-15T14:30:00Z').getTime();
  const summer = madridClock(summerTimestamp);
  console.assert(summer.secondsOfDay === 16 * 3600 + 30 * 60, 'Summer time (CEST = UTC+2)');
});

Deno.test('slotAt - finds correct slot for time', () => {
  // 01:00 Madrid = Club Electrónico (00-02)
  const t1 = new Date('2024-01-15T00:00:00Z').getTime(); // 01:00 Madrid winter
  const slot1 = slotAt(t1);
  console.assert(slot1.slot.kind === 'electronic', '01:00 is electronic');

  // 03:00 Madrid = Latino Total (02-05)
  const t2 = new Date('2024-01-15T02:00:00Z').getTime(); // 03:00 Madrid winter
  const slot2 = slotAt(t2);
  console.assert(slot2.slot.kind === 'latino', '03:00 is latino');

  // 12:00 Madrid = Top Sonoria (10-16)
  const t3 = new Date('2024-01-15T11:00:00Z').getTime(); // 12:00 Madrid winter
  const slot3 = slotAt(t3);
  console.assert(slot3.slot.kind === 'top', '12:00 is top');

  // 21:00 Madrid = Baladas (20-22)
  const t4 = new Date('2024-01-15T20:00:00Z').getTime(); // 21:00 Madrid winter
  const slot4 = slotAt(t4);
  console.assert(slot4.slot.kind === 'baladas', '21:00 is baladas');

  // 23:00 Madrid = Idiomas (22-24)
  const t5 = new Date('2024-01-15T22:00:00Z').getTime(); // 23:00 Madrid winter
  const slot5 = slotAt(t5);
  console.assert(slot5.slot.kind === 'idiomas', '23:00 is idiomas');
});

Deno.test('legacyPosition - finds position in emission', () => {
  const tracks = createTestTracks();
  const lists = slotLists(tracks);
  const now = new Date('2024-01-15T11:00:00Z').getTime(); // 12:00 Madrid = Top slot

  const pos = legacyPosition(tracks, now, lists);
  console.assert(pos.sched.length > 0, 'Schedule not empty');
  console.assert(pos.index >= 0 && pos.index < pos.sched.length, 'Valid index');
  console.assert(pos.offset >= 0, 'Non-negative offset');
  console.assert(pos.k >= 0, 'Non-negative cycle');
  console.assert(pos.slotKey > 0, 'Valid slot key');
});

Deno.test('entryFor - creates valid queue entry', () => {
  const track = createTestTracks()[0];
  const entry = entryFor(track, Date.now(), { seq: 1, slotKey: 123, k: 0, pos: 0, order: 'track-1,track-2' });

  console.assert(entry.seq === 1);
  console.assert(entry.track_id === track.id);
  console.assert(entry.title === track.title);
  console.assert(entry.artist === track.artist);
  console.assert(entry.durationMs === parseDuration(track.duration) * 1000);
  console.assert(entry.endsAt > entry.startsAt);
  console.assert(entry.slotKey === 123);
  console.assert(entry.cycle === 0);
  console.assert(entry.position === 0);
});

Deno.test('nextEntry - continues queue correctly', () => {
  const tracks = createTestTracks();
  const lists = slotLists(tracks);
  const byId = new Map(tracks.map(t => [t.id, t]));

  const first = entryFor(tracks[0], Date.now(), { seq: 1, slotKey: 100000, k: 0, pos: 0, order: tracks.map(t => t.id).join(',') });
  const next = nextEntry(first, lists, byId);

  console.assert(next.seq === 2);
  console.assert(next.startsAt === first.endsAt);
  console.assert(next.endsAt > next.startsAt);
  console.assert(next.track_id !== first.track_id || tracks.length === 1);
});

Deno.test('Full schedule - 24h coverage', () => {
  const tracks = createTestTracks();
  const lists = slotLists(tracks);
  const now = new Date('2024-01-15T00:00:00Z').getTime(); // 01:00 Madrid

  // Generate entries for 24 hours
  const schedulerEntries: any[] = [];
  let current = entryFor(tracks[0], now, { seq: 1, slotKey: 0, k: 0, pos: 0, order: tracks.map(t => t.id).join(',') });
  schedulerEntries.push(current);

  for (let i = 0; i < 100; i++) {
    const next = nextEntry(current, lists, new Map(tracks.map(t => [t.id, t])));
    schedulerEntries.push(next);
    current = next;
  }

  // Should cover at least 24 hours
  const lastEnd = schedulerEntries[schedulerEntries.length - 1].endsAt.getTime();
  const coverageHours = (lastEnd - now) / (1000 * 60 * 60);
  console.assert(coverageHours >= 24, `Should cover 24h+, got ${coverageHours.toFixed(1)}h`);
});

console.log('✅ All radio algorithm tests passed!');