import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// DE UN SOLO USO. Fase 1: solo consulta (no publica nada). Caduca el 29/11/2026.
const EXPIRES = Date.parse('2026-11-29T00:00:00Z');
const HANDLES = ['djbandapr', 'lenao.oficial', 'Sarx-p4i', 'Elnochistlense', 'chris.vegha.colombia', 'elpifas2223', 'Nova_music_oficial'];

export default async function(req) {
  try {
    if (Date.now() >= EXPIRES) return Response.json({ reason: 'caducada' });
    const base44 = createClientFromRequest(req);
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('youtube');
    const yt = async (path) => {
      const r = await fetch(`https://www.googleapis.com/youtube/v3/${path}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      const j = await r.json();
      if (!r.ok) throw new Error(`${r.status} ${j?.error?.message || ''}`.slice(0, 200));
      return j;
    };
    const me = await yt('channels?part=snippet&mine=true');
    console.log('YT_ME ' + JSON.stringify((me.items || []).map((c) => ({ id: c.id, title: c.snippet?.title, handle: c.snippet?.customUrl }))));
    for (const h of HANDLES) {
      try {
        const c = (await yt(`channels?part=snippet,contentDetails&forHandle=${encodeURIComponent(h)}`)).items?.[0];
        if (!c) { console.log(`YT_CH ${h} no encontrado`); continue; }
        const list = await yt(`playlistItems?part=contentDetails&maxResults=8&playlistId=${c.contentDetails.relatedPlaylists.uploads}`);
        const ids = (list.items || []).map((i) => i.contentDetails.videoId);
        const vids = ids.length ? (await yt(`videos?part=snippet,status,statistics&id=${ids.join(',')}`)).items || [] : [];
        console.log(`YT_CH ${h} ` + JSON.stringify({
          name: c.snippet.title,
          videos: vids.map((v) => ({
            id: v.id, t: v.snippet.title.slice(0, 80), d: v.snippet.publishedAt.slice(0, 10), cat: v.snippet.categoryId,
            kids: v.status?.madeForKids, comments: v.statistics?.commentCount ?? 'off', desc: v.snippet.description.slice(0, 120),
          })),
        }));
      } catch (e) {
        console.log(`YT_CH ${h} error ${e.message}`);
      }
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error('ytCommentOnce falló:', error?.message);
    return Response.json({ error: error?.message || 'Error' }, { status: 500 });
  }
}
