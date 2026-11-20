import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const toList = (r) => (Array.isArray(r) ? r : (r?.items ?? []));

function sanitize(s) {
  return String(s || '')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'cancion';
}

export default async function (req) {
  let phase = 'init';
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const db = base44.asServiceRole.entities;

    phase = 'fetch-tracks';
    const all = [];
    let cursor;
    let guard = 0;
    for (;;) {
      const page = await db.Track.filter({}, { sort: '-created_date', limit: 100, cursor });
      const items = toList(page);
      all.push(...items);
      if (!page?.has_more || !page?.next_cursor) break;
      cursor = page.next_cursor;
      if (++guard > 40) break;
    }
    const songs = all.filter((t) => t && t.audio_url && t.genre !== 'Cuña');
    if (!songs.length) {
      return Response.json({ error: 'No hay canciones con audio para descargar.' }, { status: 404 });
    }

    phase = 'fetch-audio';
    const files = {};
    const fetchOne = async (t) => {
      try {
        const res = await fetch(t.audio_url, { signal: AbortSignal.timeout(45000) });
        if (!res.ok) return;
        const buf = new Uint8Array(await res.arrayBuffer());
        if (!buf.length) return;
        let ext = (t.audio_url.split('?')[0].split('.').pop() || 'mp3').toLowerCase();
        if (!/^[a-z0-9]{2,4}$/.test(ext)) ext = 'mp3';
        const base = `${sanitize(t.artist)} - ${sanitize(t.title)}`;
        let name = `${base}.${ext}`;
        let n = 2;
        while (files[name]) {
          name = `${base} (${n}).${ext}`;
          n++;
        }
        files[name] = buf;
      } catch {
        /* se omite el archivo que no se pudo descargar */
      }
    };
    for (let i = 0; i < songs.length; i += 6) {
      await Promise.allSettled(songs.slice(i, i + 6).map(fetchOne));
    }

    const count = Object.keys(files).length;
    if (!count) {
      return Response.json({ error: 'No se pudo descargar ningún archivo de audio.', phase }, { status: 500 });
    }

    phase = 'zip';
    const fflate = await import('npm:fflate@0.8.2');
    const zip = fflate.zipSync(files);

    phase = 'upload';
    const zipFile = new File([zip], 'sonoria-canciones.zip', { type: 'application/zip' });
    const { file_uri } = await base44.asServiceRole.integrations.Core.UploadPrivateFile({ file: zipFile });

    phase = 'sign';
    const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
      file_uri,
      expires_in: 600,
    });

    return Response.json({
      url: signed_url,
      filename: 'sonoria-canciones.zip',
      count,
      sizeBytes: zip.byteLength,
    });
  } catch (error) {
    console.error('descargarCancionesZip error en fase', phase, error);
    return Response.json({ error: error?.message || String(error), phase }, { status: 500 });
  }
}