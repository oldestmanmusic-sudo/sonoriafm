import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from '@/components/ui/use-toast';
import { deviceId } from '@/lib/useTrackLike';

// Aviso entre botones del mismo artista en la página.
const HEART_EVENT = 'sonoria:corazon-artista';

// Artistas que ya tienen corazón de este oyente (se consulta una sola vez).
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
        const res = await base44.functions.invoke('likeArtist', { action: 'status', did });
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

/** Corazón de un artista: uno por oyente y artista, con o sin cuenta. */
export function useArtistLike(artistId, initialLikes = 0) {
  const [likes, setLikes] = useState(initialLikes ?? 0);
  const [liked, setLiked] = useState(false);
  const [liking, setLiking] = useState(false);

  useEffect(() => {
    setLikes(initialLikes ?? 0);
  }, [artistId, initialLikes]);

  useEffect(() => {
    let active = true;
    setLiked(false);
    if (!artistId) return undefined;
    loadLikedIds().then((ids) => {
      if (active && ids.has(artistId)) setLiked(true);
    });
    const onHeart = (e) => {
      if (e.detail?.artistId !== artistId) return;
      setLikes(e.detail.likes);
      setLiked(true);
    };
    window.addEventListener(HEART_EVENT, onHeart);
    return () => {
      active = false;
      window.removeEventListener(HEART_EVENT, onHeart);
    };
  }, [artistId]);

  const like = useCallback(async () => {
    if (liking || !artistId) return;
    if (liked) {
      toast({ title: 'Ya le has dado tu corazón', description: 'Se puede dar uno a cada artista.', duration: 4000 });
      return;
    }
    setLiking(true);
    try {
      const res = await base44.functions.invoke('likeArtist', { artistId, did: deviceId(true) });
      if (likedCache) likedCache.add(artistId);
      window.dispatchEvent(new CustomEvent(HEART_EVENT, { detail: { artistId, likes: res.data.likes } }));
    } catch (error) {
      const limit = (error?.response?.status ?? error?.status) === 429;
      toast({
        title: 'No se ha podido dar el corazón',
        description: limit
          ? 'Hoy se ha llegado al tope sin cuenta. Prueba mañana o inicia sesión.'
          : 'Comprueba tu conexión y prueba otra vez.',
        duration: 6000,
      });
    } finally {
      setLiking(false);
    }
  }, [liking, liked, artistId]);

  return { likes, liked, liking, like };
}
