import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const SHEET_ID = '1iA-tq4yh2U9IKNNno8Ckt6ryqyt6GgHz_h56cmzmQTM';
const toList = (r) => (Array.isArray(r) ? r : (r?.items ?? []));
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';
const EMAIL_RE = /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/gi;
const AUTO_RE = /(respuesta autom|autorespuesta|fuera de (la )?oficina|out of office|automatic reply|auto-reply|vacaciones)/i;
const NO_RE = /(no (me |nos )?interesa|no (estamos|estoy) interesad|sin inter[eé]s|no gracias|no deseo|no queremos|no necesitamos|\bbaja\b|darme de baja|darnos de baja|elimin|quitar|dejen de|no vuelvan|\bspam\b|unsubscribe|remove me|no (me )?env[ií]en)/i;

const LABEL = {
  pending: '',
  sent: 'Enviado',
  unsubscribed: 'Baja',
  failed: 'Error de envío',
  bounced: 'Correo no válido',
  not_interested: 'No interesado',
  replied: 'Ha respondido',
};

function b64(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
function bodyText(payload) {
  let out = '';
  const walk = (p) => {
    if (!p) return;
    if (p.mimeType && p.mimeType.startsWith('text/plain') && p.body?.data) out += '\n' + b64(p.body.data);
    else if (p.mimeType === 'message/delivery-status' || (p.mimeType && p.mimeType.startsWith('message/'))) {
      if (p.body?.data) out += '\n' + b64(p.body.data);
    }
    (p.parts || []).forEach(walk);
  };
  walk(payload);
  return out;
}
const header = (m, name) => (m.payload?.headers || []).find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';
function topReply(text) {
  const lines = [];
  for (const line of text.split('\n')) {
    if (/^\s*>/.test(line)) continue;
    if (/^(El .+ escribi[oó]|On .+ wrote|-{3,}|_{5,}|De:|From:)/i.test(line.trim())) break;
    lines.push(line);
  }
  return lines.join('\n').slice(0, 1500);
}

// Admin: revisa el Gmail (rebotes y respuestas de los últimos días), actualiza MarketingContact y marca el estado en la hoja de Drive.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const days = Math.max(1, Math.min(Number(body.days) || 3, 30));

    const svc = base44.asServiceRole;
    const db = svc.entities;
    const { accessToken: gTok } = await svc.connectors.getConnection('gmail');
    const gh = { Authorization: `Bearer ${gTok}` };
    const me = String((await (await fetch(`${GMAIL}/profile`, { headers: gh })).json()).emailAddress || '').toLowerCase();

    const contacts = toList(await db.MarketingContact.list('-created_date', 2000));
    const byEmail = new Map(contacts.map((c) => [String(c.email).toLowerCase(), c]));

    const listIds = async (q) => {
      const r = await fetch(`${GMAIL}/messages?maxResults=100&q=${encodeURIComponent(q)}`, { headers: gh });
      if (!r.ok) throw new Error(`Gmail list ${r.status}`);
      return ((await r.json()).messages || []).map((m) => m.id);
    };
    const getMsg = async (id) => {
      const r = await fetch(`${GMAIL}/messages/${id}?format=full`, { headers: gh });
      return r.ok ? r.json() : null;
    };

    const changes = new Map(); // email -> {status, note}
    const rank = { replied: 1, not_interested: 2, unsubscribed: 3, bounced: 4 };
    const mark = (email, status, note) => {
      const c = byEmail.get(email);
      if (!c) return;
      if (['unsubscribed', 'bounced'].includes(c.status)) return; // ya cerrados
      const cur = changes.get(email);
      if (cur && rank[cur.status] >= rank[status]) return;
      changes.set(email, { status, note });
    };

    // 1) Rebotes
    const bounceIds = await listIds(`newer_than:${days}d (from:mailer-daemon OR from:postmaster OR subject:"Delivery Status Notification" OR subject:"Undeliverable" OR subject:"no se ha entregado")`);
    let bounces = 0;
    for (const id of bounceIds) {
      const m = await getMsg(id);
      if (!m) continue;
      const text = bodyText(m.payload) + '\n' + header(m, 'X-Failed-Recipients');
      const found = new Set((text.match(EMAIL_RE) || []).map((e) => e.toLowerCase()));
      for (const e of found) {
        if (e !== me && byEmail.has(e)) {
          mark(e, 'bounced', 'Correo devuelto por el servidor (dirección no válida o buzón lleno)');
          bounces += 1;
        }
      }
    }

    // 2) Respuestas
    const replyIds = await listIds(`newer_than:${days}d in:inbox -from:mailer-daemon -from:postmaster`);
    let replies = 0;
    for (const id of replyIds) {
      const m = await getMsg(id);
      if (!m) continue;
      const from = (header(m, 'From').match(EMAIL_RE) || [''])[0].toLowerCase();
      if (!from || from === me || !byEmail.has(from)) continue;
      const subject = header(m, 'Subject');
      if (AUTO_RE.test(subject) || /auto/i.test(header(m, 'Auto-Submitted')) && !/no$/i.test(header(m, 'Auto-Submitted'))) continue;
      const text = topReply(bodyText(m.payload));
      if (AUTO_RE.test(text)) continue;
      replies += 1;
      const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 160);
      if (/^\s*baja\b/i.test(text.trim()) || /\bbaja\b/i.test(text) && text.trim().length < 40) mark(from, 'unsubscribed', 'Pidió la baja por correo');
      else if (NO_RE.test(text)) mark(from, 'not_interested', `Respuesta: ${snippet}`);
      else mark(from, 'replied', `Respuesta: ${snippet}`);
    }

    // 3) Guardar cambios en la base de datos
    const now = new Date().toISOString();
    for (const [email, ch] of changes) {
      const c = byEmail.get(email);
      if (c.status === ch.status && c.note === ch.note) continue;
      await db.MarketingContact.update(c.id, { status: ch.status, note: ch.note, reviewed_at: now });
      c.status = ch.status;
      c.note = ch.note;
    }

    // 4) Marcar en la hoja de Drive (columnas H "Estado correo", I "Detalle", J "Revisado")
    let sheetRows = 0;
    try {
      const { accessToken: sTok } = await svc.connectors.getConnection('googlesheets');
      const sh = { Authorization: `Bearer ${sTok}`, 'Content-Type': 'application/json' };
      const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/A:G`, { headers: sh });
      if (r.ok) {
        const rows = ((await r.json()).values || []).slice(1);
        const out = rows.map((row) => {
          const c = byEmail.get(String(row[2] || '').trim().toLowerCase());
          if (!c) return ['', '', ''];
          return [LABEL[c.status] ?? '', c.note || '', c.reviewed_at ? String(c.reviewed_at).slice(0, 10) : ''];
        });
        const values = [['Estado correo', 'Detalle', 'Revisado'], ...out];
        const w = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/H1:J${values.length}?valueInputOption=RAW`, {
          method: 'PUT',
          headers: sh,
          body: JSON.stringify({ values }),
        });
        if (w.ok) sheetRows = out.length;
      }
    } catch (_e) { /* la hoja es secundaria */ }

    const count = (s) => contacts.filter((c) => c.status === s).length;
    return Response.json({
      scanned_bounces: bounceIds.length,
      scanned_replies: replyIds.length,
      bounces_matched: bounces,
      replies_matched: replies,
      changed: changes.size,
      sheet_rows: sheetRows,
      totals: { pending: count('pending'), sent: count('sent'), bounced: count('bounced'), not_interested: count('not_interested'), replied: count('replied'), unsubscribed: count('unsubscribed'), failed: count('failed') },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
