// Protección sencilla contra envíos automáticos en los formularios públicos
// (campo trampa oculto + tiempo mínimo de rellenado + espera entre envíos).
const MIN_FILL_MS = 3000;
const COOLDOWN_MS = 60 * 1000;

export function looksLikeBot({ honeypot, startedAt }) {
  return Boolean(honeypot) || Date.now() - startedAt < MIN_FILL_MS;
}

export function inCooldown(key) {
  try {
    const last = Number(localStorage.getItem(key) || 0);
    return Date.now() - last < COOLDOWN_MS;
  } catch {
    return false;
  }
}

export function markSent(key) {
  try {
    localStorage.setItem(key, String(Date.now()));
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
}
