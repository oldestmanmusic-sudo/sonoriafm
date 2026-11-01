import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// PÚBLICA. Devuelve qué suena ahora en SONORIA FM y las siguientes canciones, con su hora de
// inicio exacta (ms desde 1970). Es el MISMO algoritmo que usa la web (src/lib/radioContext.jsx:
// parrilla por franjas en hora de Madrid, barajado determinista por vuelta, artistas intercalados,
// Top 10 por "me gusta", canciones nuevas entran al empezar la siguiente vuelta), así que la app
// de Android suena a la vez que la web. Si se cambia el algoritmo de la web, hay que cambiarlo aquí.
//
// Uso: POST/GET .../functions/radioNow   (opcional: { "count": 12, "at": 1700000000000 })
// Respuesta: { serverTime, tracks: [{ id, title, artist, genre, language, audio_url, cover_url,
//   duration, startsAt, endsAt }] }. tracks[0] es la que suena en este momento (startsAt en el
// pasado): hay que reproducirla desde (serverTime - startsAt) ms. Cada pista termina cuando
// empieza la siguiente (startsAt de la siguiente), que puede ser antes de que acabe el audio
// si cambia la franja horaria.

const FALLBACK_DURATION = 240;

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededShuffle(list, seed) {
  const arr = [...list].sort((a, b) => hashStr(String(a.id)) - hashStr(String(b.id)));
  for (let i = arr.length - 1; i > 0; i--) {
    const j = hashStr(String(arr[i].id) + ':' + seed) % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function interleaveArtists(order, prevArtist) {
  const groups = new Map();
  order.forEach((t) => {
    if (!groups.has(t.artist)) groups.set(t.artist, []);
    groups.get(t.artist).push(t);
  });
  const out = [];
  let prev = prevArtist || null;
  while (out.length < order.length) {
    let candidates = [...groups.entries()].filter(([, g]) => g.length > 0 && g[0].artist !== prev);
    if (!candidates.length) candidates = [...groups.entries()].filter(([, g]) => g.length > 0);
    candidates.sort((a, b) => b[1].length - a[1].length);
    const pick = candidates[0][1].shift();
    prev = pick.artist;
    out.push(pick);
  }
  return out;
}

function parseDuration(d) {
  if (!d || typeof d !== 'string') return 0;
  const parts = d.split(':').map((p) => parseInt(p, 10));
  if (parts.some((p) => isNaN(p))) return 0;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

function buildCycle(list, cycle, prevList) {
  if (cycle < 0) cycle = 0;
  const wrap = (t, fallback) => ({ track: t, dur: parseDuration(t.duration) || fallback });
  const base = seededShuffle(list, cycle);
  const prevLast = prevList
    ? interleaveArtists(seededShuffle(prevList, cycle - 1)).slice(-1)[0].artist
    : null;
  return interleaveArtists(base, prevLast).map((t) => wrap(t, FALLBACK_DURATION));
}

const MAX_CYCLES_PER_DAY = 500;
const PARRILLA_TZ = 'Europe/Madrid';
const SLOTS = [
  { id: 0, start: 0, kind: 'electronic' },
  { id: 1, start: 8 * 3600, kind: 'poprock' },
  { id: 5, start: 10 * 3600, kind: 'baladas' },
  { id: 3, start: 11 * 3600, kind: 'idiomas' },
  { id: 4, start: 12 * 3600, kind: 'top' },
  { id: 2, start: 16 * 3600, kind: 'latino' },
];
const ELECTRONIC_GENRES = new Set(['electrónica']);
const LATINO_GENRES = new Set(['pop latino', 'pop rock latino', 'urbano/reguetón']);
const BALADAS_GENRES = new Set(['baladas']);
const POPROCK_GENRES = new Set(['pop rock', 'pop rock latino']);
const TOP_SIZE = 10;

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

function madridClock(nowMs) {
  const p = {};
  for (const part of madridFmt.formatToParts(new Date(nowMs))) p[part.type] = part.value;
  const dayIndex = Math.floor(Date.UTC(+p.year, +p.month - 1, +p.day) / 86400000);
  const frac = (((nowMs % 1000) + 1000) % 1000) / 1000;
  const secondsOfDay = (+p.hour % 24) * 3600 + +p.minute * 60 + +p.second + frac;
  return { dayIndex, secondsOfDay };
}

const createdMs = (t) => {
  const s = String((t && t.created_date) || '');
  if (!s) return 0;
  const ms = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`);
  return Number.isFinite(ms) ? ms : 0;
};

const normGenre = (g) => (g || '').toString().trim().toLowerCase();

function slotLists(list) {
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

function cycleList(lists, slot, k) {
  if (slot.kind === 'electronic') return lists.electronic;
  if (slot.kind === 'latino') return lists.latino;
  if (slot.kind === 'poprock' && lists.poprock.length) return lists.poprock;
  if (slot.kind === 'baladas' && lists.baladas.length) return lists.baladas;
  if (slot.kind === 'idiomas' && lists.idiomas.length) return lists.idiomas;
  if (!lists.rest.length) return lists.top;
  return k % 3 === 1 ? lists.rest : lists.top;
}

function findPosition(list, nowMs, lists) {
  const { dayIndex, secondsOfDay } = madridClock(nowMs);
  const slot = [...SLOTS].reverse().find((sl) => secondsOfDay >= sl.start) || SLOTS[0];
  const secondsInSlot = secondsOfDay - slot.start;
  lists = lists || slotLists(list);
  const slotStartMs = nowMs - secondsOfDay * 1000 + slot.start * 1000;
  const cycleFor = (k, acc, prevList) => {
    const raw = cycleList(lists, slot, k);
    const startMs = slotStartMs + acc * 1000;
    let cl = raw.filter((t) => createdMs(t) <= startMs);
    if (!cl.length) cl = raw;
    return { cl, schedule: buildCycle(cl, dayIndex * 100000 + slot.id * 1000 + k, prevList) };
  };
  let acc = 0;
  let prevList = null;
  for (let k = 0; k < MAX_CYCLES_PER_DAY; k++) {
    const built = cycleFor(k, acc, prevList);
    const schedule = built.schedule;
    prevList = built.cl;
    const len = schedule.reduce((sum, item) => sum + item.dur, 0) || FALLBACK_DURATION;
    if (secondsInSlot < acc + len) {
      let t = secondsInSlot - acc;
      for (let i = 0; i < schedule.length; i++) {
        if (t < schedule[i].dur) return { schedule, index: i, offset: t, secondsOfDay };
        t -= schedule[i].dur;
      }
      return { schedule, index: 0, offset: 0, secondsOfDay };
    }
    acc += len;
  }
  return { schedule: cycleFor(0, 0, null).schedule, index: 0, offset: 0, secondsOfDay };
}

// Segundos del día (hora de Madrid) en que empieza la siguiente franja.
function nextSlotStart(secondsOfDay) {
  const next = SLOTS.find((sl) => sl.start > secondsOfDay);
  return next ? next.start : 86400;
}

// Calcula la pista actual y las siguientes (count en total) a partir de nowMs.
export function buildUpcoming(list, nowMs, count) {
  const lists = slotLists(list);
  const out = [];
  let t = nowMs;
  for (let n = 0; n < count; n++) {
    const pos = findPosition(list, t, lists);
    const item = pos.schedule[pos.index];
    const startsAt = Math.round(t - pos.offset * 1000);
    const naturalEnd = startsAt + item.dur * 1000;
    // La franja siguiente corta la canción en curso (igual que en la web).
    const boundary = t - pos.secondsOfDay * 1000 + nextSlotStart(pos.secondsOfDay) * 1000;
    const endsAt = Math.min(naturalEnd, Math.round(boundary));
    out.push({ track: item.track, startsAt, endsAt });
    // Siguiente instante: justo después del final de esta pista (+0,5 s para caer dentro de la siguiente).
    t = endsAt + 500;
  }
  return out;
}

const toList = (r) => (Array.isArray(r) ? r : (r?.items ?? []));

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    let params = {};
    if (req.method === 'GET') {
      const u = new URL(req.url);
      params = Object.fromEntries(u.searchParams.entries());
    } else {
      params = await req.json().catch(() => ({}));
    }
    const count = Math.max(1, Math.min(30, parseInt(params.count, 10) || 12));
    const at = Number(params.at);
    const nowMs = Number.isFinite(at) && at > 0 ? at : Date.now();

    const all = toList(await base44.asServiceRole.entities.Track.filter({}, { limit: 500 }));
    const list = all.filter((t) => t && t.audio_url && t.genre !== 'Cuña');
    if (!list.length) return Response.json({ serverTime: Date.now(), tracks: [] });

    const upcoming = buildUpcoming(list, nowMs, count);
    return Response.json(
      {
        serverTime: Date.now(),
        tracks: upcoming.map(({ track, startsAt, endsAt }) => ({
          id: track.id,
          title: track.title,
          artist: track.artist,
          genre: track.genre || '',
          language: track.language || '',
          audio_url: track.audio_url,
          cover_url: track.cover_url || '',
          duration: track.duration || '',
          startsAt,
          endsAt,
        })),
      },
      { headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
