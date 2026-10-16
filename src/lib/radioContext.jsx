import { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';

// RADIO 24H: la emisión es independiente del visitante. La lista suena en bucle
// continuo anclada al reloj (medianoche local): quien entra a una hora cualquiera
// conecta justo en el punto de la emisión que toca a esa hora, con su desfase.
// Las canciones se saltan solo si su fuente de audio no funciona.

const RadioContext = createContext(null);

const FALLBACK_DURATION = 240; // 4 min si falta la duración declarada

// Barajado determinista (basado en los propios identificadores): todo el mundo
// calcula el mismo orden, así la emisión sigue anclada al reloj para cualquier
// visitante. Después se reparte para que no se junten canciones del mismo artista.
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function shuffleDeterministic(list) {
  const sorted = [...list].sort((a, b) => hashStr(String(a.id) + a.title) - hashStr(String(b.id) + b.title));
  const out = [];
  const pool = [...sorted];
  while (pool.length) {
    const prev = out[out.length - 1];
    const idx = pool.findIndex((t) => !prev || t.artist !== prev.artist);
    out.push(pool.splice(idx >= 0 ? idx : 0, 1)[0]);
  }
  return out;
}

function parseDuration(d) {
  if (!d || typeof d !== 'string') return 0;
  const parts = d.split(':').map((p) => parseInt(p, 10));
  if (parts.some((p) => isNaN(p))) return 0;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

function buildSchedule(list) {
  const schedule = list.map((t) => ({ track: t, dur: parseDuration(t.duration) || FALLBACK_DURATION }));
  const total = schedule.reduce((acc, s) => acc + s.dur, 0) || FALLBACK_DURATION;
  return { schedule, total };
}

// Punto de la emisión que toca "ahora": índice de canción y desfase en segundos.
function findPosition(schedule, total, nowMs) {
  const d = new Date(nowMs);
  const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  let t = (((nowMs - midnight) / 1000) % total + total) % total;
  for (let i = 0; i < schedule.length; i++) {
    if (t < schedule[i].dur) return { index: i, offset: t };
    t -= schedule[i].dur;
  }
  return { index: 0, offset: 0 };
}

export function RadioProvider({ children, playlist = [] }) {
  const audioRef = useRef(null);
  const scheduleRef = useRef({ schedule: [], total: FALLBACK_DURATION });
  const currentRef = useRef(null);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [volume, setVol] = useState(0.8);
  const [error, setError] = useState(false);
  const inFlightRef = useRef(false);

  // Carga una canción y se coloca en el punto indicado cuando hay metadatos.
  const startAt = useCallback((track, offset) => {
    return new Promise((resolve) => {
      const audio = audioRef.current;
      if (!audio) { resolve(); return; }
      const onMeta = () => {
        audio.removeEventListener('loadedmetadata', onMeta);
        try {
          const max = audio.duration && audio.duration > 0 ? audio.duration - 1 : offset;
          audio.currentTime = Math.max(0, Math.min(offset, max));
        } catch {
          /* sin metadatos de duración: empieza donde pueda */
        }
        resolve();
      };
      audio.addEventListener('loadedmetadata', onMeta);
      audio.src = track.audio_url;
      audio.load();
    });
  }, []);

  // Entra en la emisión exactamente donde toca según la hora.
  const playScheduled = useCallback(async () => {
    if (inFlightRef.current) return;
    const audio = audioRef.current;
    const { schedule, total } = scheduleRef.current;
    if (!audio || !schedule.length) {
      setIsLoading(false);
      setError(true);
      return;
    }
    inFlightRef.current = true;
    setIsLoading(true);
    setError(false);
    const { index, offset } = findPosition(schedule, total, Date.now());
    for (let step = 0; step < schedule.length; step++) {
      const item = schedule[(index + step) % schedule.length];
      await startAt(item.track, step === 0 ? offset : 0);
      try {
        await audio.play();
        currentRef.current = item.track;
        setCurrentTrack(item.track);
        setIsLoading(false);
        inFlightRef.current = false;
        return;
      } catch (e) {
        // El navegador pide interacción previa (autoplay bloqueado): ni error ni salto.
        if (e && e.name === 'NotAllowedError') {
          setIsLoading(false);
          inFlightRef.current = false;
          return;
        }
        // Esta fuente no funciona: prueba la siguiente canción de la emisión.
      }
    }
    setIsLoading(false);
    setError(true);
    inFlightRef.current = false;
  }, [startAt]);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'none';
    audio.volume = 0.8;
    audioRef.current = audio;

    // Al terminar una canción (o si su fuente falla) sigue la siguiente de la emisión.
    const advance = () => {
      const { schedule } = scheduleRef.current;
      if (!schedule.length) return;
      const i = schedule.findIndex((s) => s.track.id === currentRef.current?.id);
      const next = schedule[(i + 1) % schedule.length];
      currentRef.current = next.track;
      setCurrentTrack(next.track);
      startAt(next.track, 0).then(() => audio.play().catch(() => {}));
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
  }, [startAt]);

  // La programación de la emisión se reconstruye cuando cambia la lista de canciones.
  useEffect(() => {
    scheduleRef.current = buildSchedule(shuffleDeterministic((playlist || []).filter((t) => t && t.audio_url)));
  }, [playlist]);

  // Arranque automático: se intenta cuando ya hay canciones cargadas y, si el
  // navegador lo bloquea, se conecta con la primera interacción del visitante.
  useEffect(() => {
    if (!playlist || !playlist.some((t) => t && t.audio_url)) return;
    const start = () => {
      if (!currentRef.current) playScheduled();
    };
    window.addEventListener('pointerdown', start);
    window.addEventListener('keydown', start);
    if (!currentRef.current) playScheduled();
    return () => {
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
    };
  }, [playlist, playScheduled]);

  // Sincronización con la emisión: cada 20 s se comprueba qué toca y, si alguien
  // lleva la escucha descolgada (pausas, fuente lenta), se recoloca en el punto exacto.
  useEffect(() => {
    const timer = setInterval(() => {
      const audio = audioRef.current;
      if (!audio || audio.paused || !currentRef.current) return;
      const { schedule, total } = scheduleRef.current;
      if (!schedule.length) return;
      const { index, offset } = findPosition(schedule, total, Date.now());
      const item = schedule[index];
      if (item.track.id !== currentRef.current.id) {
        startAt(item.track, offset).then(() => audio.play().catch(() => {}));
        currentRef.current = item.track;
        setCurrentTrack(item.track);
        return;
      }
      if (Math.abs(audio.currentTime - offset) > 20) {
        try { audio.currentTime = offset; } catch { /* aún sin metadatos */ }
      }
    }, 20000);
    return () => clearInterval(timer);
  }, [startAt]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    // Al volver a conectar, entra donde toca la emisión en este momento.
    setIsLoading(true);
    setError(false);
    playScheduled();
  }, [playScheduled]);

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