import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// PÚBLICA. Apunta un minuto de escucha real de la radio. La web la llama cada vez que ha sonado
// un minuto completo. Es anónima: no guarda usuario ni IP; "sid" es un código aleatorio que solo
// vive en memoria mientras la página está abierta.
//
// Uso: POST .../functions/listenPing  { sid, mode, zone, track_id, title, artist }

const ZONES = ['eu', 'sa', 'co', 'mx'];
const text = (v, max) => String(v ?? '').slice(0, max);
const madridDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Madrid',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Método no permitido' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const sid = text(body.sid, 40);
    if (!/^[a-z0-9]{8,40}$/.test(sid)) return Response.json({ error: 'sid no válido' }, { status: 400 });

    // Las escuchas de los administradores se marcan para no inflar las cifras.
    let own = false;
    try {
      const user = await base44.auth.me();
      own = user?.role === 'admin';
    } catch (_) { /* oyente sin sesión */ }

    await base44.asServiceRole.entities.ListenStat.create({
      sid,
      date: madridDay.format(new Date()),
      mode: body.mode === 'cancion' ? 'cancion' : 'directo',
      zone: ZONES.includes(body.zone) ? body.zone : 'eu',
      track_id: text(body.track_id, 40),
      title: text(body.title, 160),
      artist: text(body.artist, 120),
      own,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
