import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { trackId } = await req.json();
    if (!trackId || typeof trackId !== 'string') {
      return Response.json({ error: 'trackId requerido' }, { status: 400 });
    }

    // El registro es público pero solo los administradores pueden editar;
    // para el "me gusta" de cualquier visitante elevamos a service role tras verificar sesión.
    const track = await base44.asServiceRole.entities.Track.get(trackId);
    if (!track) return Response.json({ error: 'Canción no encontrada' }, { status: 404 });

    // Deduplicación por usuario: un "me gusta" por usuario y canción.
    const existing = await base44.asServiceRole.entities.TrackLike.filter({
      track_id: trackId,
      user_id: user.id,
    }, { limit: 1 });
    const alreadyLiked = (existing && existing.length > 0) || (existing && existing.items && existing.items.length > 0);

    if (!alreadyLiked) {
      await base44.asServiceRole.entities.TrackLike.create({
        track_id: trackId,
        user_id: user.id,
      });
      // Incremento atómico del contador en el servidor.
      await base44.asServiceRole.entities.Track.updateMany({ id: trackId }, { $inc: { likes: 1 } });
    }

    const updated = await base44.asServiceRole.entities.Track.get(trackId);
    return Response.json({ likes: updated.likes ?? track.likes ?? 0, liked: true, already: alreadyLiked });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}