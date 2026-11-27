import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Botón de la app: va en todos los correos de la radio.
const APP_URL = 'https://sonoriafm.com/app';
const appButton = () =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:22px auto 8px">` +
  `<tr><td bgcolor="#8b33ff" style="background:#8b33ff;border-radius:999px;text-align:center">` +
  `<a href="${APP_URL}" style="display:inline-block;padding:14px 30px;color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none">Descargar la app</a>` +
  `</td></tr></table>` +
  `<p style="margin:0 0 22px;text-align:center;font-size:13px;color:#6b7280">La app de SONORIA FM es gratis.</p>`;

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
          html: '<p>Correo de prueba del sistema de sugerencias.</p>' + appButton(),
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