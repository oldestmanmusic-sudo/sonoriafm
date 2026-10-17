import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const submissionId = body.submission_id;
    if (!submissionId) return Response.json({ error: 'Falta submission_id' }, { status: 400 });

    const submission = await base44.asServiceRole.entities.Submission.get(submissionId);
    if (!submission) return Response.json({ error: 'Envío no encontrado' }, { status: 404 });

    const parts = [
      `Título: ${submission.song_title}`,
      `Artista: ${submission.artist_name}`,
      `Género declarado: ${submission.genre || 'sin especificar'}`,
      submission.tool && `Herramienta de IA usada: ${submission.tool}`,
      submission.description && `Descripción de la canción: ${submission.description}`,
      submission.artist_bio && `Biografía del artista: ${submission.artist_bio}`,
      submission.lyrics && `Letra:\n${submission.lyrics}`,
    ].filter(Boolean);

    const prompt = `Eres el asesor musical de SONORIA, una radio online española que emite música variada 24/7 (pop latino, urbano/reguetón, baladas y electrónica), con foco en música hecha con IA en España. El administrador va a escuchar este envío y decidir si publicarlo en la radio. Evalúa el envío a partir de esta información y escribe tu consejo en español: 2 a 4 frases claras y honestas, sin adornos. Incluye qué te parece la propuesta, si encaja con la emisora, puntos fuertes, posibles dudas (por ejemplo letra, calidad o derechos) y una recomendación final clara (publicar, pedir cambios o descartar). No inventes datos que no consten en la información.

Información del envío:
${parts.join('\n')}`;

    const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: { opinion: { type: 'string' } },
        required: ['opinion'],
      },
    });

    const opinion = (res && res.opinion) || '';
    if (opinion) {
      await base44.asServiceRole.entities.Submission.update(submissionId, { ai_opinion: opinion });
    }
    return Response.json({ opinion });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}