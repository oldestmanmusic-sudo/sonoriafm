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

// El valor del desplegable puede ser un género añadido por artistas: en la base de datos
// se guarda siempre como "Otros" + el nombre escrito.
export function resolveGenre(selected, typedOther) {
  if (selected === 'Otros') return { genre: 'Otros', genre_other: cleanGenre(typedOther) };
  if (selected && !FORM_GENRES.includes(selected)) return { genre: 'Otros', genre_other: cleanGenre(selected) };
  return { genre: selected, genre_other: '' };
}

// Añade el género nuevo a la lista (si no existe ya) para las próximas subidas.
export async function registerGenre(name, existing) {
  const clean = cleanGenre(name);
  if (!clean) return;
  const k = norm(clean);
  if (FORM_GENRES.some((g) => norm(g) === k) || (existing || []).some((g) => norm(g) === k)) return;
  try {
    await base44.entities.GenreOption.create({ name: clean });
  } catch {
    /* no bloquea el envío */
  }
}
