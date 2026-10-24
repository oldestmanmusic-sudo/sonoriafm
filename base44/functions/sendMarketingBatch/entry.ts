import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const SITE = 'https://sonoriafm.com';
const FROM_EMAIL = 'Oldestmanmusic@gmail.com';
const DAILY_CAP = 120; // límite de envíos por día natural (Madrid) para cuidar la cuenta de Gmail
const TIME_BUDGET_MS = 40000;
const toList = (r) => (Array.isArray(r) ? r : (r?.items ?? []));
const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const b64 = (s) => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const x of bytes) bin += String.fromCharCode(x);
  return btoa(bin);
};
const madridDay = (d = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(d);

async function sendGmail(svc, { to, subject, html, unsubscribeUrl }) {
  const { accessToken } = await svc.connectors.getConnection('gmail');
  const body = b64(html).replace(/(.{76})/g, '$1\r\n');
  const headers = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${b64(subject)}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
  ];
  if (unsubscribeUrl) headers.push(`List-Unsubscribe: <${unsubscribeUrl}>, <mailto:${FROM_EMAIL}?subject=Baja>`);
  const mime = [...headers, '', body].join('\r\n');
  const raw = b64(mime).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  });
  if (!r.ok) throw new Error(`Gmail ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

const li = (title, text) => `<li style="margin:0 0 10px"><strong>${title}</strong> ${text}</li>`;

function buildEmail(contact) {
  const name = String(contact.contact_name || '').trim();
  const first = name && name === name.toUpperCase() ? name.charAt(0) + name.slice(1).toLowerCase() : name;
  const greeting = first ? `Hola, ${esc(first.split(/[ ,]/)[0])}:` : `Hola, equipo de ${esc(contact.company || 'su empresa')}:`;
  const unsub = `${SITE}/baja?t=${contact.token}`;
  const html =
    `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#14141f;line-height:1.6">` +
    `<h2 style="color:#8b33ff;margin-bottom:4px">Colaboremos con SONORIA FM</h2>` +
    `<p>${greeting}</p>` +
    `<p>Soy Víctor Amorós, de <a href="${SITE}" style="color:#8b33ff">SONORIA FM</a>, una radio online independiente que emite las 24 horas con música hecha con IA y artistas de todo el mundo. ` +
    `Nuestra programación tiene tres franjas (Club Electrónico, Top Sonoria y Latino Total) y buscamos negocios y marcas que quieran sumarse al proyecto. Estas son las formas de colaborar:</p>` +
    `<ul style="padding-left:20px">` +
    li('Cuñas publicitarias:', 'mensajes de su marca dentro de la emisión, en la franja que mejor encaje con su público.') +
    li('Patrocinio de franjas o programas:', 'su nombre asociado a Club Electrónico, Top Sonoria o Latino Total.') +
    li('Presencia en la web:', 'menciones y espacio para su marca en sonoriafm.com.') +
    li('Colaboraciones y canjes:', 'sorteos, eventos, acciones conjuntas o música para su local o negocio.') +
    li('Donaciones:', `si prefiere apoyar el proyecto sin más, puede hacerlo en <a href="${SITE}/donar" style="color:#8b33ff">sonoriafm.com/donar</a>.`) +
    li('Servicios premium para artistas', '(si trabaja con músicos): artista destacado de la semana, 15 €; reseña o entrevista en la web, 20 €; más rotación de su tema, 10 €/mes.') +
    `</ul>` +
    `<p>Las condiciones de cuñas y patrocinios se ajustan a cada caso. Si le interesa algo, responda a este correo y le preparo una propuesta sin compromiso.</p>` +
    `<p>Un saludo,<br><strong>Víctor Amorós</strong><br>SONORIA FM · <a href="${SITE}" style="color:#8b33ff">sonoriafm.com</a><br>` +
    `<a href="mailto:${FROM_EMAIL}" style="color:#8b33ff">${FROM_EMAIL}</a></p>` +
    `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px">` +
    `<p style="font-size:12px;color:#6b7280">Responsable: Víctor Amorós (SONORIA FM), ${FROM_EMAIL}. Si no desea recibir más mensajes nuestros, puede <a href="${unsub}" style="color:#6b7280">darse de baja aquí</a> o responder a este correo con la palabra BAJA.</p></div>`;
  return { subject: 'Colaboremos: cuñas, patrocinios y más en SONORIA FM', html, unsubscribeUrl: unsub };
}

// Admin: envía el siguiente lote de correos de marketing a contactos pendientes.
// { test_to: "correo" } envía solo una muestra a esa dirección. { limit: n } máximo de envíos por ejecución.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole;
    const db = svc.entities;

    if (body.test_to) {
      const sample = { company: 'Empresa de prueba', contact_name: 'Prueba', token: 'prueba0000000000000000' };
      await sendGmail(svc, { to: String(body.test_to), ...buildEmail(sample) });
      return Response.json({ test_sent: true });
    }

    const limit = Math.max(1, Math.min(Number(body.limit) || 10, 60));
    const today = madridDay();
    const sent = toList(await db.MarketingContact.filter({ status: 'sent' }, { limit: 2000 }));
    const sentToday = sent.filter((c) => c.sent_at && madridDay(new Date(c.sent_at)) === today).length;
    const room = Math.max(0, DAILY_CAP - sentToday);
    const take = Math.min(limit, room);
    if (take === 0) return Response.json({ sent: 0, reason: 'Límite diario alcanzado', sent_today: sentToday });

    const pending = toList(await db.MarketingContact.filter({ status: 'pending' }, { limit: take }));
    const started = Date.now();
    let ok = 0;
    let failed = 0;
    for (const c of pending) {
      if (Date.now() - started > TIME_BUDGET_MS) break;
      try {
        await sendGmail(svc, { to: c.email, ...buildEmail(c) });
        await db.MarketingContact.update(c.id, { status: 'sent', sent_at: new Date().toISOString() });
        ok += 1;
      } catch (e) {
        await db.MarketingContact.update(c.id, { status: 'failed', error: String(e.message).slice(0, 300) });
        failed += 1;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    const left = toList(await db.MarketingContact.filter({ status: 'pending' }, { limit: 2000 })).length;
    return Response.json({ sent: ok, failed, pending_left: left, sent_today: sentToday + ok });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
