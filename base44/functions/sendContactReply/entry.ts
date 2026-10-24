import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const b64 = (s) => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const x of bytes) bin += String.fromCharCode(x);
  return btoa(bin);
};
// Envío por Gmail (la integración Core.SendEmail de la plataforma falla con error 5xx).
async function sendGmail(svc, { to, subject, html }) {
  const { accessToken } = await svc.connectors.getConnection('gmail');
  const body = b64(html).replace(/(.{76})/g, '$1\r\n');
  const mime = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${b64(subject)}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    body,
  ].join('\r\n');
  const raw = b64(mime).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  });
  if (!r.ok) throw new Error(`Gmail ${r.status}: ${(await r.text()).slice(0, 300)}`);
}

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
    await sendGmail(base44.asServiceRole, {
      to: msg.email,
      subject: 'Respuesta a tu mensaje en SONORIA FM',
      html:
        `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#14141f;line-height:1.7">` +
        `<h2 style="color:#8b33ff">Hola${firstName ? ', ' + esc(firstName) : ''}.</h2>` +
        `<p>Gracias por escribirnos. Esta es nuestra respuesta:</p>` +
        `<div style="border-left:3px solid #8b33ff;padding:4px 0 4px 16px;white-space:pre-wrap">${esc(String(reply).trim())}</div>` +
        `<p style="color:#6b7280;font-size:14px">¿Tienes más dudas? Escríbenos de nuevo desde la sección de contacto o sigue escuchando en <a href="https://sonoriafm.com" style="color:#8b33ff">sonoriafm.com</a>.</p>` +
        `<p style="font-size:12px;color:#6b7280">SONORIA FM · Has recibido este correo por un mensaje enviado en sonoriafm.com.</p></div>`,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}