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

    await sendGmail(base44, {
      to: email,
      subject: 'Hemos recibido tu canción en SONORIA FM',
      html:
        `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#14141f;line-height:1.6">` +
        `<h2 style="color:#8b33ff">¡Gracias por tu canción, ${esc(b.artist_name || 'artista')}!</h2>` +
        `<p>Ya tenemos <strong>${esc(b.song_title || 'tu canción')}</strong> y en breve la escuchamos con calma. ` +
        `Antes de publicarla la revisamos con cariño; en cuanto tengamos novedades te escribimos por aquí.</p>` +
        `<div style="background:#f0f0f4;border-radius:16px;padding:16px 20px">` +
        `<p style="margin:0 0 8px"><strong>Consigue más visibilidad</strong> (extras de pago opcionales):</p>` +
        `<ul style="margin:0;padding-left:18px">` +
        `<li><strong>Artista destacado de la semana:</strong> 15 €</li>` +
        `<li><strong>Reseña o entrevista en la web:</strong> 20 €</li>` +
        `<li><strong>Más rotación de tu tema:</strong> 10 €/mes</li></ul>` +
        `<p style="margin:12px 0 0"><a href="https://sonoriafm.com/promociona-tu-musica" style="color:#8b33ff;font-weight:bold">Ver servicios de promoción</a></p></div>` +
        `<p>Si te interesa alguno, responde a este email o escribe a ` +
        `<a href="mailto:Oldestmanmusic@gmail.com" style="color:#8b33ff">Oldestmanmusic@gmail.com</a>.</p>` +
        `<p>Un abrazo,<br><strong>Víctor, SONORIA FM</strong></p></div>`,
    });

    return Response.json({ sent: true });
  } catch (error) {
    console.error('welcomeArtist falló:', error?.message);
    return Response.json({ error: error?.message || 'Error' }, { status: 500 });
  }
}
