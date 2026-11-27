import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Datos públicos de un diploma del TOP semanal. El diploma solo existe si hay un puesto
// guardado en el cierre de la semana: nadie puede inventarse uno cambiando el enlace.
const MIN_VOTES = 3;
const HOUSE_ARTISTS = ['oldestman', 'sonoria', 'sonoria fm'];
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const { id } = await req.json().catch(() => ({}));
    if (!id || typeof id !== 'string' || !/^[a-f0-9]{24}$/i.test(id)) {
      return Response.json({ error: 'Diploma no encontrado' }, { status: 404 });
    }
    const db = base44.asServiceRole.entities;
    const win = await db.TopWeek.get(id).catch(() => null);
    const position = Number(win?.position) || 0;
    const likes = Number(win?.likes) || 0;
    if (!win || position < 1 || position > 3 || likes < MIN_VOTES || HOUSE_ARTISTS.includes(norm(win.artist))) {
      return Response.json({ error: 'Diploma no encontrado' }, { status: 404 });
    }
    const track = win.track_id ? await db.Track.get(win.track_id).catch(() => null) : null;
    return Response.json({
      diploma: {
        song_title: win.song_title,
        artist: win.artist,
        position,
        likes,
        tie: Boolean(win.tie),
        week_date: String(win.week_date).slice(0, 10),
        track_id: track?.id || '',
        cover_url: track?.cover_url || '',
      },
    });
  } catch (error) {
    console.error('diploma:', error?.message);
    return Response.json({ error: 'No se ha podido cargar el diploma' }, { status: 500 });
  }
}
