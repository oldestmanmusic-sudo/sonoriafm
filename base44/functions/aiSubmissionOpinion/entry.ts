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

    const prompt = `Actúa como curador musical profesional (perfil A&R) de SONORIA, una radio online española que emite música variada 24/7 (pop latino, urbano/reguetón, baladas y electrónica), con foco en música hecha con IA en España. El administrador va a escuchar este envío y decidir si lo publica en la radio.

Analiza el envío como lo haría un curador experto y escribe tu consejo en español: 4 a 6 frases directas y honestas, sin paja. Cubre: (1) producción y sonido esperables según lo descrito (mezcla, voz, arreglos); (2) el gancho y la letra, citando algún detalle concreto si la letra está disponible; (3) encaje con la emisora y con qué momento de la programación funcionaría mejor (horario, canal de género); (4) riesgos: originalidad, posibles conflictos de derechos o Parecido con artistas conocidos; (5) veredicto final claro: PUBLICAR o DESCARTAR (nunca pedir cambios al artista), con nota de 0 a 10 como curador (por ejemplo "Veredicto: PUBLICAR, nota 7/10"). Si falta información clave para juzgar (sin letra, sin descripción), dilo y baja la seguridad del consejo. No inventes datos que no consten.

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