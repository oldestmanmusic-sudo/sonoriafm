import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from '@/components/ui/use-toast';

// Se puede votar sin cuenta. El navegador se identifica con un código aleatorio que se crea solo
// al votar por primera vez y se guarda en este dispositivo.
const VOTE_KEY = 'sonoria_voto_id';
// Aviso entre botones de la misma página (la canción puede estar a la vez en la ficha y en el reproductor).
const VOTE_EVENT = 'sonoria:voto';
let memoryId = '';

function deviceId(create = false) {
  try {
    const saved = window.localStorage.getItem(VOTE_KEY);
    if (saved) return saved;
  } catch { /* almacenamiento bloqueado */ }
  if (!memoryId && create) {
    const abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
    memoryId = Array.from(window.crypto.getRandomValues(new Uint8Array(32)), (n) => abc[n % abc.length]).join('');
    try { window.localStorage.setItem(VOTE_KEY, memoryId); } catch { /* se queda en memoria */ }
  }
  return memoryId;
}

// Ids de canciones a las que este oyente ya dio "me gusta" (se carga una sola vez).
let likedCache = null;
let likedPromise = null;

function loadLikedIds() {
  if (likedCache) return Promise.resolve(likedCache);
  if (!likedPromise) {
    likedPromise = (async () => {
      try {
        const authed = await base44.auth.isAuthenticated();
        const did = deviceId();
        if (!authed && !did) return null; // nunca ha votado: nada que consultar
        const res = await base44.functions.invoke('likeTrack', { action: 'status', did });
        return new Set(res.data?.likedIds ?? []);
      } catch {
        return null;
      }
    })().then((set) => {
      likedPromise = null;
      if (set) likedCache = set;
      return set ?? new Set();
    });
  }
  return likedPromise;
}

/**
 * "Me gusta" de una canción: un voto por canción y oyente, con o sin cuenta.
 * Devuelve el contador, si ya se ha votado y la función para votar.
 */
export function useTrackLike(trackId, initialLikes = 0) {
  const [likes, setLikes] = useState(initialLikes ?? 0);
  const [liked, setLiked] = useState(false);
  const [liking, setLiking] = useState(false);

  useEffect(() => {
    setLikes(initialLikes ?? 0);
  }, [trackId, initialLikes]);

  useEffect(() => {
    let active = true;
    setLiked(false);
    if (!trackId) return undefined;
    loadLikedIds().then((ids) => {
      if (active && ids.has(trackId)) setLiked(true);
    });
    const onVote = (e) => {
      if (e.detail?.trackId !== trackId) return;
      setLikes(e.detail.likes);
      setLiked(true);
    };
    window.addEventListener(VOTE_EVENT, onVote);
    return () => {
      active = false;
      window.removeEventListener(VOTE_EVENT, onVote);
    };
  }, [trackId]);

  const like = useCallback(async () => {
    if (liking || liked || !trackId) return;
    setLiking(true);
    try {
      const res = await base44.functions.invoke('likeTrack', { trackId, did: deviceId(true) });
      if (likedCache) likedCache.add(trackId);
      window.dispatchEvent(new CustomEvent(VOTE_EVENT, { detail: { trackId, likes: res.data.likes } }));
    } catch (error) {
      const limit = (error?.response?.status ?? error?.status) === 429;
      toast({
        title: 'No se ha podido contar el voto',
        description: limit
          ? 'Hoy se ha llegado al tope de votos sin cuenta. Prueba mañana o inicia sesión.'
          : 'Comprueba tu conexión y prueba otra vez.',
        duration: 6000,
      });
    } finally {
      setLiking(false);
    }
  }, [liking, liked, trackId]);

  return { likes, liked, liking, like };
}
