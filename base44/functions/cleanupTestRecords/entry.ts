import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Temporal: borra los registros de prueba creados al verificar los correos.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const db = base44.asServiceRole.entities;
    const toList = (r) => (Array.isArray(r) ? r : (r?.items ?? []));
    let n = 0;
    for (const s of toList(await db.Submission.filter({ artist_name: 'PRUEBA Oldestman' }, { limit: 20 }))) {
      await db.Submission.delete(s.id);
      n += 1;
    }
    for (const m of toList(await db.ContactMessage.filter({ name: 'Oldestman Prueba' }, { limit: 20 }))) {
      await db.ContactMessage.delete(m.id);
      n += 1;
    }
    return Response.json({ deleted: n });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
