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