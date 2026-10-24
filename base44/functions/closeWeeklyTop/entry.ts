import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Hoja de Drive "Semanas en el TOP".
const SHEET_ID = '1cTARVbWGpATPREcvSSJ-5jANQID20dxW_KgAjUcpvJ8';

const toList = (r) => (Array.isArray(r) ? r : (r?.items ?? []));

// Fecha (AAAA-MM-DD) en hora de Madrid.
function madridDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

// Cierre semanal: 1) guarda el TOP 3 (con empates), 2) pone los "me gusta" a cero.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const db = base44.asServiceRole.entities;
    const weekDate = madridDate();

    // Idempotencia: si ya se cerró esta fecha no se repite (evita reiniciar dos veces).
    const done = toList(await db.TopWeek.filter({ week_date: weekDate }, { limit: 1 }));
    if (done.length > 0) {
      return Response.json({ skipped: true, reason: 'Ya cerrado', week_date: weekDate });
    }

    const tracks = toList(await db.Track.list('-likes', 1000));
    const ranked = tracks
      .map((t) => ({ ...t, likes: Number(t.likes) || 0 }))
      .filter((t) => t.likes > 0)
      .sort((a, b) => b.likes - a.likes);

    // Ranking deportivo: las canciones empatadas comparten puesto y se salta el siguiente
    // (6, 3, 3, 3, 3 => puesto 1, 2, 2, 2, 2). Solo se guardan los puestos 1 a 3.
    const entries = [];
    ranked.forEach((t, i) => {
      const position = ranked.findIndex((x) => x.likes === t.likes) + 1;
      if (position > 3) return;
      const tie = ranked.filter((x) => x.likes === t.likes).length > 1;
      entries.push({
        week_date: weekDate,
        position,
        song_title: t.title,
        artist: t.artist,
        likes: t.likes,
        tie,
        track_id: t.id,
      });
    });

    // 1) Registro en la web (siempre, antes de tocar los likes).
    for (const e of entries) await db.TopWeek.create(e);
    // Marca de semana cerrada aunque nadie tuviera likes.
    if (entries.length === 0) {
      await db.TopWeek.create({
        week_date: weekDate,
        position: 0,
        song_title: '(sin me gusta esta semana)',
        artist: '-',
        likes: 0,
        tie: false,
      });
    }

    // 2) Registro en la hoja de Drive (si falla, el registro de la web ya está a salvo).
    let sheet = 'ok';
    try {
      if (entries.length > 0) {
        const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');
        const values = entries.map((e) => [
          e.week_date,
          e.position,
          e.song_title,
          e.artist,
          e.likes,
          e.tie ? 'Empate' : '',
        ]);
        const url =
          `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/A1:append` +
          `?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
        const r = await fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values }),
        });
        if (!r.ok) sheet = `error ${r.status}: ${(await r.text()).slice(0, 300)}`;
      }
    } catch (err) {
      sheet = `error: ${err.message}`;
    }

    // 3) Reinicio: contador a cero y se liberan los "me gusta" para que cada usuario pueda votar de nuevo.
    let reset = 0;
    for (const t of tracks) {
      if ((Number(t.likes) || 0) !== 0) {
        await db.Track.update(t.id, { likes: 0 });
        reset += 1;
      }
    }
    let removed = 0;
    for (;;) {
      const batch = toList(await db.TrackLike.list('-created_date', 500));
      if (batch.length === 0) break;
      for (const l of batch) {
        await db.TrackLike.delete(l.id);
        removed += 1;
      }
    }

    return Response.json({ week_date: weekDate, saved: entries.length, sheet, tracks_reset: reset, likes_removed: removed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
