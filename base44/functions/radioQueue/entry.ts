import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// COLA DE EMISIÓN de SONORIA FM (ver comentarios en el repositorio).

const FALLBACK_DURATION = 240;
const HORIZON_MS = 2 * 3600 * 1000;
const KEEP_PAST_MS = 3 * 3600 * 1000;
const MAX_NEW = 80;

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

const PARRILLA_TZ = 'Europe/Madrid';
const SLOTS = [
  { id: 0, start: 0, kind: 'electronic' },
  { id: 7, start: 2 * 3600, kind: 'latino' },
  { id: 1, start: 5 * 3600, kind: 'poprock' },
  { id: 4, start: 10 * 3600, kind: 'top' },
  { id: 2, start: 16 * 3600, kind: 'latino' },
  { id: 5, start: 20 * 3600, kind: 'baladas' },
  { id: 3, start: 22 * 3600, kind: 'idiomas' },
];
const ELECTRONIC_GENRES = new Set(['electrónica']);
const LATINO_GENRES = new Set(['pop latino', 'pop rock latino', 'urbano/reguetón']);
const BALADAS_GENRES = new Set(['baladas']);
const POPROCK_GENRES = new Set(['pop rock', 'pop rock latino']);
const TOP_SIZE = 10;
const MAX_CYCLES_PER_DAY = 500;

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
  // Las canciones en otros idiomas suenan solo en su franja: no entran en el Top Sonoria
  // (salvo que no exista ninguna otra canción).
  const topPool = list.filter((t) => normGenre(t.language) !== 'otros idiomas');
  const pool = topPool.length ? topPool : list;
  const byLikes = [...pool].sort(
    (a, b) => (b.likes || 0) - (a.likes || 0) || String(a.id).localeCompare(String(b.id))
  );
  const top = byLikes.slice(0, TOP_SIZE);
  const topIds = new Set(top.map((t) => t.id));
  const rest = pool.filter((t) => !topIds.has(t.id));
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

function slotAt(ms) {
  const { dayIndex, secondsOfDay } = madridClock(ms);
  const slot = [...SLOTS].reverse().find((sl) => secondsOfDay >= sl.start) || SLOTS[0];
  return { slot, dayIndex, secondsOfDay, slotKey: dayIndex * 100000 + slot.id * 1000 };
}

function legacyPosition(list, nowMs, lists) {
  const { slot, dayIndex, secondsOfDay, slotKey } = slotAt(nowMs);
  const secondsInSlot = secondsOfDay - slot.start;
  const slotStartMs = nowMs - secondsOfDay * 1000 + slot.start * 1000;
  const cycleFor = (k, acc, prevLast) => {
    const raw = cycleList(lists, slot, k);
    const startMs = slotStartMs + acc * 1000;
    let cl = raw.filter((t) => createdMs(t) <= startMs);
    if (!cl.length) cl = raw;
    const sched = interleaveArtists(seededShuffle(cl, slotKey + k), prevLast);
    return { cl, sched };
  };
  const durOf = (t) => parseDuration(t.duration) || FALLBACK_DURATION;
  let acc = 0;
  let prevList = null;
  for (let k = 0; k < MAX_CYCLES_PER_DAY; k++) {
    const prevLast = prevList
      ? interleaveArtists(seededShuffle(prevList, slotKey + k - 1)).slice(-1)[0].artist
      : null;
    const { cl, sched } = cycleFor(k, acc, prevLast);
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

function entryFor(track, startsAt, meta) {
  const dur = parseDuration(track.duration) || FALLBACK_DURATION;
  const s = Math.round(startsAt);
  return {
    seq: meta.seq,
    kind: 'song',
    track_id: track.id,
    title: track.title || '',
    artist: track.artist || '',
    genre: track.genre || '',
    language: track.language || '',
    audio_url: track.audio_url || '',
    cover_url: track.cover_url || '',
    duration: track.duration || '',
    starts_at: s,
    ends_at: s + dur * 1000,
    slot_key: meta.slotKey,
    k: meta.k,
    pos: meta.pos,
    order: meta.order,
  };
}

function nextEntry(last, lists, byId) {
  const start = last.ends_at;
  const { slot, slotKey } = slotAt(start);
  let k = 0;
  if (last.slot_key === slotKey && last.order) {
    const ids = String(last.order).split(',');
    let pos = (last.pos || 0) + 1;
    while (pos < ids.length && !byId.has(ids[pos])) pos++;
    if (pos < ids.length) {
      return entryFor(byId.get(ids[pos]), start, {
        seq: last.seq + 1, slotKey, k: last.k, pos, order: last.order,
      });
    }
    k = (last.k || 0) + 1;
  }
  const raw = cycleList(lists, slot, k);
  let cl = raw.filter((t) => createdMs(t) <= start);
  if (!cl.length) cl = raw;
  const sched = interleaveArtists(seededShuffle(cl, slotKey + k), last.artist);
  return entryFor(sched[0], start, {
    seq: last.seq + 1, slotKey, k, pos: 0, order: sched.map((t) => t.id).join(','),
  });
}

const toList = (r) => (Array.isArray(r) ? r : (r?.items ?? []));

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;
    const now = Date.now();

    const all = toList(await db.Track.filter({}, { limit: 500 }));
    const list = all.filter((t) => t && t.audio_url && t.genre !== 'Cuña');
    if (!list.length) return Response.json({ ok: false, reason: 'sin canciones' });
    const byId = new Map(list.map((t) => [String(t.id), t]));
    const lists = slotLists(list);

    const rows = toList(await db.RadioQueue.filter({}, { sort: '-seq', limit: 300 }));
    const seen = new Set();
    const entries = rows
      .sort((a, b) => a.seq - b.seq || String(a.created_date).localeCompare(String(b.created_date)))
      .filter((e) => (seen.has(e.seq) ? false : (seen.add(e.seq), true)));

    {
      for (const e of [...entries]) {
        // Autocorrección: lo futuro cuya franja ya no coincide con la parrilla actual se regenera.
        if (e.starts_at > now && e.slot_key !== slotAt(e.starts_at).slotKey) {
          await db.RadioQueue.delete(e.id);
          entries.splice(entries.indexOf(e), 1);
        }
      }
    }

    let last = entries[entries.length - 1];
    const created = [];
    let seeded = false;

    if (!last || last.ends_at < now) {
      const pos = legacyPosition(list, now, lists);
      const track = pos.sched[pos.index];
      const startsAt = Math.round(now - pos.offset * 1000);
      if (last && last.ends_at > startsAt) {
        await db.RadioQueue.update(last.id, { ends_at: startsAt });
      }
      const first = entryFor(track, startsAt, {
        seq: (last ? last.seq : 0) + 1,
        slotKey: pos.slotKey,
        k: pos.k,
        pos: pos.index,
        order: pos.sched.map((t) => t.id).join(','),
      });
      created.push(first);
      last = first;
      seeded = true;
    }

    while (last.ends_at < now + HORIZON_MS && created.length < MAX_NEW) {
      const next = nextEntry(last, lists, byId);
      created.push(next);
      last = next;
    }

    if (created.length) await db.RadioQueue.bulkCreate(created);

    let pruned = 0;
    for (const e of entries) {
      if (e.ends_at < now - KEEP_PAST_MS) {
        try { await db.RadioQueue.delete(e.id); pruned++; } catch { /* se reintenta en la próxima */ }
      }
    }

    return Response.json({
      ok: true,
      seeded,
      created: created.length,
      pruned,
      lastEndsAt: last.ends_at,
      aheadMinutes: Math.round((last.ends_at - now) / 60000),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
