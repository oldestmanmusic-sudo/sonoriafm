import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Admin: descarga un audio desde una URL, lo sube al almacenamiento de la app y lo pone
// como audio_url de la canción indicada. { track_id, url, file_name }
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { track_id, url, file_name } = await req.json();
    if (!track_id || !url || !file_name) return Response.json({ error: 'Faltan datos' }, { status: 400 });

    const r = await fetch(url);
    if (!r.ok) return Response.json({ error: `Descarga ${r.status}` }, { status: 502 });
    const blob = await r.blob();
    const file = new File([blob], file_name, { type: 'audio/mpeg' });
    const svc = base44.asServiceRole;
    const { file_url } = await svc.integrations.Core.UploadFile({ file });
    await svc.entities.Track.update(track_id, { audio_url: file_url });
    return Response.json({ ok: true, file_url, bytes: blob.size });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
