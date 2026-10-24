import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Hoja de Drive "Contactos marketing SONORIA FM". La columna H guarda el estado de cada envío.
const SHEET_ID = '1iA-tq4yh2U9IKNNno8Ckt6ryqyt6GgHz_h56cmzmQTM';
const REPLY_TO = 'Oldestmanmusic@gmail.com';
const SUBJECT = 'Propuesta de colaboración con SONORIA FM, la radio online';

const b64 = (s) => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const x of bytes) bin += String.fromCharCode(x);
  return btoa(bin);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const EMAIL_RE = /^[^\s@;,]+@[^\s@;,]+\.[A-Za-z]{2,}$/;
// Direcciones o empresas que no son destinatarios de una propuesta comercial.
const SKIP_EMAIL = /(@|\.)(gva\.es|tip-sa\.com|grupomrw\.com|ontimelogistica\.com)|^(contabilidad|facturacion|proveedores|reclamacion|envios|pedidos|\d+@)/i;
const SKIP_NAME = /mensajer|transporte|paqueter|logistic|express|zynest/i;

function buildHtml() {
  const li = (t, d) => `<li style="margin:0 0 10px"><strong>${t}</strong> ${d}</li>`;
  return (
    `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#14141f;line-height:1.6">` +
    `<p style="font-size:12px;color:#6b7280;margin:0 0 16px">Comunicación comercial de SONORIA FM</p>` +
    `<h2 style="color:#8b33ff;margin:0 0 12px">Hagamos sonar tu marca en SONORIA FM</h2>` +
    `<p>Hola:</p>` +
    `<p>Soy Víctor, de <strong>SONORIA FM</strong> (<a href="https://sonoriafm.com" style="color:#8b33ff">sonoriafm.com</a>), una radio online independiente que emite las 24 horas con tres franjas propias: <em>Club Electrónico</em> (madrugada), <em>Top Sonoria</em> (mañana y mediodía) y <em>Latino Total</em> (tarde y noche), con música de artistas emergentes.</p>` +
    `<p>Estamos abriendo la radio a negocios y personas que quieran acompañarnos. Estas son las formas de colaborar:</p>` +
    `<ul style="padding-left:20px">` +
    li('Cuñas publicitarias.', 'Anuncios de 20 a 30 segundos dentro de la programación; si lo prefieres, te los producimos nosotros.') +
    li('Patrocinio de una franja o de un programa.', 'Tu marca asociada a una de nuestras franjas, con mención en directo.') +
    li('Menciones, reseña o entrevista en la web.', 'Presentamos tu negocio o tu proyecto a nuestra audiencia.') +
    li('Espacio de marca en sonoriafm.com.', 'Presencia de tu logo y enlace en la web de la radio.') +
    li('Servicios premium.', 'Paquetes a medida que combinan cuñas, patrocinio y presencia en la web, con prioridad en la programación.') +
    li('Donaciones.', 'Si prefieres apoyar el proyecto sin más, puedes hacerlo en <a href="https://sonoriafm.com/donar" style="color:#8b33ff">sonoriafm.com/donar</a>.') +
    li('Colaboraciones.', 'Sorteos, eventos, música para tus campañas o cualquier idea que se te ocurra.') +
    `</ul>` +
    `<p>Si te interesa alguna, responde a este correo con lo que te gustaría hacer y te preparo una propuesta a medida, sin compromiso.</p>` +
    `<p>Un saludo,<br><strong>Víctor</strong><br>SONORIA FM · <a href="mailto:${REPLY_TO}" style="color:#8b33ff">${REPLY_TO}</a></p>` +
    `<p style="font-size:12px;color:#6b7280;margin-top:28px;border-top:1px solid #e5e7eb;padding-top:12px">` +
    `Si no quieres recibir más mensajes nuestros, responde a este correo con la palabra BAJA y no volveremos a escribirte.</p>` +
    `</div>`
  );
}

async function gmailSend(accessToken, to, subject, html) {
  const body = b64(html).replace(/(.{76})/g, '$1\r\n');
  const mime = [
    `To: ${to}`,
    `Reply-To: ${REPLY_TO}`,
    `List-Unsubscribe: <mailto:${REPLY_TO}?subject=BAJA>`,
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
  if (!r.ok) throw new Error(`Gmail ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

// Envía una tanda de la campaña. args: { limit?: número (por defecto 20), test_to?: email (envía solo una prueba) }
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { limit, test_to } = await req.json().catch(() => ({}));
    const gmail = await base44.asServiceRole.connectors.getConnection('gmail');

    if (test_to) {
      if (!EMAIL_RE.test(String(test_to))) return Response.json({ error: 'test_to inválido' }, { status: 400 });
      await gmailSend(gmail.accessToken, test_to, `[PRUEBA] ${SUBJECT}`, buildHtml());
      return Response.json({ test_sent: true });
    }

    const max = Math.min(Math.max(Number(limit) || 20, 1), 40);
    const sheets = await base44.asServiceRole.connectors.getConnection('googlesheets');
    const auth = { Authorization: `Bearer ${sheets.accessToken}` };
    const g = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/A1:H1000`, { headers: auth });
    if (!g.ok) throw new Error(`Sheets ${g.status}: ${(await g.text()).slice(0, 200)}`);
    const rows = (await g.json()).values || [];

    const todo = [];
    let remaining = 0;
    for (let i = 1; i < rows.length; i++) {
      const [name = '', , email = '', , province = '', , active = '', status = ''] = rows[i];
      const mail = String(email).trim();
      if (String(status).trim()) continue; // ya enviado, error o baja
      if (active.trim() !== 'Sí' || !EMAIL_RE.test(mail)) continue;
      if (/NETHERLANDS/i.test(province) || SKIP_EMAIL.test(mail) || SKIP_NAME.test(name)) continue;
      remaining += 1;
      if (todo.length < max) todo.push({ row: i + 1, mail });
    }

    const html = buildHtml();
    const today = new Date().toISOString().slice(0, 10);
    const updates = [];
    let sent = 0;
    let failed = 0;
    for (const t of todo) {
      try {
        await gmailSend(gmail.accessToken, t.mail, SUBJECT, html);
        updates.push({ range: `H${t.row}`, values: [[`Enviado ${today}`]] });
        sent += 1;
      } catch (e) {
        updates.push({ range: `H${t.row}`, values: [[`Error: ${String(e.message).slice(0, 80)}`]] });
        failed += 1;
      }
      await sleep(1500);
    }
    if (rows.length > 0 && !rows[0][7]) updates.push({ range: 'H1', values: [['Estado envío']] });
    if (updates.length > 0) {
      const w = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values:batchUpdate`, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ valueInputOption: 'RAW', data: updates }),
      });
      if (!w.ok) console.error('No se pudo anotar el estado en la hoja:', (await w.text()).slice(0, 200));
    }

    return Response.json({ sent, failed, pending_after: remaining - todo.length });
  } catch (error) {
    return Response.json({ error: error?.message || 'Error' }, { status: 500 });
  }
}
