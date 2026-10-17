import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Envía la respuesta del administrador al autor de un mensaje de contacto.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { message_id, reply } = await req.json().catch(() => ({}));
    if (!message_id || !reply || !String(reply).trim()) {
      return Response.json({ error: 'Faltan datos' }, { status: 400 });
    }

    const msg = await base44.entities.ContactMessage.get(String(message_id));
    if (!msg) return Response.json({ error: 'Mensaje no encontrado' }, { status: 404 });

    const firstName = String(msg.name || '').trim().split(/\s+/)[0] || '';
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: msg.email,
      template_name: 'RespuestaContacto',
      variables: { first_name: firstName, reply: String(reply).trim() },
    });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}