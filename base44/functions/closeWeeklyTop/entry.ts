import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Hoja de Drive "Semanas en el TOP".
const SHEET_ID = '1cTARVbWGpATPREcvSSJ-5jANQID20dxW_KgAjUcpvJ8';

const toList = (r) => (Array.isArray(r) ? r : (r?.items ?? []));

// Fecha (AAAA-MM-DD) en hora de Madrid.
function madridDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

// ───────────── Premios del TOP semanal ─────────────
// 1.er puesto: noticia dedicada, diploma y correo. 2.º y 3.º: diploma y correo.
const OWNER_EMAIL = 'oldestmanmusic@gmail.com';
const SITE = 'https://sonoriafm.com';
const MIN_VOTES = 3;
// Las canciones de la casa pueden salir en el TOP, pero no reciben premio.
const HOUSE_ARTISTS = ['oldestman', 'sonoria', 'sonoria fm'];
const HOUSE_EMAILS = ['victormovil77@gmail.com', 'oldestmanmusic@gmail.com'];
// Artistas publicados sin envío desde la web, identificados por su correo de contacto.
const EXTRA_ARTISTS = { 'dreamchip@hotmail.com': 'carbono vr', 'juanmalv97@gmail.com': 'los lohim', 'marketglow7@gmail.com': 'inert.ia' };

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const mailOf = (s) => String(s ?? '').trim().toLowerCase();
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

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
// El cierre se guarda con la fecha del domingo; la semana empieza seis días antes.
function weekLabel(sunday) {
  const end = new Date(`${sunday}T12:00:00Z`);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  const d = (x) => x.getUTCDate();
  const m = (x) => MONTHS[x.getUTCMonth()];
  const y = (x) => x.getUTCFullYear();
  if (m(start) === m(end)) return `del ${d(start)} al ${d(end)} de ${m(end)} de ${y(end)}`;
  const startYear = y(start) !== y(end) ? ` de ${y(start)}` : '';
  return `del ${d(start)} de ${m(start)}${startYear} al ${d(end)} de ${m(end)} de ${y(end)}`;
}
const positionName = (p) => ({ 1: '1.er puesto', 2: '2.º puesto', 3: '3.er puesto' }[p] || '');
const joinList = (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} y ${a[a.length - 1]}`);
const songName = (w) => `«${w.title}», de ${w.artist}`;
const votesText = (n) => `${n} ${n === 1 ? 'voto' : 'votos'}`;

// Datos de contacto y presentación a partir de los envíos aprobados.
function contactFor(track, subs) {
  const mine = subs.filter((s) => norm(s.artist_name) === norm(track.artist));
  const sub =
    mine.find((s) => s.email && norm(s.song_title) === norm(track.title)) ||
    mine.find((s) => s.email && s.cover_url && s.cover_url === track.cover_url);
  if (sub) return { sub, email: mailOf(sub.email) };
  const extra = Object.keys(EXTRA_ARTISTS).find((m) => EXTRA_ARTISTS[m] === norm(track.artist));
  if (extra) return { sub: null, email: extra };
  const emails = [...new Set(mine.map((s) => mailOf(s.email)).filter(Boolean))];
  return { sub: null, email: emails.length === 1 ? emails[0] : '' };
}
const songsFor = (email, subs, tracks) => {
  if (Object.hasOwn(EXTRA_ARTISTS, email)) return tracks.filter((t) => norm(t.artist) === EXTRA_ARTISTS[email]);
  const mine = subs.filter((s) => mailOf(s.email) === email);
  return tracks.filter((t) => mine.some((s) => norm(s.artist_name) === norm(t.artist) &&
    (norm(s.song_title) === norm(t.title) || (!!s.cover_url && s.cover_url === t.cover_url))));
};

// Texto escrito por el artista: sin marcas, enlaces ni correos, y recortado.
function cleanText(value, max = 600) {
  const t = String(value ?? '')
    .replace(/&#x20;|&nbsp;/gi, ' ')
    .replace(/[*`#]+/g, '')
    .replace(/\S+@\S+\.\S+/g, '')
    .replace(/(https?:\/\/|www\.)\S+/gi, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.\n'));
  return stop > max / 2 ? cut.slice(0, stop + 1) : `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}
const quote = (t) =>
  `<blockquote>${t.split(/\n+/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join('')}</blockquote>`;

// Noticia dedicada al número 1 (o a quienes lo comparten).
function buildArticle(firsts, others, week, today) {
  const many = firsts.length > 1;
  // Con la coma que cierra cada «título», de artista, lista para seguir la frase.
  const names = joinList(firsts.map((w) => `${songName(w)},`));
  const votes = firsts[0].likes;
  const title = many
    ? `Empate en lo más alto: ${names} comparten el número 1 de la semana`
    : `${songName(firsts[0])}, número 1 del TOP de la semana`;
  const excerpt = many
    ? `Con ${votes} votos cada una, ${names} comparten el primer puesto del TOP semanal de SONORIA FM.`
    : `Con ${votes} votos de los oyentes, ${names} ha ganado el TOP semanal de SONORIA FM.`;
  let content =
    `<p><strong>¡Enhorabuena!</strong> En la semana ${week}, ${esc(names)} ${many ? 'han sido las canciones más votadas' : 'ha sido la canción más votada'} de SONORIA FM, ` +
    `con <strong>${votes} votos de los oyentes</strong>${many ? ' cada una' : ''}.</p>` +
    `<p>Cada voto es de alguien que ha escuchado y ha querido apoyar. Llegar a lo más alto del TOP es mérito de la música y del cariño de quienes la escuchan.</p>`;
  for (const w of firsts) {
    content += `<h2>${esc(songName(w))}</h2>`;
    const about = cleanText(w.sub?.description);
    const bio = cleanText(w.sub?.artist_bio);
    if (about) content += `<p>Así se presenta la canción:</p>${quote(about)}`;
    if (bio) content += `<p>Sobre ${esc(w.artist)}, en sus propias palabras:</p>${quote(bio)}`;
    if (w.track?.id) content += `<p><a href="/cancion/${encodeURIComponent(w.track.id)}">Escuchar «${esc(w.title)}»</a></p>`;
  }
  if (others.length) {
    content += `<h2>También en el podio</h2><ul>${others
      .map((w) => `<li><strong>${positionName(w.position)}:</strong> ${esc(songName(w))} (${votesText(w.likes)})</li>`)
      .join('')}</ul>`;
  }
  content +=
    `<h2>La semana que viene puede ser la tuya</h2>` +
    `<p>Los votos empiezan de cero cada lunes. <a href="/">Escucha la radio y vota</a> tus canciones favoritas. ` +
    `Y si haces música con ayuda de la inteligencia artificial, <a href="/envia-tu-cancion">envíanos tu canción</a>.</p>`;
  const art = { title, excerpt, content, category: 'Artistas', author: 'Redacción SONORIA FM', published_date: today };
  const pic = firsts.find((w) => w.track?.cover_url)?.track.cover_url;
  if (pic) art.cover_url = pic;
  return art;
}

// Botón de la app: va en todos los correos de la radio.
const APP_URL = `${SITE}/app`;
const appButton = () =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:22px auto 8px">` +
  `<tr><td bgcolor="#8b33ff" style="background:#8b33ff;border-radius:999px;text-align:center">` +
  `<a href="${APP_URL}" style="display:inline-block;padding:14px 30px;color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none">Descargar la app</a>` +
  `</td></tr></table>` +
  `<p style="margin:0 0 22px;text-align:center;font-size:13px;color:#6b7280">La app de SONORIA FM es gratis.</p>`;

const cover = (t, size) => /^https:\/\//.test(t?.cover_url || '')
  ? `<img src="${esc(t.cover_url)}" width="${size}" alt="Carátula de ${esc(t.title)}" style="display:block;width:100%;max-width:${size}px;height:auto;margin:auto;border:0;border-radius:14px">`
  : '';
// Tarjetas de canción: solo en correos a artistas y solo con SUS canciones.
const shareLink = (t) => t.id
  ? `<a href="${SITE}/tarjeta/${encodeURIComponent(t.id)}" style="display:inline-block;margin-top:10px;padding:10px 20px;background:#ff4d8d;border-radius:999px;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none">Compartir mi tarjeta</a>`
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

const ACCENTS = { 1: '#FFC846', 2: '#D5DBEA', 3: '#E39A5F' };
const diplomaBlock = (w, week) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="100%" bgcolor="#1a1040" ` +
  `style="max-width:360px;margin:22px auto;background:#1a1040;border:4px solid ${ACCENTS[w.position]};border-radius:24px;text-align:center">` +
  `<tr><td style="padding:18px 20px 0;color:#ffffff;font-size:28px;font-weight:bold;letter-spacing:3px">DIPLOMA</td></tr>` +
  `<tr><td style="padding:2px 20px 14px;color:${ACCENTS[w.position]};font-size:18px;font-weight:bold">${positionName(w.position).replace('puesto', 'PUESTO')}${w.tie ? ' (EMPATE)' : ''}</td></tr>` +
  `<tr><td style="padding:0 20px">${cover(w.track, 280)}</td></tr>` +
  `<tr><td style="padding:16px 20px 0;color:#ffffff;font-size:22px;font-weight:bold;line-height:1.3">${esc(w.title)}</td></tr>` +
  `<tr><td style="padding:4px 20px 0;color:#d8d8e8;font-size:16px">${esc(w.artist)}</td></tr>` +
  `<tr><td style="padding:12px 20px 0;color:${ACCENTS[w.position]};font-size:18px;font-weight:bold">${w.likes} votos de los oyentes</td></tr>` +
  `<tr><td style="padding:4px 20px 0;color:#d8d8e8;font-size:13px">TOP semanal ${week}</td></tr>` +
  (w.id
    ? `<tr><td style="padding:14px 20px 0"><a href="${SITE}/diploma/${encodeURIComponent(w.id)}" style="display:inline-block;padding:12px 24px;background:#8b33ff;border-radius:999px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none">Descargar mi diploma</a></td></tr>`
    : '') +
  `<tr><td style="padding:16px 20px 20px;color:#b9a4ff;font-size:13px;font-weight:bold">¡Enhorabuena! · sonoriafm.com</td></tr></table>`;

const wrap = (inner, foot) =>
  `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#14141f;line-height:1.7">${inner}${appButton()}` +
  `<p style="font-size:12px;color:#6b7280">${foot}</p></div>`;

function winnerEmail(items, week, articleUrl, songs) {
  const first = items.some((w) => w.position === 1);
  const artists = joinList([...new Set(items.map((w) => w.artist))]);
  return {
    subject: first ? '¡Eres número 1 de la semana en SONORIA FM!' : '¡Enhorabuena! Estás en el podio del TOP de SONORIA FM',
    html: wrap(
      `<h2 style="color:#8b33ff">¡Enhorabuena, ${esc(artists)}!</h2>` +
      `<p>${items.length > 1 ? 'Tus canciones han quedado' : 'Tu canción ha quedado'} en el podio del TOP semanal de SONORIA FM gracias a los votos de los oyentes. ${items.length > 1 ? 'Estos son tus diplomas' : 'Este es tu diploma'}:</p>` +
      items.map((w) => diplomaBlock(w, week)).join('') +
      (first && articleUrl
        ? `<p style="text-align:center">Además, hemos publicado en la web una noticia dedicada a tu canción:<br><a href="${articleUrl}" style="color:#8b33ff;font-weight:bold">Leer la noticia</a></p>`
        : '') +
      `<p>Compártelo en tus redes y cuéntaselo a tu gente. Ya ha empezado una votación nueva: ¡mucha suerte!</p>` +
      songCards(songs),
      'SONORIA FM · Has recibido este correo porque tu música suena en sonoriafm.com. Si tienes dudas, escríbenos desde la sección de contacto.',
    ),
  };
}

// Reparte los premios. Cada paso falla por separado y nunca afecta al cierre del TOP.
async function giveAwards(svc, entries, tracks, weekDate) {
  const db = svc.entities;
  const week = weekLabel(weekDate);
  const problems = [];
  let subs = [];
  try {
    subs = toList(await db.Submission.filter({ status: 'approved' }, '-created_date', 1000));
  } catch (e) {
    problems.push(`No se han podido leer los envíos de artistas: ${e.message}`);
  }

  const rows = entries.map((e) => {
    const track = tracks.find((t) => t.id === e.track_id);
    const w = { id: e.id, position: e.position, likes: e.likes, tie: e.tie, title: e.song_title, artist: e.artist, track };
    Object.assign(w, contactFor(track || { title: e.song_title, artist: e.artist }, subs));
    if (HOUSE_ARTISTS.includes(norm(w.artist)) || HOUSE_EMAILS.includes(w.email)) w.skip = 'sin premio, es de la casa';
    else if (w.likes < MIN_VOTES) w.skip = `sin premio, menos de ${MIN_VOTES} votos`;
    return w;
  });
  const winners = rows.filter((w) => !w.skip);

  let articleUrl = '';
  let articleId = '';
  const firsts = winners.filter((w) => w.position === 1);
  if (firsts.length) {
    try {
      const created = await db.Article.create(
        buildArticle(firsts, winners.filter((w) => w.position > 1), week, madridDate()),
      );
      articleId = created?.id || '';
      if (articleId) articleUrl = `${SITE}/noticias/${articleId}`;
    } catch (e) {
      problems.push(`No se ha podido publicar la noticia: ${e.message}`);
    }
  }

  // Un solo correo por artista, aunque tenga varias canciones premiadas.
  const byEmail = new Map();
  for (const w of winners) {
    if (!w.email) {
      w.status = 'no he encontrado su correo: no se le ha enviado nada';
      continue;
    }
    byEmail.set(w.email, [...(byEmail.get(w.email) || []), w]);
  }
  let sent = 0;
  for (const [email, items] of byEmail) {
    try {
      await sendGmail(svc, { to: email, ...winnerEmail(items, week, articleUrl, songsFor(email, subs, tracks)) });
      sent += 1;
      for (const w of items) w.status = 'correo de enhorabuena enviado';
    } catch (e) {
      console.error('premio:', e?.message);
      for (const w of items) w.status = 'FALLÓ el envío de su correo';
    }
  }

  // Resumen para el propietario.
  try {
    const social =
      `🏆 TOP de la semana en SONORIA FM (${week})\n` +
      winners.map((w) => `${positionName(w.position)}: «${w.title}», de ${w.artist} (${votesText(w.likes)})`).join('\n') +
      `\n¡Enhorabuena! Escucha y vota en sonoriafm.com`;
    const list = rows.length
      ? `<ul>${rows
          .map((w) => `<li><strong>${positionName(w.position)}:</strong> ${esc(songName(w))} (${votesText(w.likes)}): ${esc(w.skip || w.status)}` +
            (!w.skip && w.id ? ` · <a href="${SITE}/diploma/${encodeURIComponent(w.id)}">diploma</a>` : '') + `</li>`)
          .join('')}</ul>`
      : '<p>Esta semana ninguna canción ha tenido votos.</p>';
    await sendGmail(svc, {
      to: OWNER_EMAIL,
      subject: `Premios del TOP semanal ${week}`,
      html: wrap(
        `<h2 style="color:#8b33ff">Premios del TOP semanal ${week}</h2>${list}` +
        (articleUrl
          ? `<p><a href="${articleUrl}">Ver la noticia publicada del número 1</a></p>`
          : '<p>No se ha publicado noticia esta semana.</p>') +
        (winners.length
          ? `<p><strong>Texto para copiar y pegar en redes:</strong></p><div style="white-space:pre-wrap;border-left:3px solid #8b33ff;padding:4px 0 4px 16px">${esc(social)}</div>`
          : '<p>Ninguna canción cumple las condiciones para tener premio.</p>') +
        problems.map((p) => `<p style="color:#b00020">${esc(p)}</p>`).join(''),
        'SONORIA FM · Resumen automático del cierre semanal.',
      ),
    });
  } catch (e) {
    console.error('resumen premios:', e?.message);
    problems.push('No se ha podido enviar el resumen');
  }

  return { winners: winners.length, emails_sent: sent, article_id: articleId, problems: problems.length };
}

// Cierre semanal (domingo a lunes, 00:00 Madrid): 1) guarda el TOP 3 (con empates), 2) pone los "me gusta" a cero, 3) reparte los premios.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const db = base44.asServiceRole.entities;
    // Se ejecuta el lunes a las 00:00 (Madrid): la semana que se cierra es la que termina el domingo anterior.
    const today = madridDate();
    const prev = new Date(`${today}T12:00:00Z`);
    prev.setUTCDate(prev.getUTCDate() - 1);
    const weekDate = prev.toISOString().slice(0, 10);

    // Idempotencia: si ya se cerró esta fecha no se repite (evita reiniciar dos veces).
    const done = toList(await db.TopWeek.filter({ week_date: weekDate }, { limit: 1 }));
    if (done.length > 0) {
      return Response.json({ skipped: true, reason: 'Ya cerrado', week_date: weekDate });
    }

    const tracks = toList(await db.Track.list('-likes', 1000));
    const ranked = tracks
      .map((t) => ({ ...t, likes: Number(t.likes) || 0 }))
      .filter((t) => t.likes > 0)
      .sort((a, b) => b.likes - a.likes);

    // Ranking deportivo: las canciones empatadas comparten puesto y se salta el siguiente
    // (6, 3, 3, 3, 3 => puesto 1, 2, 2, 2, 2). Solo se guardan los puestos 1 a 3.
    const entries = [];
    ranked.forEach((t, i) => {
      const position = ranked.findIndex((x) => x.likes === t.likes) + 1;
      if (position > 3) return;
      const tie = ranked.filter((x) => x.likes === t.likes).length > 1;
      entries.push({
        week_date: weekDate,
        position,
        song_title: t.title,
        artist: t.artist,
        likes: t.likes,
        tie,
        track_id: t.id,
      });
    });

    // 1) Registro en la web (siempre, antes de tocar los likes).
    for (const e of entries) {
      const created = await db.TopWeek.create({ ...e });
      e.id = created?.id;
    }
    // Marca de semana cerrada aunque nadie tuviera likes.
    if (entries.length === 0) {
      await db.TopWeek.create({
        week_date: weekDate,
        position: 0,
        song_title: '(sin me gusta esta semana)',
        artist: '-',
        likes: 0,
        tie: false,
      });
    }

    // 2) Registro en la hoja de Drive (si falla, el registro de la web ya está a salvo).
    let sheet = 'ok';
    try {
      if (entries.length > 0) {
        const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');
        const values = entries.map((e) => [
          e.week_date,
          e.position,
          e.song_title,
          e.artist,
          e.likes,
          e.tie ? 'Empate' : '',
        ]);
        const url =
          `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/A1:append` +
          `?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
        const r = await fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values }),
        });
        if (!r.ok) sheet = `error ${r.status}: ${(await r.text()).slice(0, 300)}`;
      }
    } catch (err) {
      sheet = `error: ${err.message}`;
    }

    // 3) Reinicio: contador a cero y se liberan los "me gusta" para que cada usuario pueda votar de nuevo.
    let reset = 0;
    for (const t of tracks) {
      if ((Number(t.likes) || 0) !== 0) {
        await db.Track.update(t.id, { likes: 0 });
        reset += 1;
      }
    }
    let removed = 0;
    for (;;) {
      const batch = toList(await db.TrackLike.list('-created_date', 500));
      if (batch.length === 0) break;
      for (const l of batch) {
        await db.TrackLike.delete(l.id);
        removed += 1;
      }
    }

    // 4) Premios: al final, para que un fallo aquí no afecte al cierre.
    let awards;
    try {
      awards = await giveAwards(base44.asServiceRole, entries, tracks, weekDate);
    } catch (err) {
      console.error('premios:', err?.message);
      awards = { error: err.message };
    }

    return Response.json({ week_date: weekDate, saved: entries.length, sheet, tracks_reset: reset, likes_removed: removed, awards });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
