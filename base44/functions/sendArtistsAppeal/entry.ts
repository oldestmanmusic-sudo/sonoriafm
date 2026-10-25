import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const EXCLUDE = new Set(['victormovil77@gmail.com']); // segunda cuenta del propietario
const toList = (r) => (Array.isArray(r) ? r : (r?.items ?? []));
const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const b64 = (s) => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const x of bytes) bin += String.fromCharCode(x);
  return btoa(bin);
};
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

function buildHtml(name) {
  const hello = name ? `¡Hola, ${esc(name)}!` : '¡Hola!';
  return (
    `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#14141f;line-height:1.6">` +
    `<h2 style="color:#8b33ff">${hello}</h2>` +
    `<p>Gracias de corazón por formar parte de <strong>SONORIA FM</strong>. Que tu música suene en nuestra radio es lo que le da sentido a este proyecto.</p>` +
    `<p>Hoy te escribimos para pedirte una ayuda importante: <strong>comparte la radio con todos los que puedas</strong> (familia, amigos, tus redes, tus grupos…). Cuanta más gente nos conozca, más creceremos, y cuanto más crezcamos, <strong>más variedad de música podremos ofrecer</strong> y más oídos tendrá tu música.</p>` +
    `<p>Y, sobre todo, necesitamos vuestra ayuda con los <strong>votos del TOP 10</strong>. Las canciones con más &ldquo;me gusta&rdquo; forman el Top 10 de la semana, y esas suenan el doble en la franja Top Sonoria. Pide a quien te escuche que vote con un &ldquo;me gusta&rdquo; las canciones que más le gusten, también la tuya. Cada lunes a las 00:00 (hora de Madrid) empieza una semana nueva, así que todos partís de cero.</p>` +
    `<p style="margin-top:24px"><a href="https://sonoriafm.com" style="background:#8b33ff;color:#fff;padding:12px 26px;border-radius:24px;text-decoration:none;font-weight:bold">Escuchar y compartir SONORIA FM</a></p>` +
    `<p>Enlace para compartir: <a href="https://sonoriafm.com" style="color:#8b33ff">sonoriafm.com</a></p>` +
    `<p>Gracias por tu apoyo. Sin vosotros, esto no sería posible.</p>` +
    `<p>Un abrazo,<br><strong>SONORIA FM</strong><br>La radio de la música hecha con IA</p>` +
    `<p style="font-size:12px;color:#6b7280">Recibes este correo porque tienes cuenta de artista en SONORIA FM. Si prefieres no recibir más avisos como este, responde con la palabra BAJA.</p></div>`
  );
}

// Admin: envía un correo a todos los artistas registrados (una copia individual a cada uno).
// { test_to: "correo" } envía solo una muestra a esa dirección.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole;
    const subject = 'Ayúdanos a hacer crecer SONORIA FM (y a votar el TOP 10)';

    if (body.test_to) {
      await sendGmail(svc, { to: String(body.test_to), subject, html: buildHtml('Artista') });
      return Response.json({ test_sent: true });
    }

    const users = toList(await svc.entities.User.list('-created_date', 500));
    const subs = toList(await svc.entities.Submission.filter({}, { limit: 1000 }));
    const artistByEmail = new Map();
    for (const s of subs) {
      const e = String(s.email || '').toLowerCase();
      if (e && s.artist_name && !artistByEmail.has(e)) artistByEmail.set(e, String(s.artist_name).trim());
    }
    const seen = new Set();
    const recipients = [];
    for (const u of users) {
      const e = String(u.email || '').trim().toLowerCase();
      if (!e || seen.has(e) || EXCLUDE.has(e)) continue;
      seen.add(e);
      recipients.push({ email: e, name: artistByEmail.get(e) || '' });
    }

    let sent = 0;
    const failed = [];
    const started = Date.now();
    for (const r of recipients) {
      if (Date.now() - started > 45000) { failed.push(`${r.email}: sin tiempo`); continue; }
      try {
        await sendGmail(svc, { to: r.email, subject, html: buildHtml(r.name) });
        sent += 1;
      } catch (e) {
        failed.push(`${r.email}: ${String(e.message).slice(0, 120)}`);
      }
      await new Promise((res) => setTimeout(res, 800));
    }
    return Response.json({ recipients: recipients.length, sent, failed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
