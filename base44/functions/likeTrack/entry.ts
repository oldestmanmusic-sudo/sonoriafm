import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// "Me gusta" de una canción. Se puede votar CON o SIN cuenta.
//   - Con cuenta: un voto por usuario y canción (como siempre).
//   - Sin cuenta: un voto por dispositivo y canción. El dispositivo se identifica con un código
//     aleatorio ("did") que genera la web o la app al votar por primera vez.
// Los votos se borran cada lunes (closeWeeklyTop), así que la semana siguiente se puede volver a votar.
//
// Topes para votos sin cuenta (frenan a quien borra el código para votar muchas veces). No se guarda
// la IP: solo un resumen cifrado que cambia cada día y no permite recuperarla.
const MAX_NET_TRACK_DAY = 3; // misma conexión, misma canción, mismo día (una familia, p. ej.)
const MAX_NET_DAY = 30; // misma conexión, mismo día, todas las canciones
const MAX_ANON_TRACK_DAY = 40; // todos los votos sin cuenta de una canción en un día

const DID = /^[a-z0-9]{16,40}$/;

// El SDK puede devolver un array o un objeto { items }.
const toList = (r) => (Array.isArray(r) ? r : (r?.items ?? []));

const madridDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Madrid',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Resumen de la conexión para un día concreto; '' si no se puede calcular. */
async function networkKey(req, day) {
  const salt = Deno.env.get('VOTE_SALT');
  const header = ['cf-connecting-ip', 'x-real-ip', 'x-forwarded-for'].find((h) => req.headers.get(h));
  const ip = header ? req.headers.get(header).split(',')[0].trim() : '';
  if (!salt || !ip) {
    console.log('voto sin cuenta: sin tope por conexión', { salt: Boolean(salt), header: header || null });
    return '';
  }
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(salt), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${day}|${ip}`));
  return [...new Uint8Array(sig)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try {
      user = await base44.auth.me();
    } catch (_) { /* oyente sin sesión */ }

    const body = await req.json().catch(() => ({}));
    const { trackId, action } = body;
    const did = typeof body.did === 'string' && DID.test(body.did) ? body.did : '';
    const anonId = did ? `anon:${did}` : '';
    const voter = user ? user.id : anonId;

    const likesDb = base44.asServiceRole.entities.TrackLike;
    const find = async (query, limit = 1000) => toList(await likesDb.filter(query, { limit }));

    // Los votos propios: los de la cuenta y los hechos sin cuenta desde este dispositivo.
    // Sin cuenta, cuenta todo lo votado desde el dispositivo (también si antes había sesión).
    const myVotes = async (extra = {}) => {
      const queries = user
        ? [{ ...extra, user_id: user.id }, ...(anonId ? [{ ...extra, user_id: anonId }] : [])]
        : [{ ...extra, user_id: anonId }, { ...extra, did }];
      const found = (await Promise.all(queries.map((q) => find(q)))).flat();
      return [...new Map(found.map((l) => [l.id, l])).values()];
    };

    // Consulta: ids de las canciones ya votadas.
    // (TrackLike se crea con service role, así que el cliente no puede leerlo directamente.)
    if (action === 'status') {
      if (!voter) return Response.json({ likedIds: [] });
      const mine = await myVotes();
      return Response.json({ likedIds: [...new Set(mine.map((l) => l.track_id))] });
    }

    // Lista: las canciones favoritas (pestaña "Favoritos" de la app Android). Requiere cuenta.
    if (action === 'list') {
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      const mine = (await myVotes()).sort((a, b) => String(b.created_date).localeCompare(String(a.created_date)));
      const ids = [...new Set(mine.map((l) => l.track_id))].slice(0, 100);
      const tracks = [];
      for (const id of ids) {
        try {
          const t = await base44.asServiceRole.entities.Track.get(id);
          if (t && t.audio_url) {
            tracks.push({ id: t.id, title: t.title || '', artist: t.artist || '', audio_url: t.audio_url, cover_url: t.cover_url || '' });
          }
        } catch (_) { /* canción borrada */ }
      }
      return Response.json({ tracks });
    }

    if (req.method !== 'POST') return Response.json({ error: 'Método no permitido' }, { status: 405 });
    // Las versiones antiguas de la app no envían "did": se les sigue pidiendo sesión.
    if (!voter) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!trackId || typeof trackId !== 'string') {
      return Response.json({ error: 'trackId requerido' }, { status: 400 });
    }

    // El registro es público pero solo los administradores pueden editar;
    // para el "me gusta" de cualquier oyente elevamos a service role tras las comprobaciones.
    const track = await base44.asServiceRole.entities.Track.get(trackId);
    if (!track) return Response.json({ error: 'Canción no encontrada' }, { status: 404 });

    let alreadyLiked = (await myVotes({ track_id: trackId })).length > 0;

    if (!alreadyLiked) {
      const day = madridDay.format(new Date());
      let net = '';
      if (!user) {
        net = await networkKey(req, day);
        const [sameNetTrack, sameNet, anonTrack] = await Promise.all([
          net ? find({ track_id: trackId, net }, MAX_NET_TRACK_DAY) : [],
          net ? find({ net }, MAX_NET_DAY) : [],
          find({ track_id: trackId, anon: true, day }, MAX_ANON_TRACK_DAY),
        ]);
        if (
          sameNetTrack.length >= MAX_NET_TRACK_DAY ||
          sameNet.length >= MAX_NET_DAY ||
          anonTrack.length >= MAX_ANON_TRACK_DAY
        ) {
          return Response.json({ error: 'limit', likes: track.likes ?? 0 }, { status: 429 });
        }
      }

      const created = await likesDb.create({
        track_id: trackId,
        user_id: voter,
        did,
        anon: !user,
        day,
        net,
      });

      // Protección ante peticiones simultáneas (doble clic, dos pestañas): si hay más de un
      // registro para este votante y canción, solo cuenta el más antiguo; el resto se descarta.
      const all = (await find({ track_id: trackId, user_id: voter }, 10)).sort(
        (a, b) =>
          String(a.created_date).localeCompare(String(b.created_date)) ||
          String(a.id).localeCompare(String(b.id))
      );

      if (all.length > 0 && created?.id && all[0].id !== created.id) {
        await likesDb.delete(created.id);
        alreadyLiked = true;
      } else {
        // Incremento atómico del contador en el servidor.
        await base44.asServiceRole.entities.Track.updateMany({ id: trackId }, { $inc: { likes: 1 } });
      }
    }

    const updated = await base44.asServiceRole.entities.Track.get(trackId);
    return Response.json({ likes: updated.likes ?? track.likes ?? 0, liked: true, already: alreadyLiked });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
