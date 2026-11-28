import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// DE UN SOLO USO. Publica 6 comentarios aprobados por Víctor desde el canal de la radio. Caduca el 29/11/2026.
const EXPIRES = Date.parse('2026-11-29T00:00:00Z');
const CHANNEL = 'UCZ_FH7cWbjJwHvfY0CBDKkQ';
const WEB = 'sonoriafm.com';
const ITEMS = [
  { prospect: '6aedd1281410ab6bbf3768c6', video: 'LUoqgUokiDU', text: `¡Un saludo, Jose Yahir! Llevo SONORIA FM, una radio de música hecha con IA, y tu urbano y electrónica encajarían muy bien. Enviar canciones es gratis: ${WEB}` },
  { prospect: '6aedd1281410ab6bbf3768b6', video: 'rynif6LRwww', text: `¡Un saludo, Xavier! Llevo SONORIA FM, una radio de música hecha con IA desde España, y me gustaría que sonaran tus canciones. Enviarlas es gratis: ${WEB}` },
  { prospect: '6aedd1281410ab6bbf3768b0', video: 'EJWPbItqqgM', text: `¡Un saludo, tocayo! Llevo SONORIA FM, una radio de música hecha con IA, y tu pop latino y regional encajarían muy bien. Enviar canciones es gratis: ${WEB}` },
  { prospect: '6aedd1281410ab6bbf3768c1', video: '5iHI_tDSbAw', text: `Un saludo, Luis Armando. Gracias por poner música a un tema tan serio. Llevo SONORIA FM, una radio de música hecha con IA desde España, y me gustaría contar con tus canciones. Enviarlas es gratis: ${WEB}` },
  { prospect: '6aedd1281410ab6bbf3768bd', video: 'LmsqF0FxuAs', text: `¡Un saludo, Epi! Llevo SONORIA FM, una radio desde España de música hecha total o parcialmente con IA. Si tienes temas propios así, enviarlos es gratis: ${WEB}` },
  { prospect: '6aedd1281410ab6bbf3768b8', video: 'aLR8zqnd_gM', text: `¡Un saludo, Ever! Me llama la atención que mezcles zapoteco y español en «Mujer Istmeña». Llevo SONORIA FM, una radio de música hecha con IA, y me gustaría que sonara. Enviar canciones es gratis: ${WEB}` },
];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function(req) {
  try {
    if (Date.now() >= EXPIRES) return Response.json({ reason: 'caducada' });
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('youtube');
    const yt = async (path, body) => {
      const r = await fetch(`https://www.googleapis.com/youtube/v3/${path}`, {
        method: body ? 'POST' : 'GET',
        headers: { Authorization: `Bearer ${accessToken}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await r.json();
      if (!r.ok) throw new Error(`${r.status} ${j?.error?.errors?.[0]?.reason || ''} ${j?.error?.message || ''}`.slice(0, 200));
      return j;
    };
    const me = await yt('channels?part=id&mine=true');
    if (me.items?.[0]?.id !== CHANNEL) throw new Error('El canal conectado no es el esperado');

    const done = [];
    for (const it of ITEMS) {
      try {
        const p = await db.Prospect.get(it.prospect);
        if (p.stage !== 'borrador_listo') { console.log(`YT_SKIP ${it.video} ${p.stage}`); continue; }
        const prev = await yt(`commentThreads?part=snippet&maxResults=100&videoId=${it.video}`);
        let id = (prev.items || []).find((t) => t.snippet?.topLevelComment?.snippet?.authorChannelId?.value === CHANNEL)?.id;
        if (!id) {
          if (done.length) await wait(6000);
          id = (await yt('commentThreads?part=snippet', { snippet: { videoId: it.video, topLevelComment: { snippet: { textOriginal: it.text } } } })).id;
        }
        done.push(id);
        console.log(`YT_OK ${it.video} ${id}`);
        await db.Prospect.update(it.prospect, { stage: 'contactado', next_step: `Comentario publicado: https://www.youtube.com/watch?v=${it.video}&lc=${id} · revisar respuesta`, next_step_date: '2026-12-05' });
      } catch (e) {
        console.log(`YT_ERR ${it.video} ${e.message}`);
        await db.Prospect.update(it.prospect, { next_step: `No se pudo comentar en ${it.video}: ${e.message}`.slice(0, 250) }).catch(() => {});
      }
    }
    if (done.length) {
      await wait(8000);
      try {
        const seen = (await yt(`commentThreads?part=snippet&id=${done.join(',')}`)).items || [];
        console.log('YT_SEEN ' + JSON.stringify(seen.map((t) => ({ id: t.id, v: t.snippet.videoId, public: t.snippet.isPublic }))));
      } catch (e) {
        console.log(`YT_SEEN error ${e.message}`);
      }
    }
    return Response.json({ ok: true, published: done.length });
  } catch (error) {
    console.error('ytCommentOnce falló:', error?.message);
    return Response.json({ error: error?.message || 'Error' }, { status: 500 });
  }
}
