import { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';

export const STREAM_URL = 'https://ice1.somafm.com/groovesalad-256-mp3';

const RadioContext = createContext(null);

export function RadioProvider({ children }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [volume, setVol] = useState(0.8);
  const [error, setError] = useState(false);

  useEffect(() => {
    const audio = new Audio();
    audio.src = STREAM_URL;
    audio.preload = 'none';
    audio.volume = volume;
    audioRef.current = audio;

    const onPlaying = () => { setIsPlaying(true); setIsLoading(false); setError(false); };
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setIsLoading(true);
    const onCanPlay = () => setIsLoading(false);
    const onError = () => { setIsPlaying(false); setIsLoading(false); setError(true); };

    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('error', onError);

    return () => {
      audio.pause();
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('error', onError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      setIsLoading(true);
      setError(false);
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