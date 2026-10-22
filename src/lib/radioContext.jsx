import { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';

// RADIO 24H ALEATORIA: la emisión sigue anclada al reloj (medianoche local)
// para que todo el mundo conecte en el mismo punto de la emisión, pero el orden
// de cada vuelta completa es un barajado aleatorio (determinista por vuelta:
// la vuelta es la semilla) que intercala artistas, sin dos canciones seguidas
// del mismo artista. Al agotarse la lista, la siguiente vuelta se baraja de
// nuevo con otra semilla: mezcla distinta y emisión 24/7 en bucle infinito.
// Las canciones se saltan solo si su fuente de audio no funciona.

const RadioContext = createContext(null);

const FALLBACK_DURATION = 240; // 4 min si falta la duración declarada

// Hash determinista: todo el mundo calcula la misma emisión.
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Barajado aleatorio determinista (Fisher-Yates con semilla): cada vuelta usa
// su propio número de vuelta como semilla, así la mezcla cambia en cada vuelta
// pero es idéntica para todos los oyentes.
function seededShuffle(list, seed) {
  const arr = [...list].sort((a, b) => hashStr(String(a.id)) - hashStr(String(b.id)));
  for (let i = arr.length - 1; i > 0; i--) {
    const j = hashStr(String(arr[i].id) + ':' + seed) % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Reparte las canciones alternando artistas: en cada paso se elige del grupo
// (artista) con más canciones pendientes que no sea el artista anterior. Solo
// si un artista concentra todas las restantes se fuerza la repetición.
function interleaveArtists(order, prevArtist) {
  const groups = new Map();
  order.forEach((t) => {
    if (!groups.has(t.artist)) groups.set(t.artist, []);
    groups.get(t.artist).push(t);
  });
  const out = [];
  let prev = prevArtist || null;
  while (out.length < order.length) {
    let candidates = [...groups.entries()].filter(([, g]) => g.length > 0 && g[0].artist !== prev);
    if (!candidates.length) candidates = [...groups.entries()].filter(([, g]) => g.length > 0);
    candidates.sort((a, b) => b[1].length - a[1].length);
    const pick = candidates[0][1].shift();
    prev = pick.artist;
    out.push(pick);
  }
  return out;
}

// Orden de una vuelta completa: barajado con la semilla de la vuelta y artistas
// intercalados; la primera pista no repite el artista con la última de la
// vuelta anterior (así el borde entre vueltas tampoco junta artistas).
const cycleCache = new Map();
function buildCycle(list, cycle) {
  if (cycle < 0) cycle = 0;
  const cached = cycleCache.get(cycle);
  if (cached && cached.list === list) return cached.schedule;
  const wrap = (t, fallback) => ({ track: t, dur: parseDuration(t.duration) || fallback });
  // El motor de emisión consume {track, dur}: envolvemos las canciones del
  // barajado con su duración real (o el respaldo de 4 minutos).
  const base = seededShuffle(list, cycle);
  const prevLast = cycle > 0
    ? interleaveArtists(seededShuffle(list, cycle - 1)).slice(-1)[0].artist
    : null;
  const schedule = interleaveArtists(base, prevLast).map((t) => wrap(t, FALLBACK_DURATION));
  if (cycleCache.size > 500) cycleCache.clear();
  cycleCache.set(cycle, { list, schedule });
  return schedule;
}

function parseDuration(d) {
  if (!d || typeof d !== 'string') return 0;
  const parts = d.split(':').map((p) => parseInt(p, 10));
  if (parts.some((p) => isNaN(p))) return 0;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

// Punto de la emisión que toca "ahora": vuelta (barajado) actual, índice de
// canción dentro de esa vuelta y desfase en segundos. Las vueltas no duran
// todas lo mismo, así que el tiempo del día se reparte recorriendo las vueltas
// reales una a una: el punto de conexión es exacto y determinista, igual para
// todos los oyentes.
// El índice de vuelta se ancla al día (base 1000 por día), así el borde entre
// vueltas siempre conecta dos barajados distintos y el bucle es infinito.
const MAX_CYCLES_PER_DAY = 500;
function findPosition(list, nowMs) {
  const d = new Date(nowMs);
  const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayIndex = Math.floor(midnight / 86400000);
  const secondsOfDay = (nowMs - midnight) / 1000;
  let acc = 0;
  for (let k = 0; k < MAX_CYCLES_PER_DAY; k++) {
    const schedule = buildCycle(list, dayIndex * 1000 + k);
    const len = schedule.reduce((sum, item) => sum + item.dur, 0) || FALLBACK_DURATION;
    if (secondsOfDay < acc + len) {
      let t = secondsOfDay - acc;
      for (let i = 0; i < schedule.length; i++) {
        if (t < schedule[i].dur) return { schedule, index: i, offset: t };
        t -= schedule[i].dur;
      }
      return { schedule, index: 0, offset: 0 };
    }
    acc += len;
  }
  return { schedule: buildCycle(list, dayIndex * 1000), index: 0, offset: 0 };
}

export function RadioProvider({ children, playlist = [] }) {
  const audioRef = useRef(null);
  const playlistRef = useRef([]);
  const currentRef = useRef(null);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [scheduledTrack, setScheduledTrack] = useState(null);
  // Modo "a la carta": una canción elegida por el usuario sustituye a la
  // emisión en vivo hasta que termina o hasta que el usuario vuelve a la radio.
  const [onDemandTrack, setOnDemandTrack] = useState(null);
  const onDemandRef = useRef(null);
  const epochRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [volume, setVol] = useState(0.75);
  const [error, setError] = useState(false);
  const inFlightRef = useRef(false);
  // Distingue la pausa que ordena el usuario (botón) de la que provoca el
  // sistema al ceder el audio a otra app con la pestaña oculta.
  const pausedByUserRef = useRef(false);
  // Solo UNA pestaña del navegador suena a la vez: cada reproducción anuncia
  // su arranque y las demás se silencian (evita dos radios superpuestas).
  const channelRef = useRef(null);
  const tabIdRef = useRef(Math.random().toString(36).slice(2));
  const lastStartRef = useRef(0);

  const announcePlay = useCallback(() => {
    lastStartRef.current = Date.now();
    const ch = channelRef.current;
    if (ch) ch.postMessage({ id: tabIdRef.current, ts: lastStartRef.current });
  }, []);

  // Carga una canción y se coloca en el punto indicado cuando hay metadatos.
  // Si la fuente no responde (enlace roto o no directo), un temporizador
  // resuelve a los 8 s: el motor nunca se queda bloqueado esperando.
  const startAt = useCallback((track, offset) => {
    return new Promise((resolve) => {
      const audio = audioRef.current;
      if (!audio) { resolve(); return; }
      let settled = false;
      const settle = (applyOffset) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        audio.removeEventListener('loadedmetadata', onMeta);
        if (applyOffset) {
          try {
            const max = audio.duration && audio.duration > 0 ? audio.duration - 1 : offset;
            audio.currentTime = Math.max(0, Math.min(offset, max));
          } catch {
            /* sin metadatos de duración: empieza donde pueda */
          }
        }
        resolve();
      };
      const onMeta = () => settle(true);
      const timer = setTimeout(() => settle(false), 8000);
      audio.addEventListener('loadedmetadata', onMeta);
      audio.src = track.audio_url;
      audio.load();
    });
  }, []);

  // Entra en la emisión en la canción y desfase indicados. Si la fuente de una
  // canción no funciona, prueba la siguiente del barajado (y así sucesivamente).
  const enter = useCallback(async (schedule, index, offset) => {
    const audio = audioRef.current;
    if (!audio || !schedule.length) {
      setIsLoading(false);
      setError(true);
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    pausedByUserRef.current = false;
    const myEpoch = epochRef.current;
    setIsLoading(true);
    setError(false);
    for (let step = 0; step < schedule.length; step++) {
      if (epochRef.current !== myEpoch) { inFlightRef.current = false; return; }
      const item = schedule[(index + step) % schedule.length];
      await startAt(item.track, step === 0 ? offset : 0);
      try {
        await audio.play();
        currentRef.current = item.track;
        setCurrentTrack(item.track);
        announcePlay();
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
        // Esta fuente no funciona: prueba la siguiente canción del barajado.
      }
    }
    setIsLoading(false);
    setError(true);
    inFlightRef.current = false;
  }, [startAt, announcePlay]);

  // Entra en la emisión exactamente donde toca según la hora (y vuelta actual).
  const playScheduled = useCallback(() => {
    if (!playlistRef.current.length) {
      setIsLoading(false);
      setError(true);
      return;
    }
    const { schedule, index, offset } = findPosition(playlistRef.current, Date.now());
    enter(schedule, index, offset);
  }, [enter]);

  // La canción a la carta terminó (o su fuente falló): reconecta con la
  // emisión en vivo exactamente donde esté la rotación en ese momento.
  const onDemandFinished = useCallback(() => {
    onDemandRef.current = null;
    setOnDemandTrack(null);
    playScheduled();
  }, [playScheduled]);

  // Reproduce una canción "a la carta": corta la emisión en vivo y suena solo
  // esta canción. Solo un audio a la vez: la radio queda en pausa.
  const playOnDemand = useCallback(async (track) => {
    const audio = audioRef.current;
    if (!audio || !track || !track.audio_url) return;
    epochRef.current += 1;
    inFlightRef.current = false;
    setError(false);
    setIsLoading(true);
    pausedByUserRef.current = false;
    onDemandRef.current = track;
    setOnDemandTrack(track);
    try {
      audio.src = track.audio_url;
      await audio.play();
      announcePlay();
    } catch (e) {
      // Autoplay bloqueado: queda preparada para reanudar con el botón.
      // Si la fuente no carga (no es autoplay), se descarta y vuelve a la radio.
      if (!e || e.name !== 'NotAllowedError') onDemandFinished();
    } finally {
      setIsLoading(false);
    }
  }, [onDemandFinished]);

  // Vuelve a la radio en vivo: corta la canción a la carta y conecta donde
  // toque la rotación aleatoria en este momento.
  const resumeLive = useCallback(() => {
    if (!onDemandRef.current) return;
    epochRef.current += 1;
    inFlightRef.current = false;
    onDemandRef.current = null;
    setOnDemandTrack(null);
    pausedByUserRef.current = false;
    setIsLoading(true);
    setError(false);
    playScheduled();
  }, [playScheduled]);

  // Al terminar una canción (o si su fuente falla): si el reloj aún apunta a la
  // pista que acaba de sonar, pasa a la siguiente del barajado; si ya empezó la
  // siguiente, conecta donde está la emisión.
  const advance = useCallback(() => {
    if (!playlistRef.current.length || inFlightRef.current) return;
    const { schedule, index, offset } = findPosition(playlistRef.current, Date.now());
    // Si el reloj ya avanzó (p. ej. la escucha se colgó con el móvil
    // bloqueado), conectamos en el punto exacto de la emisión, no al inicio
    // de la canción: así no salta al centro de otro tema.
    let start = index;
    let startOffset = offset;
    if (schedule[start] && schedule[start].track.id === currentRef.current?.id) {
      start = (start + 1) % schedule.length;
      startOffset = 0;
    }
    enter(schedule, start, startOffset);
  }, [enter]);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'none';
    audio.volume = 0.75;
    audioRef.current = audio;

    const onPlaying = () => { setIsPlaying(true); setIsLoading(false); setError(false); };
    const onPause = () => { setIsPlaying(false); setIsLoading(false); };
    const onWaiting = () => setIsLoading(true);
    const onCanPlay = () => setIsLoading(false);
    const onEnded = () => {
      setIsPlaying(false);
      if (onDemandRef.current) onDemandFinished(); else advance();
    };
    const onError = () => {
      if (onDemandRef.current) onDemandFinished(); else advance();
    };
    const onStalled = () => {
      // Sin audio.load(): resetearía la posición al inicio y la canción
      // se reiniciaría de cero (un salto audible). Solo reanudamos.
      if (!audio.paused) audio.play().catch(() => {});
    };
    // Al volver a la pestaña: si el sistema pausó la radio mientras estaba
    // oculta (p. ej. para dar el audio a otra app), reanuda donde toque la
    // emisión. No aplica si la pausa la puso el usuario.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const a = audioRef.current;
      if (!a || !currentRef.current || !playlistRef.current.length) return;
      // La canción a la carta y la pausa del usuario se quedan como están.
      if (onDemandRef.current || pausedByUserRef.current || inFlightRef.current) return;
      const { schedule, index, offset } = findPosition(playlistRef.current, Date.now());
      const item = schedule[index];
      const stale = item.track.id !== currentRef.current.id || Math.abs(a.currentTime - offset) > 30;
      if (!a.paused) {
        // Sigue sonando tras el bloqueo: solo recoloca si quedó descolgada
        // de la emisión (quedarse con la canción anterior provoca saltos).
        if (stale) {
          if (item.track.id === currentRef.current.id) {
            try { a.currentTime = offset; } catch { /* aún sin metadatos */ }
          } else {
            enter(schedule, index, offset);
          }
        }
        return;
      }
      // Quedó en pausa o colgada en CONECTANDO: reconecta exactamente donde
      // está la emisión en vivo en este momento.
      playScheduled();
    };
    document.addEventListener('visibilitychange', onVisible);

    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('stalled', onStalled);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      audio.pause();
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('stalled', onStalled);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [advance, onDemandFinished, playScheduled]);

  // La emisión se reconstruye cuando cambia la lista de canciones.
  useEffect(() => {
    // Las cuñas ya no forman parte de la emisión: se excluyen del catálogo.
    playlistRef.current = (playlist || []).filter((t) => t && t.audio_url && t.genre !== 'Cuña');
  }, [playlist]);

  // Arbitraje entre pestañas: gana la reproducción más reciente (desempate
  // estable por id); la pestaña perdedora se calla, y al volver a ella
  // retoma la emisión en el punto exacto.
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel('sonoria-radio');
    channelRef.current = ch;
    ch.onmessage = (e) => {
      const msg = e.data || {};
      if (msg.id === tabIdRef.current) return;
      const otherWins = (msg.ts || 0) > lastStartRef.current ||
        ((msg.ts || 0) === lastStartRef.current && String(msg.id) > tabIdRef.current);
      if (otherWins) {
        const a = audioRef.current;
        if (a && !a.paused) a.pause();
      } else {
        const a = audioRef.current;
        if (a && !a.paused) ch.postMessage({ id: tabIdRef.current, ts: lastStartRef.current });
      }
    };
    return () => {
      ch.close();
      if (channelRef.current === ch) channelRef.current = null;
    };
  }, []);

  // "Sonando ahora" según el reloj: qué canción del barajado de la vuelta
  // actual toca en este momento, aunque nadie esté escuchando. Cada 15 s.
  useEffect(() => {
    const update = () => {
      if (!playlistRef.current.length) return;
      const { schedule, index } = findPosition(playlistRef.current, Date.now());
      setScheduledTrack(schedule[index].track);
    };
    update();
    const timer = setInterval(update, 15000);
    return () => clearInterval(timer);
  }, [playlist]);

  // Arranque automático: se intenta cuando ya hay canciones cargadas y, si el
  // navegador lo bloquea, se conecta con la primera interacción del visitante.
  useEffect(() => {
    if (!playlist || !playlist.some((t) => t && t.audio_url)) return;
    const start = () => {
      if (!currentRef.current && !onDemandRef.current) playScheduled();
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
      if (onDemandRef.current) return;
      if (!playlistRef.current.length) return;
      const { schedule, index, offset } = findPosition(playlistRef.current, Date.now());
      const item = schedule[index];
      if (item.track.id !== currentRef.current.id) {
        enter(schedule, index, offset);
        return;
      }
      if (Math.abs(audio.currentTime - offset) > 20) {
        try { audio.currentTime = offset; } catch { /* aún sin metadatos */ }
      }
    }, 20000);
    return () => clearInterval(timer);
  }, [enter]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      pausedByUserRef.current = true;
      return;
    }
    // Reanudar: si hay una canción a la carta, continúa donde estaba; si no,
    // entra en la emisión donde toca en este momento.
    pausedByUserRef.current = false;
    setIsLoading(true);
    setError(false);
    if (onDemandRef.current) {
      audio.play().then(announcePlay).catch(() => {
        // La canción a la carta no se puede reproducir (fuente rota): se
        // descarta y el motor reconecta con la emisión en vivo.
        onDemandFinished();
      });
      return;
    }
    playScheduled();
  }, [playScheduled, announcePlay]);

  const setVolume = useCallback((v) => {
    if (audioRef.current) audioRef.current.volume = v;
    setVol(v);
  }, []);

  // Controles multimedia del sistema (Android/iOS): notificación y pantalla de
  // bloqueo con título, artista, carátula y botones de reproducir/pausar.
  useEffect(() => {
    if (typeof navigator.mediaSession === 'undefined' || typeof MediaMetadata === 'undefined') return;
    const track = onDemandTrack || currentTrack || scheduledTrack;
    if (track) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title || 'Radio en vivo',
        artist: track.artist || 'SONORIA FM',
        album: 'SONORIA FM',
        artwork: track.cover_url ? [{ src: track.cover_url, sizes: '512x512', type: 'image/jpeg' }] : [],
      });
    }
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    navigator.mediaSession.setActionHandler('play', () => toggle());
    navigator.mediaSession.setActionHandler('pause', () => toggle());
    return () => {
      navigator.mediaSession.playbackState = 'none';
    };
  }, [currentTrack, scheduledTrack, onDemandTrack, isPlaying, toggle]);

  return (
    <RadioContext.Provider value={{ isPlaying, isLoading, error, toggle, volume, setVolume, currentTrack, scheduledTrack, onDemandTrack, playOnDemand, resumeLive }}>
      {children}
    </RadioContext.Provider>
  );
}

export function useRadio() {
  const ctx = useContext(RadioContext);
  if (!ctx) throw new Error('useRadio must be used within RadioProvider');
  return ctx;
}