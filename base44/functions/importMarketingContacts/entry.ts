import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const SHEET_ID = '1iA-tq4yh2U9IKNNno8Ckt6ryqyt6GgHz_h56cmzmQTM';
const toList = (r) => (Array.isArray(r) ? r : (r?.items ?? []));
// Se excluyen administraciones públicas y empresas del sector del transporte/mensajería.
const EXCLUDE = /(@gva\.es$|grupomrw|tip-sa\.com|ontimelogistica|papitransitos|zynest|rosbel|mensajer|angarble\.mrw|grupokiventa)/i;

// Importa a MarketingContact los contactos de la hoja de Drive (solo clientes activos, sin duplicados).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');
    const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/A:G`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!r.ok) return Response.json({ error: `Sheets ${r.status}` }, { status: 502 });
    const rows = ((await r.json()).values || []).slice(1);

    const db = base44.asServiceRole.entities;
    const existing = new Set(toList(await db.MarketingContact.list('-created_date', 2000)).map((c) => String(c.email).toLowerCase()));
    let added = 0;
    let skipped = 0;
    for (const row of rows) {
      const [company = '', contact = '', email = '', locality = '', province = '', phone = '', active = ''] = row;
      const e = String(email).trim().toLowerCase();
      if (!e || active.trim() !== 'Sí' || EXCLUDE.test(e) || EXCLUDE.test(company) || existing.has(e)) {
        skipped += 1;
        continue;
      }
      existing.add(e);
      await db.MarketingContact.create({
        company: company.trim(),
        contact_name: /^\d+$/.test(contact.trim()) ? '' : contact.trim(),
        email: e,
        locality: locality.trim(),
        province: province.trim(),
        phone: phone.trim(),
        token: crypto.randomUUID().replace(/-/g, ''),
        status: 'pending',
      });
      added += 1;
    }
    return Response.json({ added, skipped });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
