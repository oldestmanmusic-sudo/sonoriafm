import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Corazón a un artista. Se puede dar CON o SIN cuenta: uno por oyente y artista.
// A diferencia de los votos de canciones, no se reinician cada lunes.
//
// Topes sin cuenta (frenan a quien borra el código para repetir). No se guarda la IP: solo un
// resumen cifrado distinto cada día, que se vacía en cuanto pasa ese día.
const MAX_NET_ARTIST_DAY = 3; // misma conexión, mismo artista, mismo día (una familia, p. ej.)
const MAX_NET_DAY = 30; // misma conexión, mismo día, todos los artistas
const MAX_ANON_ARTIST_DAY = 40; // todos los corazones sin cuenta de un artista en un día

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
    const { artistId, action } = body;
    const did = typeof body.did === 'string' && DID.test(body.did) ? body.did : '';
    const anonId = did ? `anon:${did}` : '';
    const voter = user ? user.id : anonId;

    const db = base44.asServiceRole.entities;
    const find = async (query, limit = 1000) => toList(await db.ArtistLike.filter(query, { limit }));

    // Los corazones propios: los de la cuenta y los dados sin cuenta desde este dispositivo.
    const mine = async (extra = {}) => {
      const queries = user
        ? [{ ...extra, user_id: user.id }, ...(anonId ? [{ ...extra, user_id: anonId }] : [])]
        : [{ ...extra, user_id: anonId }, { ...extra, did }];
      const found = (await Promise.all(queries.map((q) => find(q)))).flat();
      return [...new Map(found.map((l) => [l.id, l])).values()];
    };

    // Consulta: ids de los artistas que ya tienen corazón de este oyente.
    if (action === 'status') {
      if (!voter) return Response.json({ likedIds: [] });
      return Response.json({ likedIds: [...new Set((await mine()).map((l) => l.artist_id))] });
    }

    if (req.method !== 'POST') return Response.json({ error: 'Método no permitido' }, { status: 405 });
    if (!voter) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!artistId || typeof artistId !== 'string' || !/^[a-f0-9]{24}$/i.test(artistId)) {
      return Response.json({ error: 'artistId requerido' }, { status: 400 });
    }

    const artist = await db.Artist.get(artistId).catch(() => null);
    if (!artist) return Response.json({ error: 'Artista no encontrado' }, { status: 404 });

    let alreadyLiked = (await mine({ artist_id: artistId })).length > 0;

    if (!alreadyLiked) {
      const day = madridDay.format(new Date());
      let net = '';
      if (!user) {
        net = await networkKey(req, day);
        const [sameNetArtist, sameNet, anonArtist] = await Promise.all([
          net ? find({ artist_id: artistId, net }, MAX_NET_ARTIST_DAY) : [],
          net ? find({ net }, MAX_NET_DAY) : [],
          find({ artist_id: artistId, anon: true, day }, MAX_ANON_ARTIST_DAY),
        ]);
        if (
          sameNetArtist.length >= MAX_NET_ARTIST_DAY ||
          sameNet.length >= MAX_NET_DAY ||
          anonArtist.length >= MAX_ANON_ARTIST_DAY
        ) {
          return Response.json({ error: 'limit', likes: artist.likes ?? 0 }, { status: 429 });
        }
      }

      const created = await db.ArtistLike.create({ artist_id: artistId, user_id: voter, did, anon: !user, day, net });

      // Ante peticiones simultáneas (doble clic, dos pestañas) solo cuenta el registro más antiguo.
      const all = (await find({ artist_id: artistId, user_id: voter }, 10)).sort(
        (a, b) =>
          String(a.created_date).localeCompare(String(b.created_date)) ||
          String(a.id).localeCompare(String(b.id))
      );
      if (all.length > 0 && created?.id && all[0].id !== created.id) {
        await db.ArtistLike.delete(created.id);
        alreadyLiked = true;
      } else {
        await db.Artist.updateMany({ id: artistId }, { $inc: { likes: 1 } });
      }

      // Los resúmenes de conexión de días anteriores ya no sirven: se vacían.
      try {
        await db.ArtistLike.updateMany({ day: { $lt: day }, net: { $ne: '' } }, { $set: { net: '' } });
      } catch (e) {
        console.error('likeArtist limpieza:', e?.message);
      }
    }

    const updated = await db.Artist.get(artistId);
    return Response.json({ likes: updated.likes ?? artist.likes ?? 0, liked: true, already: alreadyLiked });
  } catch (error) {
    console.error('likeArtist:', error?.message);
    return Response.json({ error: 'No se ha podido contar el corazón' }, { status: 500 });
  }
}
