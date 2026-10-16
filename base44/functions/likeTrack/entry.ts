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

    const likes = (track.likes ?? 0) + 1;
    await base44.asServiceRole.entities.Track.update(trackId, { likes });
    return Response.json({ likes });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}