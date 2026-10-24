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

const item = (title, text) =>
  `<h3 style="color:#8b33ff;margin:18px 0 4px">${title}</h3><p style="margin:0">${text}</p>`;

// Envía el correo de mejoras de la web. Solo admin puede dispararlo.
// Por defecto solo se envía a Oldestman (prueba); pasar { all: true } para enviarlo a los artistas.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { all } = await req.json().catch(() => ({}));
    const recipients = [{ email: 'Oldestmanmusic@gmail.com', first_name: 'Oldestman' }];
    if (all === true) {
      recipients.push(
        { email: 'alejanprodeco@gmail.com', first_name: 'José alejandro' },
        { email: 'ginmaz@yahoo.es', first_name: 'eri' }
      );
    }

    const results = await Promise.allSettled(
      recipients.map((r) =>
        sendGmail(base44.asServiceRole, {
          to: r.email,
          subject: 'Novedades en SONORIA FM: la radio ahora suena las 24 horas',
          html:
            `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#14141f;line-height:1.6">` +
            `<h2 style="color:#8b33ff">¡Hola, ${esc(r.first_name)}!</h2>` +
            `<p>Tu música ya suena en una SONORIA FM mejorada. Hemos trabajado en la web estos días y queremos contarte lo nuevo.</p>` +
            item('Radio 24 horas de verdad', 'La programación es continua y está anclada al reloj: da igual a qué hora entres, conectarás justo en el punto de la emisión que corresponde.') +
            item('Lista aleatoria con mejor criterio', 'La rotación alterna artistas para que nunca se junten varios temas seguidos del mismo autor.') +
            item('Más estabilidad y mejor reproducción', 'Si una fuente de audio falla, la radio salta automáticamente a la siguiente canción sin parar la emisión.') +
            item('Fichas de canción y páginas de artista', 'Cada canción tiene su página con portada, género, "me gusta" y botón de compartir. Los artistas tienen su página con foto, biografía y todos sus temas.') +
            item('Sube tus canciones', 'Con tu cuenta puedes subir más canciones cuando quieras; tras la aprobación suenan en la radio.') +
            `<p style="margin-top:24px"><a href="https://sonoriafm.com" style="background:#8b33ff;color:#fff;padding:12px 26px;border-radius:24px;text-decoration:none;font-weight:bold">Escuchar SONORIA FM en vivo</a></p>` +
            `<p style="font-size:12px;color:#6b7280">Gracias por formar parte de esta radio independiente.</p></div>`,
        })
      )
    );

    return Response.json({
      sent: results.filter((r) => r.status === 'fulfilled').length,
      failed: results.filter((r) => r.status === 'rejected').map((r) => r.reason?.message || String(r.reason)),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
