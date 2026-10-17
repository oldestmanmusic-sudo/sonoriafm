import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Notifica por correo al remitente de un envío una decisión del administrador:
// 'approved' (se emitirá su canción) o 'rejected' (no se podrá emitir, con disculpas).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const submissionId = body.submission_id;
    const decision = body.decision;
    if (!submissionId || (decision !== 'approved' && decision !== 'rejected')) {
      return Response.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }

    const submission = await base44.asServiceRole.entities.Submission.get(submissionId);
    if (!submission) return Response.json({ error: 'Envío no encontrado' }, { status: 404 });
    if (submission.status !== decision) {
      return Response.json({ error: 'El estado del envío no coincide con la decisión' }, { status: 409 });
    }
    if (!submission.email) return Response.json({ ok: true, email_sent: false, reason: 'El envío no tiene email de contacto' });

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: submission.email,
      template_name: decision === 'approved' ? 'AprobacionEnvio' : 'RechazoEnvio',
      variables: {
        artist_name: submission.artist_name || 'artista',
        song_title: submission.song_title || 'tu canción',
        reason: decision === 'rejected'
          ? (submission.admin_note || 'Tras revisar tu envío, hemos decidido no incluirlo en nuestra programación actual, aunque te animamos a seguir enviándonos nueva música.')
          : '',
      },
    });
    return Response.json({ ok: true, email_sent: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}