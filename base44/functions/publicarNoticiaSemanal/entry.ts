import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// Redacción autónoma de SONORIA FM: cada semana investiga en internet, redacta una
// noticia sobre la radio/artistas/música IA, genera la portada y la publica.
// Solo la llama un workflow programado (como admin), por eso exige rol admin.

const CATEGORIES = ['Artistas', 'Novedades', 'Eventos', 'Radio'];
const AUTHOR = 'Redacción SONORIA';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const sr = base44.asServiceRole;

    // 1. Contexto propio de la radio para que la IA hable de lo nuestro sin inventar.
    const [tracksPage, artistsPage, recentPage] = await Promise.all([
      sr.entities.Track.filter({}, { sort: '-created_date', limit: 12 }).catch(() => ({ items: [] })),
      sr.entities.Artist.filter({}, { sort: '-created_date', limit: 12 }).catch(() => ({ items: [] })),
      sr.entities.Article.filter({}, { sort: '-published_date', limit: 6 }).catch(() => ({ items: [] })),
    ]);

    const trackList = (tracksPage.items || [])
      .map((t) => `${t.title} — ${t.artist}${t.genre ? ` (${t.genre})` : ''}`)
      .join('\n');
    const artistList = (artistsPage.items || [])
      .map((a) => `${a.name}${a.genre ? ` (${a.genre})` : ''}`)
      .join('\n');
    const recentTitles = (recentPage.items || []).map((a) => a.title).join('\n');

    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });

    const prompt = `Actúas como la redacción de SONORIA FM, una radio online española especializada en música hecha con IA y artistas independientes. Tu tarea es redactar la noticia semanal que se publicará en la web.

Investiga en Internet actualidad reciente (últimos 7 días) sobre: música generada con IA, artistas independientes que emergen, novedades del mundo de la radio y el streaming musical, herramientas de creación musical, y eventos o tendencias relevantes para oyentes de una radio de música hecha con IA. Cita hechos reales que encuentres; si no hallas nada sobre un tema, no lo inventes.

Contexto propio de SONORIA FM (úsalo solo si encaja, sin inventar datos):
Catálogo reciente de canciones:
${trackList || '(aún sin canciones)'}

Artistas destacados:
${artistList || '(aún sin artistas)'}

Titulares de noticias ya publicadas (NO repitas estos temas):
${recentTitles || '(es la primera noticia)'}

Requisitos:
- Escribe en español de España, tono cercano y profesional, pensado para oyentes de la radio.
- La noticia debe ser útil e interesante: combina actualidad del sector con un guiño a la música que suena en SONORIA.
- "content": texto plano en párrafos separados por una línea en blanco (sin markdown, sin HTML, sin títulos). Entre 4 y 7 párrafos, cada uno de 2 a 5 frases.
- "title": titular breve y atractivo (máx 80 caracteres).
- "excerpt": resumen de una o dos frases (máx 200 caracteres).
- "category": uno de exactamente estos valores: "Artistas", "Novedades", "Eventos", "Radio".
- "image_prompt": descripción en inglés, detallada, para generar una imagen de portada atractiva y abstracta/temática relacionada con la noticia (sin texto ni letras en la imagen).

Devuelve solo el JSON.`;

    const schema = {
      type: 'object',
      properties: {
        title: { type: 'string' },
        excerpt: { type: 'string' },
        content: { type: 'string' },
        category: { type: 'string', enum: CATEGORIES },
        image_prompt: { type: 'string' },
      },
      required: ['title', 'excerpt', 'content', 'category', 'image_prompt'],
    };

    // add_context_from_internet habilita la búsqueda web (modelo automático compatible).
    const llmRes = await sr.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      response_json_schema: schema,
    });

    const draft = llmRes || {};
    const category = CATEGORIES.includes(draft.category) ? draft.category : 'Novedades';
    const title = String(draft.title || '').trim().slice(0, 120);
    const excerpt = String(draft.excerpt || '').trim().slice(0, 240);
    const content = String(draft.content || '').trim();
    const imagePrompt = String(draft.image_prompt || '').trim().slice(0, 500);

    if (!title || !content) {
      console.error('publicarNoticiaSemanal: IA sin contenido válido', draft);
      return Response.json({ error: 'La IA no devolvió una noticia válida', draft }, { status: 500 });
    }

    // 2. Portada generada por IA a partir del guion visual del artículo.
    let coverUrl = null;
    if (imagePrompt) {
      try {
        const img = await sr.integrations.Core.GenerateImage({ prompt: imagePrompt });
        coverUrl = img?.url || null;
      } catch (err) {
        console.error('publicarNoticiaSemanal: GenerateImage failed', err);
        // La noticia se publica aunque falle la portada.
      }
    }

    // 3. Publicar la noticia.
    const article = await sr.entities.Article.create({
      title,
      excerpt,
      content,
      category,
      author: AUTHOR,
      published_date: today,
      cover_url: coverUrl,
    });

    return Response.json({ ok: true, article });
  } catch (error) {
    console.error('publicarNoticiaSemanal: unhandled error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}