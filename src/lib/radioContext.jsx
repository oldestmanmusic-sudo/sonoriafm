import { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';

// El reproductor EN VIVO emite los audio_url de los registros Track (MP3 propios,
// servidos por media.base44.com). No usa ningún stream externo.
// Si la canción programada no tiene audio_url, salta a la siguiente que sí lo tenga.

const RadioContext = createContext(null);

export function RadioProvider({ children, playlist = [] }) {
  const audioRef = useRef(null);
  const playlistRef = useRef(playlist);
  playlistRef.current = playlist;
  const currentRef = useRef(null);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [volume, setVol] = useState(0.8);
  const [error, setError] = useState(false);

  const playFrom = useCallback(async (startIdx) => {
    const audio = audioRef.current;
    if (!audio) return;
    const list = playlistRef.current.filter((t) => t && t.audio_url);
    if (!list.length) {
      setIsLoading(false);
      setError(true);
      return;
    }
    for (let step = 0; step < list.length; step++) {
      const track = list[(startIdx + step) % list.length];
      audio.src = track.audio_url;
      try {
        await audio.play();
        currentRef.current = track;
        setCurrentTrack(track);
        setIsLoading(false);
        return;
      } catch (e) {
        // El navegador pide interacción previa (autoplay bloqueado): ni error ni salto.
        if (e && e.name === 'NotAllowedError') {
          setIsLoading(false);
          return;
        }
        // Esta fuente no funciona: prueba la siguiente canción con audio.
      }
    }
    setIsLoading(false);
    setError(true);
  }, []);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'none';
    audio.volume = 0.8;
    audioRef.current = audio;

    // Al terminar una canción (o si su fuente falla) pasa a la siguiente con audio.
    const advance = () => {
      const list = playlistRef.current.filter((t) => t && t.audio_url);
      const i = list.findIndex((t) => t.id === currentRef.current?.id);
      playFrom(i + 1);
    };

    const onPlaying = () => { setIsPlaying(true); setIsLoading(false); setError(false); };
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setIsLoading(true);
    const onCanPlay = () => setIsLoading(false);
    const onEnded = () => { setIsPlaying(false); advance(); };
    const onStalled = () => {
      if (!audio.paused) { audio.load(); audio.play().catch(() => {}); }
    };

    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('stalled', onStalled);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', advance);

    return () => {
      audio.pause();
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('stalled', onStalled);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', advance);
    };
  }, [playFrom]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      setIsLoading(true);
      setError(false);
      const canResume = audio.src && currentRef.current && audio.currentTime > 0 && !audio.ended;
      if (canResume) {
        audio.play().catch((e) => {
          setIsLoading(false);
          if (!e || e.name !== 'NotAllowedError') setError(true);
        });
      } else {
        playFrom(0);
      }
    }
  }, [isPlaying, playFrom]);

  const setVolume = useCallback((v) => {
    if (audioRef.current) audioRef.current.volume = v;
    setVol(v);
  }, []);

  return (
    <RadioContext.Provider value={{ isPlaying, isLoading, error, toggle, volume, setVolume, currentTrack }}>
      {children}
    </RadioContext.Provider>
  );
}

export function useRadio() {
  const ctx = useContext(RadioContext);
  if (!ctx) throw new Error('useRadio must be used within RadioProvider');
  return ctx;
}