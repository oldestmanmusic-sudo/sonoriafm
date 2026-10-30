import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Admin: copia al almacenamiento de ESTA app los audios, portadas y fotos que siguen
// alojados en otra app de Base44 y actualiza las canciones y artistas.
// { limit?: número máximo de archivos a copiar por ejecución (por defecto 4) }
const OLD_APP = '6aa30fea01c6e8c55c5c3db4';

const TYPES: Record<string, string> = {
  mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
};

const isOld = (u: unknown) => typeof u === 'string' && u.includes(OLD_APP);

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    let limit = 4;
    try { const b = await req.json(); if (b?.limit) limit = Number(b.limit); } catch { /* sin cuerpo */ }

    const svc = base44.asServiceRole;
    const tracks = await svc.entities.Track.list('-created_date', 500);
    const artists = await svc.entities.Artist.list('-created_date', 500);

    // Tareas: cada una es (entidad, id, campo, url antigua).
    const jobs: { entity: 'Track' | 'Artist'; id: string; field: string; url: string }[] = [];
    for (const t of tracks) {
      if (isOld(t.audio_url)) jobs.push({ entity: 'Track', id: t.id, field: 'audio_url', url: t.audio_url });
      if (isOld(t.cover_url)) jobs.push({ entity: 'Track', id: t.id, field: 'cover_url', url: t.cover_url });
    }
    for (const a of artists) {
      if (isOld(a.image_url)) jobs.push({ entity: 'Artist', id: a.id, field: 'image_url', url: a.image_url });
    }

    // Una sola copia por archivo de origen (varias canciones comparten portada).
    const copied = new Map<string, string>();
    const failures: string[] = [];
    let uploads = 0;
    let updated = 0;

    for (const j of jobs) {
      let newUrl = copied.get(j.url);
      if (!newUrl) {
        if (uploads >= limit) continue;
        try {
          const r = await fetch(j.url);
          if (!r.ok) { failures.push(`${j.entity} ${j.id} ${j.field}: descarga ${r.status}`); continue; }
          const blob = await r.blob();
          const name = decodeURIComponent(new URL(j.url).pathname.split('/').pop() || 'archivo');
          const ext = (name.split('.').pop() || '').toLowerCase();
          const type = TYPES[ext] || r.headers.get('content-type') || 'application/octet-stream';
          const file = new File([blob], name, { type });
          const res = await svc.integrations.Core.UploadFile({ file });
          newUrl = res.file_url;
          copied.set(j.url, newUrl);
          uploads++;
        } catch (e) {
          failures.push(`${j.entity} ${j.id} ${j.field}: ${e.message}`);
          console.log('FALLO ' + j.url + ' -> ' + e.message);
          continue;
        }
      }
      await svc.entities[j.entity].update(j.id, { [j.field]: newUrl });
      updated++;
    }

    const remaining = jobs.length - updated;
    console.log('RESULT ' + JSON.stringify({ uploads, updated, remaining, failures }));
    return Response.json({ ok: true, uploads, updated, remaining, failures });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
