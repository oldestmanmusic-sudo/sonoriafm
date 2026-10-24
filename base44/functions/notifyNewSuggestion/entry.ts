import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const ADMIN_EMAIL = 'oldestmanmusic@gmail.com';

// Avisa al administrador por email cuando llega una sugerencia nueva.
// Lo llama el flujo automático (como administrador); el envío va por la
// integración Core con rol de servicio.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const suggestionId = body.suggestion_id;
    if (!suggestionId) return Response.json({ error: 'Falta suggestion_id' }, { status: 400 });

    let suggestion = null;
    try {
      suggestion = await base44.asServiceRole.entities.Suggestion.get(suggestionId);
    } catch (e) {
      console.error('Suggestion.get falló:', e?.message);
    }
    if (!suggestion) return Response.json({ error: 'Sugerencia no encontrada' }, { status: 404 });

    const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: ADMIN_EMAIL,
      from_name: 'SONORIA FM',
      subject: `Nueva sugerencia en SONORIA FM (${suggestion.category || 'Mejora'})`,
      body:
        `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">` +
        `<h2 style="color:#8b33ff">Nueva sugerencia</h2>` +
        `<p><strong>Tipo:</strong> ${esc(suggestion.category || 'Mejora')}</p>` +
        `<p style="white-space:pre-wrap">${esc(suggestion.message)}</p>` +
        `<p><a href="https://sonoriafm.com/sugerencias" style="color:#8b33ff">Revisar en el panel</a></p></div>`,
    });

    return Response.json({ sent: true });
  } catch (error) {
    console.error('notifyNewSuggestion falló:', error?.message);
    return Response.json({ error: error?.message || 'Error' }, { status: 500 });
  }
}
