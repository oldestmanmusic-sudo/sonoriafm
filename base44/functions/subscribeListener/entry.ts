import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Guarda el correo que un oyente deja voluntariamente después de votar (casilla de consentimiento marcada).
// No envía ningún correo. Solo se acepta desde un dispositivo que ha votado.
const MAX_NET_DAY = 5; // altas por conexión y día
const MAX_DAY = 200; // altas totales por día

// La misma frase que ve el oyente (src/lib/consent.js).
const CONSENT_TEXT =
  'Tengo 14 años o más y quiero recibir correos de SONORIA FM con novedades y el TOP semanal. Puedo darme de baja cuando quiera.';

const DID = /^[a-z0-9]{16,40}$/;
const EMAIL = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[a-z]{2,}$/;

const toList = (r) => (Array.isArray(r) ? r : (r?.items ?? []));

const madridDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Madrid',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Resumen de la conexión para un día concreto; '' si no se puede calcular. Nunca se guarda la IP. */
async function networkKey(req, day) {
  const salt = Deno.env.get('VOTE_SALT');
  const header = ['cf-connecting-ip', 'x-real-ip', 'x-forwarded-for'].find((h) => req.headers.get(h));
  const ip = header ? req.headers.get(header).split(',')[0].trim() : '';
  if (!salt || !ip) return '';
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(salt), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`correo|${day}|${ip}`));
  return [...new Uint8Array(sig)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Método no permitido' }, { status: 405 });
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (email.length > 254 || !EMAIL.test(email)) return Response.json({ error: 'email' }, { status: 400 });
    if (body.consent !== true) return Response.json({ error: 'consent' }, { status: 400 });
    const did = typeof body.did === 'string' && DID.test(body.did) ? body.did : '';
    if (!did) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;
    const find = async (entity, query, limit) => toList(await db[entity].filter(query, { limit }));

    if ((await find('TrackLike', { did }, 1)).length === 0) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Si el correo ya está (activo o de baja) no se toca: nadie puede reactivar una baja desde fuera.
    // La respuesta es la misma, para no revelar qué correos están apuntados.
    if ((await find('Subscriber', { email }, 1)).length > 0) return Response.json({ ok: true });

    const day = madridDay.format(new Date());
    const net = await networkKey(req, day);
    const [sameNet, today] = await Promise.all([
      net ? find('Subscriber', { net }, MAX_NET_DAY) : [],
      find('Subscriber', { day }, MAX_DAY),
    ]);
    if (sameNet.length >= MAX_NET_DAY || today.length >= MAX_DAY) {
      return Response.json({ error: 'limit' }, { status: 429 });
    }

    await db.Subscriber.create({
      email,
      status: 'activo',
      consent_text: CONSENT_TEXT,
      consent_at: new Date().toISOString(),
      track_id: typeof body.trackId === 'string' ? body.trackId.slice(0, 40) : '',
      day,
      net,
    });
    return Response.json({ ok: true });
  } catch (error) {
    console.log('subscribeListener', error.message);
    return Response.json({ error: 'No se ha podido guardar' }, { status: 500 });
  }
}
