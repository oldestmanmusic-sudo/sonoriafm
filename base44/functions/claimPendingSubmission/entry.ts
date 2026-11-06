import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Devuelve (y borra) los envíos pendientes que el artista dejó antes de
// registrarse: los de su email verificado y los de su token de navegador.
// El frontend los convierte en Submission a nombre del usuario.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const token = typeof body.token === 'string' ? body.token : '';
    const email = (user.email || '').trim().toLowerCase();

    const svc = base44.asServiceRole.entities.PendingSubmission;
    const found = new Map();
    if (email) {
      for (const p of await svc.filter({ email }, '-created_date', 50)) found.set(p.id, p);
    }
    if (token) {
      for (const p of await svc.filter({ token }, '-created_date', 50)) found.set(p.id, p);
    }

    const items = [...found.values()];
    for (const p of items) await svc.delete(p.id);

    return Response.json({ items });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
