import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// DE UN SOLO USO. Envía los tres correos a medios aprobados por Víctor el 28/11/2026.
// Destinatarios y textos fijos; cada medio solo recibe el suyo una vez (según su ficha en Prospect)
// y la función deja de hacer nada a partir del 29/11/2026.
const EXPIRES = Date.parse('2026-11-29T00:00:00Z');
const ADMIN_EMAIL = 'oldestmanmusic@gmail.com';
const SITE = 'https://sonoriafm.com';
const NEWS = `${SITE}/noticias/6b0ac9ed9c1628291eac7533`;
const TIDAL = 'https://tidal.com/magazine/article/ai-music-is-banned/1-99745';
const a = (url, text) => `<a href="${url}" style="color:#8b33ff">${text}</a>`;
const radio = () => a(SITE, 'SONORIA FM');
const context = () => `<p>Más contexto: ${a(NEWS, 'nuestra noticia sobre el cambio')}<br>Anuncio de Tidal: ${a(TIDAL, 'tidal.com')}</p>`;
const sign = (bye) =>
  `<p>${bye}<br>Víctor Amorós<br>SONORIA FM · ${a(SITE, 'sonoriafm.com')}<br>${a('mailto:sonoriafm@gmail.com', 'sonoriafm@gmail.com')} · WhatsApp 629 175 497</p>`;
// Botón de la app: va en todos los correos de la radio.
const appButton = () =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:22px auto 8px">` +
  `<tr><td bgcolor="#8b33ff" style="background:#8b33ff;border-radius:999px;text-align:center">` +
  `<a href="${SITE}/app" style="display:inline-block;padding:14px 30px;color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none">Descargar la app</a>` +
  `</td></tr></table>` +
  `<p style="margin:0 0 22px;text-align:center;font-size:13px;color:#6b7280">La app de SONORIA FM es gratis.</p>`;
const wrap = (inner) => `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#14141f">${inner}${appButton()}</div>`;

const MAILS = [
  {
    to: 'redaccion@informacion.es',
    subject: 'Desde Alicante: una radio para la música hecha con IA, justo cuando Tidal anuncia que veta parte de ella',
    html: () => wrap(
      `<p>Hola:</p><p>Soy Víctor Amorós y desde Alicante llevo ${radio()}, una radio online dedicada a la música hecha con inteligencia artificial.</p>` +
      `<p>Os escribo porque el tema está de actualidad: Tidal ha anunciado que, a partir del 9 de diciembre, rechazará y retirará las canciones generadas íntegramente con IA (las creadas con ayuda de la IA, pero que no sean solo producto de ella, seguirán permitidas). Según la propia plataforma, en los últimos 90 días el 43 % de las pistas que le llegaron eran generadas por completo con IA.</p>` +
      `<p>SONORIA FM apuesta por dar un espacio a quienes crean con estas herramientas, bajo su propia dirección creativa y con su nombre artístico:</p>` +
      `<ul><li>Emite las 24 horas, gratis, en la web y en una app para Android compatible con Android Auto.</li><li>Su catálogo reúne ya 48 canciones de 18 artistas.</li><li>Los oyentes votan sus favoritas en un TOP 10 semanal, y las más votadas suenan más.</li><li>Cualquier artista puede enviar sus canciones gratis.</li><li>Los programas se adaptan a la hora local de los oyentes en España y América.</li></ul>` +
      `<p>Si os interesa, estoy disponible para una entrevista o para ampliar la información.</p>` + context() + sign('Gracias y un saludo,')),
  },
  {
    to: 'redaccion@aquimediosdecomunicacion.com',
    subject: 'Historia alicantina: una radio online para la música creada con inteligencia artificial',
    html: () => wrap(
      `<p>Hola:</p><p>Soy Víctor Amorós, de Alicante, y llevo ${radio()}, una radio online para la música hecha con inteligencia artificial.</p>` +
      `<p>Es un buen momento para contarlo: Tidal ha anunciado que desde el 9 de diciembre rechazará las canciones generadas íntegramente con IA (las hechas con ayuda de la IA seguirán permitidas). Mientras tanto, desde Alicante damos antena a quienes crean con estas herramientas bajo su propia dirección creativa.</p>` +
      `<p>La radio emite las 24 horas y es gratis, en la web y en una app para Android compatible con Android Auto. Su catálogo reúne ya 48 canciones de 18 artistas, los oyentes votan sus favoritas en un TOP 10 semanal y cualquier creador puede enviar sus temas sin coste.</p>` +
      `<p>Si os encaja, estoy disponible para una entrevista.</p>` + context() + sign('Un saludo y gracias,')),
  },
  {
    to: 'redaccion@laganzua.net',
    subject: 'SONORIA FM: una radio independiente para la música hecha con IA',
    html: () => wrap(
      `<p>Hola:</p><p>Soy Víctor Amorós y llevo desde Alicante ${radio()}, una radio online independiente dedicada a la música hecha con inteligencia artificial.</p>` +
      `<p>El debate está abierto: Tidal ha anunciado que, a partir del 9 de diciembre, rechazará las canciones generadas íntegramente con IA (las creadas con ayuda de la IA seguirán permitidas). Nosotros damos un espacio propio a quienes componen y producen con estas herramientas bajo su dirección creativa.</p>` +
      `<p>En la radio: emisión 24 horas y gratuita, un catálogo de 48 canciones de 18 artistas, TOP 10 semanal votado por los oyentes, envío de canciones sin coste y app para Android compatible con Android Auto.</p>` +
      `<p>Si os interesa tratar el tema, puedo ampliar la información o contestar a vuestras preguntas.</p>` + context() + sign('Un saludo,')),
  },
];

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

export default async function(req) {
  try {
    if (Date.now() >= EXPIRES) return Response.json({ sent: 0, reason: 'caducada' });
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Prueba: manda el primer correo solo al administrador, sin tocar las fichas.
    if (body?.test) {
      await sendGmail(base44, { to: ADMIN_EMAIL, subject: `[PRUEBA] ${MAILS[0].subject}`, html: MAILS[0].html() });
      return Response.json({ test: true });
    }

    const db = base44.asServiceRole.entities;
    const results = [];
    for (const m of MAILS) {
      const p = toList(await db.Prospect.filter({ email: m.to, kind: 'medio' }, '-created_date', 5))
        .find((x) => x.stage === 'borrador_listo');
      if (!p) {
        results.push({ to: m.to, status: 'omitido' });
        continue;
      }
      // Se marca antes de enviar para que no pueda repetirse.
      await db.Prospect.update(p.id, { stage: 'contactado', next_step: 'Esperar respuesta (enviado el 28-11-2026)', next_step_date: '2026-12-05' });
      try {
        await sendGmail(base44, { to: m.to, subject: m.subject, html: m.html() });
        results.push({ to: m.to, status: 'enviado' });
      } catch (e) {
        await db.Prospect.update(p.id, { stage: 'borrador_listo', next_step: 'Falló el envío: revisar' });
        console.error('sendPressOnce:', m.to, e?.message);
        results.push({ to: m.to, status: 'error' });
      }
    }
    return Response.json({ results });
  } catch (error) {
    console.error('sendPressOnce falló:', error?.message);
    return Response.json({ error: error?.message || 'Error' }, { status: 500 });
  }
}
