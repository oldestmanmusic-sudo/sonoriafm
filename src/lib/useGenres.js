import { useEffect, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { FORM_GENRES } from '@/lib/brand';

const norm = (s) => (s || '').trim().toLowerCase();

// Limpia el texto que escribe el artista: espacios, longitud y primera letra en mayúscula.
export function cleanGenre(s) {
  const t = (s || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
}

// Opciones del desplegable "Tipo de música": las de siempre, las que han añadido los
// artistas con "Otros" y, al final, "Otros".
export function useGenreOptions() {
  const [custom, setCustom] = useState([]);

  const load = useCallback(async () => {
    try {
      const rows = await base44.entities.GenreOption.list('name', 200);
      setCustom((rows || []).map((r) => r.name).filter(Boolean));
    } catch {
      /* sin lista extra: quedan las opciones de siempre */
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const baseKeys = new Set(FORM_GENRES.map(norm));
  const seen = new Set();
  const extra = custom.filter((n) => {
    const k = norm(n);
    if (!k || baseKeys.has(k) || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const options = [...FORM_GENRES.filter((g) => g !== 'Otros'), ...extra, 'Otros'];
  return { options, extra, reload: load };
}

// El género se guarda con su propio nombre: el de la lista, o el que escribió el artista
// con "Otros" (si coincide con uno de siempre, se usa ese). genre_other solo marca que
// el género lo escribió el artista.
export function resolveGenre(selected, typedOther) {
  if (selected !== 'Otros') return { genre: selected, genre_other: '' };
  const clean = cleanGenre(typedOther);
  const known = FORM_GENRES.find((g) => g !== 'Otros' && norm(g) === norm(clean));
  if (known) return { genre: known, genre_other: '' };
  return { genre: clean || 'Otros', genre_other: clean };
}

// Lo llama el administrador al APROBAR una canción: añade su género nuevo a la lista del
// desplegable (si no existe ya) para las próximas subidas.
export async function registerGenre(name) {
  const clean = cleanGenre(name);
  if (!clean) return;
  const k = norm(clean);
  if (FORM_GENRES.some((g) => norm(g) === k)) return;
  try {
    const rows = await base44.entities.GenreOption.list('name', 200);
    if ((rows || []).some((r) => norm(r.name) === k)) return;
    await base44.entities.GenreOption.create({ name: clean });
  } catch {
    /* no bloquea la aprobación */
  }
}
