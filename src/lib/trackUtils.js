// Normaliza títulos de canciones para detectar duplicados:
// minúsculas, sin contenido entre paréntesis (p. ej. "(Remastered)")
// y espacios colapsados.
export const normalizeTrackTitle = (s) =>
  (s || '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// Devuelve la URL solo si es http/https segura (nunca javascript:, data:, etc.).
// Si el texto no trae esquema, se asume https:// (enlaces pegados sin protocolo).
export const safeAudioUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
};