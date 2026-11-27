import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const EXCLUDE = new Set(['victormovil77@gmail.com', 'oldestmanmusic@gmail.com']); // segunda cuenta del propietario
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

// Botón de la app: va en todos los correos de la radio.
const APP_URL = 'https://sonoriafm.com/app';
const appButton = () =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:22px auto 8px">` +
  `<tr><td bgcolor="#8b33ff" style="background:#8b33ff;border-radius:999px;text-align:center">` +
  `<a href="${APP_URL}" style="display:inline-block;padding:14px 30px;color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none">Descargar la app</a>` +
  `</td></tr></table>` +
  `<p style="margin:0 0 22px;text-align:center;font-size:13px;color:#6b7280">La app de SONORIA FM es gratis.</p>`;

// Tarjetas de canción: solo en correos a artistas y solo con SUS canciones.
const CARD_URL = 'https://sonoriafm.com/tarjeta/';
// Artistas publicados sin envío desde la web, identificados por su correo de contacto.
const EXTRA_ARTISTS = { 'dreamchip@hotmail.com': 'carbono vr', 'juanmalv97@gmail.com': 'los lohim', 'marketglow7@gmail.com': 'inert.ia' };
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const asList = (r) => (Array.isArray(r) ? r : (r?.items ?? []));
const sameSong = (s, t) => norm(s.artist_name) === norm(t.artist) && norm(s.song_title) === norm(t.title);
const songsFor = (email, subs, tracks) => {
  const mail = norm(email);
  if (!mail) return [];
  if (Object.hasOwn(EXTRA_ARTISTS, mail)) return tracks.filter((t) => norm(t.artist) === EXTRA_ARTISTS[mail]);
  const mine = subs.filter((s) => s.status === 'approved' && norm(s.email) === mail);
  return tracks.filter((t) => mine.some((s) => sameSong(s, t) ||
    (!!s.cover_url && s.cover_url === t.cover_url && norm(s.artist_name) === norm(t.artist))));
};
// Si falla la lectura, el correo sale igualmente, sin tarjetas.
async function loadCatalog(db) {
  try {
    const [subs, tracks] = await Promise.all([
      db.entities.Submission.filter({ status: 'approved' }, '-created_date', 1000),
      db.entities.Track.list('-created_date', 1000),
    ]);
    return { subs: asList(subs), tracks: asList(tracks) };
  } catch (e) {
    console.error('loadCatalog:', e?.message);
    return { subs: [], tracks: [] };
  }
}
const cover = (t, size) => /^https:\/\//.test(t.cover_url || '')
  ? `<img src="${esc(t.cover_url)}" width="${size}" alt="Carátula de ${esc(t.title)}" style="display:block;width:100%;max-width:${size}px;height:auto;margin:auto;border:0;border-radius:14px">`
  : '';
const shareLink = (t) => t.id
  ? `<a href="${CARD_URL}${encodeURIComponent(t.id)}" style="display:inline-block;margin-top:10px;padding:10px 20px;background:#ff4d8d;border-radius:999px;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none">Compartir mi tarjeta</a>`
  : '';
const songCard = (t) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="100%" bgcolor="#1a1040" ` +
  `style="max-width:360px;margin:22px auto;background:#1a1040;border-radius:24px;text-align:center">` +
  `<tr><td style="padding:18px 20px 14px;color:#b9a4ff;font-size:13px;font-weight:bold;letter-spacing:1px">VOTA MI CANCIÓN</td></tr>` +
  `<tr><td style="padding:0 20px">${cover(t, 320)}</td></tr>` +
  `<tr><td style="padding:16px 20px 0;color:#ffffff;font-size:22px;font-weight:bold;line-height:1.3">${esc(t.title)}</td></tr>` +
  `<tr><td style="padding:4px 20px 0;color:#d8d8e8;font-size:16px">${esc(t.artist)}</td></tr>` +
  `<tr><td style="padding:4px 20px 0">${shareLink(t)}</td></tr>` +
  `<tr><td style="padding:16px 20px 20px;color:#b9a4ff;font-size:13px;font-weight:bold">SONORIA FM · sonoriafm.com</td></tr></table>`;
const songRow = (t) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="100%" bgcolor="#1a1040" ` +
  `style="max-width:480px;margin:10px auto;background:#1a1040;border-radius:18px"><tr>` +
  `<td width="96" valign="middle" style="width:96px;padding:12px 0 12px 12px">${cover(t, 96)}</td>` +
  `<td valign="middle" style="padding:12px 14px;text-align:left">` +
  `<div style="color:#ffffff;font-size:17px;font-weight:bold;line-height:1.3">${esc(t.title)}</div>` +
  `<div style="color:#d8d8e8;font-size:14px">${esc(t.artist)}</div>${shareLink(t)}</td></tr></table>`;
const songCards = (songs) => {
  const list = songs.slice(0, 30);
  if (!list.length) return '';
  const one = list.length === 1;
  return `<p style="margin:26px 0 0;text-align:center;font-size:17px;font-weight:bold;color:#8b33ff">${one ? 'Tu tarjeta de canción' : 'Tus tarjetas de canciones'}</p>` +
    `<p style="margin:4px 0 0;text-align:center;font-size:14px;color:#6b7280">${one ? 'Compártela y pide votos.' : 'Compártelas y pide votos.'}</p>` +
    (one ? songCard(list[0]) : list.map(songRow).join(''));
};

function buildHtml(name, cards = '') {
  const hello = name ? `¡Hola, ${esc(name)}!` : '¡Hola!';
  return (
    `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#14141f;line-height:1.6">` +
    `<h2 style="color:#8b33ff">${hello}</h2>` +
    `<p>Gracias de corazón por formar parte de <strong>SONORIA FM</strong>. Que tu música suene en nuestra radio es lo que le da sentido a este proyecto.</p>` +
    `<p>Hoy te escribimos para pedirte una ayuda importante: <strong>comparte la radio con todos los que puedas</strong> (familia, amigos, tus redes, tus grupos…). Cuanta más gente nos conozca, más creceremos, y cuanto más crezcamos, <strong>más variedad de música podremos ofrecer</strong> y más oídos tendrá tu música.</p>` +
    `<p>Y, sobre todo, necesitamos vuestra ayuda con los <strong>votos del TOP 10</strong>. Las canciones con más &ldquo;me gusta&rdquo; forman el Top 10 de la semana, y esas suenan el doble en la franja Top Sonoria. Pide a quien te escuche que vote con un &ldquo;me gusta&rdquo; las canciones que más le gusten, también la tuya. Cada lunes a las 00:00 (hora de Madrid) empieza una semana nueva, así que todos partís de cero.</p>` +
    `<p style="margin-top:24px"><a href="https://sonoriafm.com" style="background:#8b33ff;color:#fff;padding:12px 26px;border-radius:24px;text-decoration:none;font-weight:bold">Escuchar y compartir SONORIA FM</a></p>` +
    `<p>Enlace para compartir: <a href="https://sonoriafm.com" style="color:#8b33ff">sonoriafm.com</a></p>` +
    cards +
    appButton() +
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

    const catalog = await loadCatalog(svc);
    const cardsFor = (email) => songCards(songsFor(email, catalog.subs, catalog.tracks));

    if (body.test_to) {
      await sendGmail(svc, { to: String(body.test_to), subject, html: buildHtml('Artista', cardsFor(body.test_to)) });
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
        await sendGmail(svc, { to: r.email, subject, html: buildHtml(r.name, cardsFor(r.email)) });
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
