import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const b64 = (s) => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const x of bytes) bin += String.fromCharCode(x);
  return btoa(bin);
};
// Envío por Gmail (la integración Core.SendEmail de la plataforma falla con error 5xx).
async function sendGmail(svc, { to, subject, html }) {
  const { accessToken } = await svc.connectors.getConnection('gmail');
  const body = b64(html).replace(/(.{76})/g, '$1\r\n');
  const mime = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${b64(subject)}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    body,
  ].join('\r\n');
  const raw = b64(mime).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  });
  if (!r.ok) throw new Error(`Gmail ${r.status}: ${(await r.text()).slice(0, 300)}`);
}
const wrap = (inner) =>
  `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#14141f;line-height:1.6">${inner}` +
  `<p style="font-size:12px;color:#6b7280;margin-top:28px">SONORIA FM · <a href="https://sonoriafm.com" style="color:#8b33ff">sonoriafm.com</a></p></div>`;

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

    let submission = null;
    try {
      submission = await base44.asServiceRole.entities.Submission.get(submissionId);
    } catch {
      submission = null;
    }
    if (!submission) return Response.json({ error: 'Envío no encontrado' }, { status: 404 });
    if (submission.status !== decision) {
      return Response.json({ error: 'El estado del envío no coincide con la decisión' }, { status: 409 });
    }
    if (!submission.email) return Response.json({ ok: true, email_sent: false, reason: 'El envío no tiene email de contacto' });

    // El fallo del correo no debe romper la decisión del administrador:
    // se informa en la respuesta, pero la función responde 200 igualmente.
    try {
      const artist = esc(submission.artist_name || 'artista');
      const song = esc(submission.song_title || 'tu canción');
      if (decision === 'approved') {
        await sendGmail(base44.asServiceRole, {
          to: submission.email,
          subject: `Enhorabuena, ${submission.artist_name || 'artista'}: emitimos "${submission.song_title || 'tu canción'}" en SONORIA FM`,
          html: wrap(
            `<h2 style="color:#8b33ff">Enhorabuena, ${artist}.</h2>` +
            `<p>Es un verdadero placer escribirle con buenas noticias: tras escuchar atentamente "${song}", nuestro equipo de programación ha decidido <strong>aceptar su canción para su emisión en SONORIA FM</strong>.</p>` +
            `<p>Su canción formará parte de nuestra programación habitual y estará disponible en la ficha de su perfil de artista en nuestra web. Gracias de corazón por permitirnos emitir su música.</p>` +
            `<p><a href="https://sonoriafm.com" style="color:#8b33ff;font-weight:bold">Escuchar SONORIA FM</a></p>`
          ),
        });
      } else {
        const reason = esc(submission.admin_note || 'Tras revisar tu envío, hemos decidido no incluirlo en nuestra programación actual, aunque te animamos a seguir enviándonos nueva música.');
        await sendGmail(base44.asServiceRole, {
          to: submission.email,
          subject: `Sobre tu canción "${submission.song_title || 'tu canción'}" en SONORIA FM`,
          html: wrap(
            `<h2 style="color:#8b33ff">Estimado equipo de ${artist},</h2>` +
            `<p>Ante todo, gracias de todo corazón por compartir con nosotros su canción "${song}". Sabemos el esfuerzo y el cariño que hay detrás de cada obra.</p>` +
            `<p>Tras una escucha atenta y respetuosa, debemos comunicarle con sinceridad que <strong>en esta ocasión no podremos emitir su canción</strong> en nuestra programación, por lo que le pedimos sinceras disculpas. La decisión responde únicamente a las necesidades de nuestra emisora en este momento y no resta mérito a su trabajo.</p>` +
            `<p style="background:#f5f0ff;border-radius:12px;padding:14px 18px"><strong style="color:#8b33ff">Motivo de la decisión:</strong> ${reason}</p>` +
            `<p>Le animamos a seguir creando y a enviarnos nuevas propuestas: estaremos encantados de volver a escucharle.</p>` +
            `<p>Con nuestro más sincero agradecimiento, el equipo de SONORIA FM.</p>`
          ),
        });
      }
      return Response.json({ ok: true, email_sent: true });
    } catch (emailError) {
      console.error('SendEmail falló:', emailError.message);
      return Response.json({ ok: true, email_sent: false, reason: emailError.message });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}