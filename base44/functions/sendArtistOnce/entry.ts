import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// DE UN SOLO USO. Invitación personal a un artista, aprobada por Víctor el 28/11/2026.
// Destinatario y texto fijos; se envía una sola vez y la función caduca el 29/11/2026.
const EXPIRES = Date.parse('2026-11-29T00:00:00Z');
const PROSPECT_ID = '6aedd1281410ab6bbf3768c4';
const TO = 'planetmusicfactory@gmail.com';
const SUBJECT = 'Héctor, ¿quieres que tus canciones suenen en SONORIA FM?';
const SITE = 'https://sonoriafm.com';
const a = (url, text) => `<a href="${url}" style="color:#8b33ff;font-weight:bold">${text}</a>`;
const html = () =>
  `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;font-size:15px;line-height:1.6;color:#14141f">` +
  `<p>Hola, Héctor:</p>` +
  `<p>Soy Víctor, de ${a(SITE, 'SONORIA FM')}, una radio online de música hecha con IA que llevo desde España. He visto que desarrollas música original y proyectos con IA, y me gustaría que tus canciones sonaran en la radio.</p>` +
  `<p>Enviarlas es gratis, cada tema tiene su propia página y los oyentes pueden votarlo en el TOP 10 semanal.</p>` +
  `<p>${a(`${SITE}/envia-tu-cancion`, 'Enviar una canción')}</p>` +
  `<p>¡Un saludo!<br>Víctor Amorós<br>SONORIA FM · ${a(SITE, 'sonoriafm.com')}<br>${a('mailto:sonoriafm@gmail.com', 'sonoriafm@gmail.com')}</p>` +
  // Botón de la app: va en todos los correos de la radio.
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:22px auto 8px">` +
  `<tr><td bgcolor="#8b33ff" style="background:#8b33ff;border-radius:999px;text-align:center">` +
  `<a href="${SITE}/app" style="display:inline-block;padding:14px 30px;color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none">Descargar la app</a>` +
  `</td></tr></table>` +
  `<p style="margin:0 0 22px;text-align:center;font-size:13px;color:#6b7280">La app de SONORIA FM es gratis.</p>` +
  `<p style="font-size:12px;color:#6b7280">Es un mensaje personal y único. Si prefieres que no te vuelva a escribir, respóndeme y listo.</p></div>`;

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

export default async function(req) {
  try {
    if (Date.now() >= EXPIRES) return Response.json({ sent: false, reason: 'caducada' });
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;
    const p = await db.Prospect.get(PROSPECT_ID);
    if (p?.stage !== 'borrador_listo' || p?.email !== TO) return Response.json({ sent: false, reason: 'omitido' });
    // Se marca antes de enviar para que no pueda repetirse.
    await db.Prospect.update(PROSPECT_ID, { stage: 'contactado', next_step: 'Esperar respuesta (enviado el 28-11-2026)', next_step_date: '2026-12-05' });
    try {
      await sendGmail(base44, { to: TO, subject: SUBJECT, html: html() });
    } catch (e) {
      await db.Prospect.update(PROSPECT_ID, { stage: 'borrador_listo', next_step: 'Falló el envío: revisar' });
      throw e;
    }
    return Response.json({ sent: true });
  } catch (error) {
    console.error('sendArtistOnce falló:', error?.message);
    return Response.json({ error: error?.message || 'Error' }, { status: 500 });
  }
}
