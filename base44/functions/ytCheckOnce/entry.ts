import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// DE UN SOLO USO. Solo consulta el canal conectado (no publica nada). Caduca el 29/11/2026.
const EXPIRES = Date.parse('2026-11-29T00:00:00Z');

export default async function(req) {
  try {
    if (Date.now() >= EXPIRES) return Response.json({ reason: 'caducada' });
    const base44 = createClientFromRequest(req);
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('youtube');
    const r = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,status&mine=true', { headers: { Authorization: `Bearer ${accessToken}` } });
    const j = await r.json();
    if (!r.ok) throw new Error(`${r.status} ${j?.error?.message || ''}`.slice(0, 200));
    console.log('YT_ME ' + JSON.stringify((j.items || []).map((c) => ({ id: c.id, title: c.snippet?.title, handle: c.snippet?.customUrl, videos: c.statistics?.videoCount, subs: c.statistics?.subscriberCount, linked: c.status?.isLinked }))));
    return Response.json({ ok: true });
  } catch (error) {
    console.error('ytCheckOnce falló:', error?.message);
    return Response.json({ error: error?.message || 'Error' }, { status: 500 });
  }
}
