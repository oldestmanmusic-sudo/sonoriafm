import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const ADMIN_EMAIL = 'oldestmanmusic@gmail.com';
const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Avisa al administrador de un envío nuevo (datos + consejo de IA).
// Lo llama el flujo automático como administrador; el correo sale desde aquí
// porque la plataforma no permite enviarlo directamente desde el flujo.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const b = await req.json().catch(() => ({}));
    if (!b.song_title && !b.artist_name) return Response.json({ error: 'Faltan datos del envío' }, { status: 400 });

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: ADMIN_EMAIL,
      from_name: 'SONORIA FM',
      subject: `Nueva canción: ${b.song_title || ''} (${b.artist_name || ''})`,
      body:
        `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#14141f">` +
        `<h2 style="color:#8b33ff">Nueva canción en el buzón</h2>` +
        `<p><strong>Canción:</strong> ${esc(b.song_title)}<br>` +
        `<strong>Artista:</strong> ${esc(b.artist_name)}<br>` +
        `<strong>Género:</strong> ${esc(b.genre)}<br>` +
        `<strong>Contacto:</strong> ${esc(b.sender_email)}</p>` +
        `<h3 style="color:#8b33ff">Consejo de IA</h3>` +
        `<p style="white-space:pre-wrap">${esc(b.opinion) || '(sin consejo de IA)'}</p>` +
        `<p><a href="https://sonoriafm.com/admin/envios" style="color:#8b33ff">Revisar y decidir en el panel</a></p></div>`,
    });

    return Response.json({ sent: true });
  } catch (error) {
    console.error('notifyNewSubmission falló:', error?.message);
    return Response.json({ error: error?.message || 'Error' }, { status: 500 });
  }
}
