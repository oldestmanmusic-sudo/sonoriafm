import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Avisa al administrador por email cuando llega una sugerencia nueva.
// Lo llama el flujo automático (como administrador); el envío va por la
// integración Core con rol de servicio.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { suggestion_id } = await req.json();
    if (!suggestion_id) return Response.json({ error: 'Falta suggestion_id' }, { status: 400 });

    const suggestion = await base44.asServiceRole.entities.Suggestion.get(suggestion_id);
    if (!suggestion) return Response.json({ error: 'Sugerencia no encontrada' }, { status: 404 });

    const res = await base44.asServiceRole.integrations.Core.SendEmail({
      to: 'oldestmanmusic@gmail.com',
      template_name: 'NuevaSugerencia',
      from_name: 'SONORIA',
      variables: {
        category: suggestion.category || 'Mejora',
        message: suggestion.message || '',
      },
    });

    return Response.json({ sent: true, to: 'oldestmanmusic@gmail.com', result: res });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}