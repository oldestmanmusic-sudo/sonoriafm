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
const wrap = (inner) =>
  `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#14141f;line-height:1.6">${inner}` +
  appButton() +
  `<p style="font-size:12px;color:#6b7280;margin-top:28px">SONORIA FM · <a href="https://sonoriafm.com" style="color:#8b33ff">sonoriafm.com</a></p></div>`;

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

// Notifica por correo al remitente de un envío una decisión del administrador:
// 'approved' (se emitirá su canción) o 'rejected' (no se podrá emitir, con disculpas).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const submissionId = body.submission_id;
    const decision = body.decision;
    if (!submissionId || (decision !== 'approved' && decision !== 'rejected')) {
      return Response.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }

    let submission = null;
    try {
      submission = await base44.asServiceRole.entities.Submission.get(submissionId);
    } catch {
      submission = null;
    }
    if (!submission) return Response.json({ error: 'Envío no encontrado' }, { status: 404 });
    if (submission.status !== decision) {
      return Response.json({ error: 'El estado del envío no coincide con la decisión' }, { status: 409 });
    }
    if (!submission.email) return Response.json({ ok: true, email_sent: false, reason: 'El envío no tiene email de contacto' });

    // El fallo del correo no debe romper la decisión del administrador:
    // se informa en la respuesta, pero la función responde 200 igualmente.
    try {
      const artist = esc(submission.artist_name || 'artista');
      const song = esc(submission.song_title || 'tu canción');
      const { subs, tracks } = await loadCatalog(base44.asServiceRole);
      if (decision === 'approved') {
        const track = tracks.find((t) => sameSong(submission, t)) ||
          { title: submission.song_title || 'Tu canción', artist: submission.artist_name || '', cover_url: submission.cover_url };
        await sendGmail(base44.asServiceRole, {
          to: submission.email,
          subject: `Enhorabuena, ${submission.artist_name || 'artista'}: emitimos "${submission.song_title || 'tu canción'}" en SONORIA FM`,
          html: wrap(
            `<h2 style="color:#8b33ff">Enhorabuena, ${artist}.</h2>` +
            `<p>Es un verdadero placer escribirle con buenas noticias: tras escuchar atentamente "${song}", nuestro equipo de programación ha decidido <strong>aceptar su canción para su emisión en SONORIA FM</strong>.</p>` +
            `<p>Su canción formará parte de nuestra programación habitual y estará disponible en la ficha de su perfil de artista en nuestra web. Gracias de corazón por permitirnos emitir su música.</p>` +
            `<p><a href="https://sonoriafm.com" style="color:#8b33ff;font-weight:bold">Escuchar SONORIA FM</a></p>` +
            songCards([track])
          ),
        });
      } else {
        const reason = esc(submission.admin_note || 'Tras revisar tu envío, hemos decidido no incluirlo en nuestra programación actual, aunque te animamos a seguir enviándonos nueva música.');
        await sendGmail(base44.asServiceRole, {
          to: submission.email,
          subject: `Sobre tu canción "${submission.song_title || 'tu canción'}" en SONORIA FM`,
          html: wrap(
            `<h2 style="color:#8b33ff">Estimado equipo de ${artist},</h2>` +
            `<p>Ante todo, gracias de todo corazón por compartir con nosotros su canción "${song}". Sabemos el esfuerzo y el cariño que hay detrás de cada obra.</p>` +
            `<p>Tras una escucha atenta y respetuosa, debemos comunicarle con sinceridad que <strong>en esta ocasión no podremos emitir su canción</strong> en nuestra programación, por lo que le pedimos sinceras disculpas. La decisión responde únicamente a las necesidades de nuestra emisora en este momento y no resta mérito a su trabajo.</p>` +
            `<p style="background:#f5f0ff;border-radius:12px;padding:14px 18px"><strong style="color:#8b33ff">Motivo de la decisión:</strong> ${reason}</p>` +
            `<p>Le animamos a seguir creando y a enviarnos nuevas propuestas: estaremos encantados de volver a escucharle.</p>` +
            `<p>Con nuestro más sincero agradecimiento, el equipo de SONORIA FM.</p>` +
            songCards(songsFor(submission.email, subs, tracks).filter((t) => norm(t.title) !== norm(submission.song_title)))
          ),
        });
      }
      return Response.json({ ok: true, email_sent: true });
    } catch (emailError) {
      console.error('SendEmail falló:', emailError.message);
      return Response.json({ ok: true, email_sent: false, reason: emailError.message });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}