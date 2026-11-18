// Envía un correo de aviso a los compradores que iniciaron un pago (donación o
// servicio) y se quedaron en estado "pending" — la pasarela falló y ya está
// arreglada, les avisamos para que puedan reintentar.
// Admin-only: solo el equipo de SONORIA puede disparar el reenvío masivo.

import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const dryRun = Boolean(body?.dryRun);

    // Solo compradores con email conocido (los anónimos sin completar no dejan email).
    const { items } = await base44.asServiceRole.entities.Base44Purchase.filter(
      { status: "pending" },
      { sort: "-created_date", limit: 500 }
    );
    const emails = Array.from(
      new Set(items.map((p: any) => (p.buyerEmail || "").trim().toLowerCase()).filter(Boolean))
    );

    if (emails.length === 0) {
      return Response.json({ sent: 0, total: 0, message: "No hay checkouts abandonados con email conocido." });
    }

    if (dryRun) {
      return Response.json({ sent: 0, total: emails.length, recipients: emails });
    }

    let sent = 0;
    const errors: Array<{ email: string; error: string }> = [];
    for (const email of emails) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: email,
          template_name: "ServicioRecuperado",
          variables: {
            first_name_suffix: "",
            cta_url: "https://sonoriafm.com",
          },
          category: "transactional",
        });
        sent++;
      } catch (e: any) {
        errors.push({ email, error: e?.message || String(e) });
        console.error("notifyAbandonedCheckouts: send failed", email, e?.message);
      }
    }
    return Response.json({ sent, total: emails.length, recipients: emails, errors });
  } catch (error: any) {
    console.error("notifyAbandonedCheckouts error", error);
    return Response.json({ error: error?.message || "Internal error" }, { status: 500 });
  }
}