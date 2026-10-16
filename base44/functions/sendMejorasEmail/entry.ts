import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Envía el correo de mejoras de la web a los contactos que enviaron canciones.
// Solo admin puede dispararlo.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const recipients = [
      { email: 'alejanprodeco@gmail.com', first_name: 'José alejandro' },
      { email: 'ginmaz@yahoo.es', first_name: 'eri' },
      { email: 'Oldestmanmusic@gmail.com', first_name: 'Oldestman' },
    ];

    const results = await Promise.allSettled(
      recipients.map((r) =>
        base44.asServiceRole.integrations.Core.SendEmail({
          to: r.email,
          template_name: 'MejorasWeb',
          from_name: 'SONORIA',
          variables: { first_name: r.first_name },
        })
      )
    );

    return Response.json({
      sent: results.filter((r) => r.status === 'fulfilled').length,
      failed: results.filter((r) => r.status === 'rejected').map((r) => r.reason?.message || String(r.reason)),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}