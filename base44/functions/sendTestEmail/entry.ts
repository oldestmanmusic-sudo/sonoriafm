import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Diagnóstico temporal: prueba de envío en runtime real.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const steps = [];
    const body = await req.json().catch(() => ({}));
    const mode = body.mode || 'plain';
    try {
      if (mode === 'plain') {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: 'oldestmanmusic@gmail.com',
          from_name: 'SONORIA',
          subject: 'Prueba de envío',
          html: '<p>Correo de prueba del sistema de sugerencias.</p>',
        });
      } else {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: 'oldestmanmusic@gmail.com',
          from_name: 'SONORIA',
          template_name: 'NuevaSugerencia',
          variables: { category: 'Prueba', message: 'Correo de prueba del sistema de sugerencias.' },
        });
      }
      steps.push({ step: 'send', ok: true });
    } catch (e) {
      steps.push({ step: 'send', ok: false, error: e.message });
    }
    return Response.json({ steps });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}