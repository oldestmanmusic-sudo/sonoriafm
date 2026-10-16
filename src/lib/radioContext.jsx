import { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';

// Emisoras probadas que permiten reproducción desde el navegador (la primera en funcionar se usa).
// SomaFM bloquea peticiones con Origin/Referer de la web (403), así que va al final como último recurso.
export const STREAM_URLS = [
  'https://stream.radioparadise.com/mp3-128',
  'https://stream.radioparadise.com/aac-320',
  'https://ice2.somafm.com/groovesalad-128-mp3',
];

const RadioContext = createContext(null);

export function RadioProvider({ children }) {
  const audioRef = useRef(null);
  const streamIndexRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [volume, setVol] = useState(0.8);
  const [error, setError] = useState(false);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'none';
    audio.volume = 0.8;
    audioRef.current = audio;

    const tryNextStream = () => {
      const audio = audioRef.current;
      if (!audio) return;
      if (streamIndexRef.current < STREAM_URLS.length - 1) {
        streamIndexRef.current += 1;
        audio.src = STREAM_URLS[streamIndexRef.current];
        audio.play().catch(() => setError(true));
      } else {
        setIsPlaying(false);
        setIsLoading(false);
        setError(true);
      }
    };

    const onPlaying = () => { setIsPlaying(true); setIsLoading(false); setError(false); };
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setIsLoading(true);
    const onCanPlay = () => setIsLoading(false);
    const onStalled = () => {
      // En navegadores de pruebas el audio a veces se corta solo; lo reanudamos.
      if (!audio.paused) { audio.load(); audio.play().catch(() => {}); }
    };
    const onError = () => { setIsPlaying(false); tryNextStream(); };

    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('stalled', onStalled);
    audio.addEventListener('error', onError);

    return () => {
      audio.pause();
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('stalled', onStalled);
      audio.removeEventListener('error', onError);
    };
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      setIsLoading(true);
      setError(false);
      streamIndexRef.current = 0;
      audio.src = STREAM_URLS[0];
      audio.play().catch(() => { setIsLoading(false); setError(true); });
    }
  }, [isPlaying]);

  const setVolume = useCallback((v) => {
    if (audioRef.current) audioRef.current.volume = v;
    setVol(v);
  }, []);

  return (
    <RadioContext.Provider value={{ isPlaying, isLoading, error, toggle, volume, setVolume }}>
      {children}
    </RadioContext.Provider>
  );
}

export function useRadio() {
  const ctx = useContext(RadioContext);
  if (!ctx) throw new Error('useRadio must be used within RadioProvider');
  return ctx;
}