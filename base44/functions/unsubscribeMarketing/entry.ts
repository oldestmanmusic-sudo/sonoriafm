import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const toList = (r) => (Array.isArray(r) ? r : (r?.items ?? []));

// Pública: da de baja a un contacto de marketing a partir de su token (enlace del correo).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const { token } = await req.json().catch(() => ({}));
    if (!token || typeof token !== 'string' || token.length < 16) {
      return Response.json({ error: 'Enlace no válido' }, { status: 400 });
    }
    const db = base44.asServiceRole.entities;
    const found = toList(await db.MarketingContact.filter({ token }, { limit: 1 }));
    if (found.length === 0) return Response.json({ error: 'Enlace no válido' }, { status: 404 });
    await db.MarketingContact.update(found[0].id, { status: 'unsubscribed' });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
