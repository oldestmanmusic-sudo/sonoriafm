import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const ADMIN_EMAIL = 'oldestmanmusic@gmail.com';
const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

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

const toList = (r) => (Array.isArray(r) ? r : (r?.items ?? []));
const ms = (s) => {
  const t = String(s || '');
  if (!t) return 0;
  const v = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(t) ? t : `${t}Z`);
  return Number.isFinite(v) ? v : 0;
};
const DAY = 86400000;

// Informe semanal de crecimiento: solo se envía el lunes por la mañana (hora de Madrid),
// salvo que lo pida el administrador con { force: true }.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    let allowed = false;
    if (body && body.force) {
      const user = await base44.auth.me().catch(() => null);
      allowed = !!user && user.role === 'admin';
      if (!allowed) return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!allowed) {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Madrid', weekday: 'short', hour: '2-digit', hourCycle: 'h23',
      }).formatToParts(new Date());
      const wd = parts.find((p) => p.type === 'weekday')?.value;
      const hh = +parts.find((p) => p.type === 'hour')?.value;
      if (!(wd === 'Mon' && hh >= 8 && hh <= 10)) {
        return Response.json({ sent: false, reason: 'fuera de horario' });
      }
    }

    const db = base44.asServiceRole.entities;
    const now = Date.now();
    const w1 = now - 7 * DAY;
    const w0 = now - 14 * DAY;

    const [users, subs, artists, tracks, likes, prospects] = await Promise.all([
      db.User.filter({}, { limit: 500 }).then(toList).catch(() => []),
      db.Submission.filter({}, { limit: 500 }).then(toList).catch(() => []),
      db.Artist.filter({}, { limit: 500 }).then(toList).catch(() => []),
      db.Track.filter({}, { limit: 500 }).then(toList).catch(() => []),
      db.TrackLike.filter({}, { limit: 500, sort: '-created_date' }).then(toList).catch(() => []),
      db.Prospect.filter({}, { limit: 500 }).then(toList).catch(() => []),
    ]);

    const count = (list, a, b) => list.filter((x) => { const t = ms(x.created_date); return t >= a && t < b; }).length;
    const row = (label, list) => {
      const cur = count(list, w1, now + 1);
      const prev = count(list, w0, w1);
      const diff = cur - prev;
      const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '=';
      return `<tr><td style="padding:6px 10px">${esc(label)}</td><td style="padding:6px 10px;text-align:right"><strong>${cur}</strong></td>` +
        `<td style="padding:6px 10px;text-align:right;color:#666">${prev}</td><td style="padding:6px 10px;color:#8b33ff">${arrow} ${diff > 0 ? '+' : ''}${diff}</td></tr>`;
    };

    const stages = {};
    for (const p of prospects) stages[p.stage || 'nuevo'] = (stages[p.stage || 'nuevo'] || 0) + 1;
    const stageHtml = Object.entries(stages).map(([k, v]) => `${esc(k)}: <strong>${v}</strong>`).join(' · ') || 'sin datos';
    const pendingSubs = subs.filter((s) => s.status === 'pending').length;
    const lastExternal = subs
      .filter((s) => s.email && String(s.email).toLowerCase() !== ADMIN_EMAIL)
      .sort((a, b) => ms(b.created_date) - ms(a.created_date))[0];
    const daysSince = lastExternal ? Math.floor((now - ms(lastExternal.created_date)) / DAY) : null;

    const html =
      `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#14141f">` +
      `<h2 style="color:#8b33ff">Informe semanal de SONORIA FM</h2>` +
      `<p>Últimos 7 días frente a los 7 anteriores.</p>` +
      `<table style="border-collapse:collapse;width:100%"><tr style="background:#f3eaff"><th style="padding:6px 10px;text-align:left"></th><th style="padding:6px 10px">Esta semana</th><th style="padding:6px 10px">Anterior</th><th style="padding:6px 10px">Cambio</th></tr>` +
      row('Usuarios nuevos', users) +
      row('Canciones enviadas', subs) +
      row('Artistas nuevos', artists) +
      row('Canciones en la radio', tracks) +
      row('Votos (likes)', likes) +
      `</table>` +
      `<p><strong>Totales:</strong> ${artists.length} artistas · ${tracks.length} canciones · ${users.length} usuarios registrados.</p>` +
      `<p><strong>Envíos pendientes de revisar:</strong> ${pendingSubs}</p>` +
      `<p><strong>Último envío de un artista:</strong> ${lastExternal ? `hace ${daysSince} día(s) (${esc(lastExternal.artist_name || '')})` : 'ninguno'}</p>` +
      `<p><strong>Embudo de marketing (${prospects.length} oportunidades):</strong><br>${stageHtml}</p>` +
      `<p style="color:#666;font-size:13px">Si pasan más de 7 días sin envíos nuevos, conviene revisar la captación y que la web esté publicada.</p>` +
      `</div>`;

    await sendGmail(base44, { to: ADMIN_EMAIL, subject: 'Informe semanal de SONORIA FM', html });
    return Response.json({ sent: true });
  } catch (error) {
    console.error('weeklyGrowthReport falló:', error?.message);
    return Response.json({ error: error?.message || 'Error' }, { status: 500 });
  }
}
