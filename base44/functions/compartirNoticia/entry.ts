import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// PÚBLICA. Enlace para compartir una noticia con su propio título, resumen y foto.
// Las redes sociales leen estas etiquetas; las personas pasan al momento a la noticia.
//
// Uso: GET .../functions/compartirNoticia?id=ID_DE_LA_NOTICIA
//   ver=1 -> muestra las etiquetas sin pasar a la noticia (para comprobarlas).

const SITE = 'https://sonoriafm.com';
const DEFAULT_IMAGE = 'https://media.base44.com/images/public/6ace0c27732bbb0f4d7504e1/9af340917_Postpromocional1080x10802x.png';
const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ENTITIES[c]);
const plain = (v) => String(v ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const goTo = (url) => new Response(null, { status: 302, headers: { location: url } });

export default async function(req) {
  const query = new URL(req.url).searchParams;
  const id = query.get('id') || '';
  if (!/^[a-f0-9]{24}$/i.test(id)) return goTo(`${SITE}/noticias`);

  let article = null;
  try {
    article = await createClientFromRequest(req).asServiceRole.entities.Article.get(id);
  } catch (_) { /* no existe o ya no está disponible */ }
  if (!article?.title) return goTo(`${SITE}/noticias`);

  const url = `${SITE}/noticias/${id}`;
  const title = esc(article.title);
  const description = esc((plain(article.excerpt) || plain(article.content)).slice(0, 200));
  const image = esc(String(article.cover_url || '').startsWith('https://') ? article.cover_url : DEFAULT_IMAGE);

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title} · SONORIA FM</title>
<meta name="description" content="${description}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="SONORIA FM">
<meta property="og:locale" content="es_ES">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${image}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${image}">
${query.get('ver') === '1' ? '' : `<script>location.replace(${JSON.stringify(url)});</script>`}
</head>
<body>
<p><a href="${url}">Leer «${title}» en SONORIA FM</a></p>
</body>
</html>`;

  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' },
  });
}
