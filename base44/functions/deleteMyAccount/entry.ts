import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

    const service = base44.asServiceRole;
    // Datos asociados del usuario antes de borrar la cuenta.
    try {
      await service.entities.Submission.deleteMany({ created_by_id: user.id });
    } catch { /* sin registros propios */ }
    try {
      await service.entities.ContactMessage.deleteMany({ created_by_id: user.id });
    } catch { /* sin registros propios */ }

    try {
      if (user.email) await service.entities.Subscriber.deleteMany({ email: user.email.toLowerCase() });
    } catch { /* sin correo apuntado */ }

    try {
      const hearts = await service.entities.ArtistLike.filter({ user_id: user.id }, { limit: 1000 });
      for (const h of Array.isArray(hearts) ? hearts : (hearts?.items ?? [])) {
        await service.entities.ArtistLike.delete(h.id);
        await service.entities.Artist.updateMany({ id: h.artist_id }, { $inc: { likes: -1 } });
      }
    } catch { /* sin corazones */ }

    await service.entities.User.delete(user.id);

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}