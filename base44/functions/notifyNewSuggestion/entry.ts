import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const ADMIN_EMAIL = 'oldestmanmusic@gmail.com';
const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Envío por Gmail (la integración Core.SendEmail de la plataforma falla con error 5xx).
const b64 = (s) => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const x of bytes) bin += String.fromCharCode(x);
  return btoa(bin);
};
async function sendGmail(base44, { to, subject, html }) {
  const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
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

// Avisa al administrador por email cuando llega una sugerencia nueva.
// Lo llama el flujo automático (como administrador).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    let suggestion = body.message ? { category: body.category, message: body.message } : null;
    if (!suggestion && body.suggestion_id) {
      try {
        suggestion = await base44.asServiceRole.entities.Suggestion.get(body.suggestion_id);
      } catch (e) {
        console.error('Suggestion.get falló:', e?.message);
      }
    }
    if (!suggestion) return Response.json({ error: 'Sugerencia no encontrada' }, { status: 404 });

    await sendGmail(base44, {
      to: ADMIN_EMAIL,
      subject: `Nueva sugerencia en SONORIA FM (${suggestion.category || 'Mejora'})`,
      html:
        `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#14141f">` +
        `<h2 style="color:#8b33ff">Nueva sugerencia</h2>` +
        `<p><strong>Tipo:</strong> ${esc(suggestion.category || 'Mejora')}</p>` +
        `<p style="white-space:pre-wrap">${esc(suggestion.message)}</p>` +
        `<p><a href="https://sonoriafm.com/sugerencias" style="color:#8b33ff">Revisar en el panel</a></p></div>`,
    });

    return Response.json({ sent: true });
  } catch (error) {
    console.error('notifyNewSuggestion falló:', error?.message);
    return Response.json({ error: error?.message || 'Error' }, { status: 500 });
  }
}
