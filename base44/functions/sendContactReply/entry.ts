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
    const { subs, tracks } = await loadCatalog(base44.asServiceRole);
    await sendGmail(base44.asServiceRole, {
      to: msg.email,
      subject: 'Respuesta a tu mensaje en SONORIA FM',
      html:
        `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#14141f;line-height:1.7">` +
        `<h2 style="color:#8b33ff">Hola${firstName ? ', ' + esc(firstName) : ''}.</h2>` +
        `<p>Gracias por escribirnos. Esta es nuestra respuesta:</p>` +
        `<div style="border-left:3px solid #8b33ff;padding:4px 0 4px 16px;white-space:pre-wrap">${esc(String(reply).trim())}</div>` +
        songCards(songsFor(msg.email, subs, tracks)) +
        appButton() +
        `<p style="color:#6b7280;font-size:14px">¿Tienes más dudas? Escríbenos de nuevo desde la sección de contacto o sigue escuchando en <a href="https://sonoriafm.com" style="color:#8b33ff">sonoriafm.com</a>.</p>` +
        `<p style="font-size:12px;color:#6b7280">SONORIA FM · Has recibido este correo por un mensaje enviado en sonoriafm.com.</p></div>`,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}