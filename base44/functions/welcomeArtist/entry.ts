import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

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

const APP_URL = 'https://sonoriafm.com/app';

// Tarjeta de la canción recién enviada, hecha con tablas para que se vea en cualquier correo.
// La canción aún está en revisión, así que no invita a votar ni enlaza a su página.
const songCard = ({ title, artist, coverUrl }) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="100%" bgcolor="#1a1040" ` +
  `style="max-width:360px;margin:22px auto;background:#1a1040;border-radius:24px;text-align:center">` +
  `<tr><td style="padding:18px 20px 14px;color:#b9a4ff;font-size:13px;font-weight:bold;letter-spacing:1px">NUEVA CANCIÓN · EN REVISIÓN</td></tr>` +
  (coverUrl
    ? `<tr><td style="padding:0 20px"><img src="${esc(coverUrl)}" width="320" alt="Carátula de ${esc(title)}" ` +
      `style="display:block;width:100%;max-width:320px;height:auto;margin:auto;border:0;border-radius:16px"></td></tr>`
    : '') +
  `<tr><td style="padding:16px 20px 0;color:#ffffff;font-size:22px;font-weight:bold;line-height:1.3">${esc(title)}</td></tr>` +
  `<tr><td style="padding:4px 20px 0;color:#d8d8e8;font-size:16px">${esc(artist)}</td></tr>` +
  `<tr><td style="padding:16px 20px 20px;color:#b9a4ff;font-size:13px;font-weight:bold">SONORIA FM · sonoriafm.com</td></tr>` +
  `</table>`;

const appButton = () =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 8px">` +
  `<tr><td bgcolor="#8b33ff" style="background:#8b33ff;border-radius:999px;text-align:center">` +
  `<a href="${APP_URL}" style="display:inline-block;padding:14px 30px;color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none">Descargar la app</a>` +
  `</td></tr></table>` +
  `<p style="margin:0 0 22px;text-align:center;font-size:13px;color:#6b7280">La app de SONORIA FM es gratis.</p>`;

// Carátula del envío que ha disparado este correo. Si no se encuentra, la tarjeta va sin imagen.
async function findCover(base44, email, songTitle) {
  try {
    const found = await base44.asServiceRole.entities.Submission.filter(
      { email, song_title: songTitle },
      '-created_date',
      1,
    );
    const url = String(found?.[0]?.cover_url || '');
    return url.startsWith('https://') ? url : '';
  } catch (error) {
    console.error('welcomeArtist sin carátula:', error?.message);
    return '';
  }
}

// Email de bienvenida al artista que acaba de enviar una canción.
// Lo llama el flujo automático como administrador.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const b = await req.json().catch(() => ({}));
    const email = typeof b.email === 'string' ? b.email.trim() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ sent: false, reason: 'El envío no tiene un email válido' });
    }

    const songTitle = typeof b.song_title === 'string' ? b.song_title : '';
    const coverUrl = songTitle ? await findCover(base44, email, songTitle) : '';

    await sendGmail(base44, {
      to: email,
      subject: 'Hemos recibido tu canción en SONORIA FM',
      html:
        `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#14141f;line-height:1.6">` +
        `<h2 style="color:#8b33ff">¡Gracias por tu canción, ${esc(b.artist_name || 'artista')}!</h2>` +
        `<p>Ya tenemos <strong>${esc(b.song_title || 'tu canción')}</strong> y en breve la escuchamos con calma. ` +
        `Antes de publicarla la revisamos con cariño; en cuanto tengamos novedades te escribimos por aquí.</p>` +
        songCard({ title: songTitle || 'Tu canción', artist: b.artist_name || '', coverUrl }) +
        appButton() +
        `<div style="background:#f0f0f4;border-radius:16px;padding:16px 20px">` +
        `<p style="margin:0 0 8px"><strong>Consigue más visibilidad</strong> (extras de pago opcionales):</p>` +
        `<ul style="margin:0;padding-left:18px">` +
        `<li><strong>Artista destacado de la semana:</strong> 15 €</li>` +
        `<li><strong>Reseña o entrevista en la web:</strong> 20 €</li>` +
        `<li><strong>Más rotación de tu tema:</strong> 10 €/mes</li></ul>` +
        `<p style="margin:12px 0 0"><a href="https://sonoriafm.com/promociona-tu-musica" style="color:#8b33ff;font-weight:bold">Ver servicios de promoción</a></p></div>` +
        `<p>Si te interesa alguno, responde a este email o escribe a ` +
        `<a href="mailto:sonoriafm@gmail.com" style="color:#8b33ff">sonoriafm@gmail.com</a>.</p>` +
        `<p>Un abrazo,<br><strong>Víctor, SONORIA FM</strong></p></div>`,
    });

    return Response.json({ sent: true });
  } catch (error) {
    console.error('welcomeArtist falló:', error?.message);
    return Response.json({ error: error?.message || 'Error' }, { status: 500 });
  }
}
