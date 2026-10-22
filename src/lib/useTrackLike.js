import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

// Ids de canciones a las que el usuario actual ya dio "me gusta" (se carga una sola vez).
let likedCache = null;
let likedPromise = null;

function loadLikedIds() {
  if (likedCache) return Promise.resolve(likedCache);
  if (!likedPromise) {
    likedPromise = (async () => {
      try {
        const authed = await base44.auth.isAuthenticated();
        if (!authed) return null; // sin sesión: no se guarda en caché
        const res = await base44.functions.invoke('likeTrack', { action: 'status' });
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
 * "Me gusta" de una canción: un solo like por usuario.
 * Devuelve el contador, si el usuario ya dio like y la función para darlo.
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
      if (active) setLiked(ids.has(trackId));
    });
    return () => { active = false; };
  }, [trackId]);

  const like = useCallback(async () => {
    if (liking || liked || !trackId) return;
    const authed = await base44.auth.isAuthenticated();
    if (!authed) {
      base44.auth.redirectToLogin(window.location.pathname + window.location.search);
      return;
    }
    setLiking(true);
    try {
      const res = await base44.functions.invoke('likeTrack', { trackId });
      setLikes(res.data.likes);
      setLiked(true);
      if (likedCache) likedCache.add(trackId);
    } catch {
      /* el contador no cambia si falla */
    } finally {
      setLiking(false);
    }
  }, [liking, liked, trackId]);

  return { likes, liked, liking, like };
}
