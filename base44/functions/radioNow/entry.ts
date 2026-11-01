import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// PÚBLICA. Devuelve qué suena ahora en SONORIA FM y las siguientes canciones, con su hora de
// inicio y fin exactas (ms desde 1970). Lee la cola de emisión (entidad RadioQueue) que mantiene
// la función radioQueue: cada canción empieza justo cuando acaba la anterior, así que no hay
// cortes ni solapes, y el cambio de franja de la parrilla ocurre al terminar la canción en curso.
//
// Uso: POST/GET .../functions/radioNow   (opcional: { "count": 12, "at": 1700000000000, "backMs": 0 })
//   count  -> cuántas canciones devolver (1-60, por defecto 12)
//   at     -> instante a partir del cual se devuelve (por defecto, ahora)
//   backMs -> empezar esos ms ANTES de "at" (la web pide algo de historial para no perder la actual)
// Respuesta: { serverTime, tracks: [{ id, kind, title, artist, genre, language, audio_url,
//   cover_url, duration, startsAt, endsAt }] }. tracks[0] es la que cubre "at" (o "at - backMs").
// Hay que reproducirla desde (serverTime - startsAt) ms.

const MIN_AHEAD_MS = 8 * 60 * 1000;
const toList = (r) => (Array.isArray(r) ? r : (r?.items ?? []));

async function loadQueue(db) {
  const rows = toList(await db.RadioQueue.filter({}, { sort: '-seq', limit: 300 }));
  const seen = new Set();
  return rows
    .sort((a, b) => a.seq - b.seq || String(a.created_date).localeCompare(String(b.created_date)))
    .filter((e) => (seen.has(e.seq) ? false : (seen.add(e.seq), true)));
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    let params = {};
    if (req.method === 'GET') {
      params = Object.fromEntries(new URL(req.url).searchParams.entries());
    } else {
      params = await req.json().catch(() => ({}));
    }
    const count = Math.max(1, Math.min(60, parseInt(params.count, 10) || 12));
    const at = Number(params.at);
    const backMs = Math.max(0, Number(params.backMs) || 0);
    const t = (Number.isFinite(at) && at > 0 ? at : Date.now()) - backMs;
    const db = base44.asServiceRole.entities;

    let queue = await loadQueue(db);
    let last = queue[queue.length - 1];
    // Si la cola se queda corta (la tarea programada no ha corrido), se rellena aquí mismo.
    if (!last || last.ends_at < Math.max(t, Date.now()) + MIN_AHEAD_MS) {
      try {
        await base44.asServiceRole.functions.invoke('radioQueue', {});
        queue = await loadQueue(db);
      } catch (e) {
        /* se responde con lo que haya */
      }
    }

    const from = queue.findIndex((e) => e.ends_at > t);
    const slice = from < 0 ? [] : queue.slice(from, from + count);
    return Response.json(
      {
        serverTime: Date.now(),
        tracks: slice.map((e) => ({
          id: e.track_id,
          kind: e.kind || 'song',
          title: e.title,
          artist: e.artist,
          genre: e.genre || '',
          language: e.language || '',
          audio_url: e.audio_url,
          cover_url: e.cover_url || '',
          duration: e.duration || '',
          startsAt: e.starts_at,
          endsAt: e.ends_at,
        })),
      },
      { headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
