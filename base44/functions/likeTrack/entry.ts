import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// El SDK puede devolver un array o un objeto { items }.
const toList = (r) => (Array.isArray(r) ? r : (r?.items ?? []));

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { trackId, action } = await req.json();

    // Consulta: ids de las canciones a las que este usuario ya dio "me gusta".
    // (TrackLike se crea con service role, así que el cliente no puede leerlo directamente.)
    if (action === 'status') {
      const mine = toList(
        await base44.asServiceRole.entities.TrackLike.filter({ user_id: user.id }, { limit: 1000 })
      );
      return Response.json({ likedIds: [...new Set(mine.map((l) => l.track_id))] });
    }

    if (!trackId || typeof trackId !== 'string') {
      return Response.json({ error: 'trackId requerido' }, { status: 400 });
    }

    // El registro es público pero solo los administradores pueden editar;
    // para el "me gusta" de cualquier visitante elevamos a service role tras verificar sesión.
    const track = await base44.asServiceRole.entities.Track.get(trackId);
    if (!track) return Response.json({ error: 'Canción no encontrada' }, { status: 404 });

    // Deduplicación por usuario: un "me gusta" por usuario y canción.
    const existing = toList(
      await base44.asServiceRole.entities.TrackLike.filter({ track_id: trackId, user_id: user.id }, { limit: 10 })
    );
    let alreadyLiked = existing.length > 0;

    if (!alreadyLiked) {
      const created = await base44.asServiceRole.entities.TrackLike.create({
        track_id: trackId,
        user_id: user.id,
      });

      // Protección ante peticiones simultáneas (doble clic, dos pestañas): si hay más de un
      // registro para este usuario y canción, solo cuenta el más antiguo; el resto se descarta.
      const all = toList(
        await base44.asServiceRole.entities.TrackLike.filter({ track_id: trackId, user_id: user.id }, { limit: 10 })
      ).sort(
        (a, b) =>
          String(a.created_date).localeCompare(String(b.created_date)) ||
          String(a.id).localeCompare(String(b.id))
      );

      if (all.length > 0 && created?.id && all[0].id !== created.id) {
        await base44.asServiceRole.entities.TrackLike.delete(created.id);
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
