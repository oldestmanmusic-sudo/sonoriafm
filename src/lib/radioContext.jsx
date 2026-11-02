import { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

// PARRILLA SONORIA FM (hora de Madrid, igual para todos los oyentes):
//   00:00-08:00  Club Electrónico  -> música electrónica
//   08:00-10:00  Pop Rock           -> pop y rock (mejor hora de audiencia de la mañana)
//   10:00-11:00  Baladas            -> género Baladas
//   11:00-12:00  Música en otros idiomas -> canciones con idioma "Otros idiomas"
//   12:00-16:00  Top Sonoria        -> igual que la franja de las 08:00
//   16:00-24:00  Latino Total       -> pop, rock y urbano/reguetón latino
// Es la misma parrilla todos los días de la semana (hoja "Parrilla Sonoria FM").
// Dentro de cada franja, la rotación funciona como se explica a continuación.
//
// RADIO 24H ALEATORIA: la emisión sigue anclada al reloj (hora de Madrid)
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
function buildCycle(list, cycle, prevList) {
  if (cycle < 0) cycle = 0;
  const cached = cycleCache.get(cycle);
  if (cached && cached.list === list && cached.prevList === prevList) return cached.schedule;
  const wrap = (t, fallback) => ({ track: t, dur: parseDuration(t.duration) || fallback });
  // El motor de emisión consume {track, dur}: envolvemos las canciones del
  // barajado con su duración real (o el respaldo de 4 minutos).
  const base = seededShuffle(list, cycle);
  const prevLast = prevList
    ? interleaveArtists(seededShuffle(prevList, cycle - 1)).slice(-1)[0].artist
    : null;
  const schedule = interleaveArtists(base, prevLast).map((t) => wrap(t, FALLBACK_DURATION));
  if (cycleCache.size > 500) cycleCache.clear();
  cycleCache.set(cycle, { list, prevList, schedule });
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
// El índice de vuelta se ancla al día y a la franja (base 100000 por día, 1000 por franja), así el borde entre
// vueltas siempre conecta dos barajados distintos y el bucle es infinito.
const MAX_CYCLES_PER_DAY = 500;

// --- Parrilla por franjas ------------------------------------------------
const PARRILLA_TZ = 'Europe/Madrid';
// Franjas del día (el id solo sirve de semilla del barajado; no cambiarlo).
const SLOTS = [
  { id: 0, start: 0, kind: 'electronic' },        // Club Electrónico 00-08
  { id: 1, start: 8 * 3600, kind: 'poprock' },    // Pop Rock 08-10
  { id: 5, start: 10 * 3600, kind: 'baladas' },   // Baladas 10-11
  { id: 3, start: 11 * 3600, kind: 'idiomas' },   // Música en otros idiomas 11-12
  { id: 4, start: 12 * 3600, kind: 'top' },       // Top Sonoria 12-16
  { id: 2, start: 16 * 3600, kind: 'latino' },    // Latino Total 16-24
];
const ELECTRONIC_GENRES = new Set(['electrónica']);
const LATINO_GENRES = new Set(['pop latino', 'pop rock latino', 'urbano/reguetón']);
const BALADAS_GENRES = new Set(['baladas']);
const POPROCK_GENRES = new Set(['pop rock', 'pop rock latino']);
const TOP_SIZE = 10;

const madridFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: PARRILLA_TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

// Día y segundo del día según el reloj de Madrid (no el del navegador).
function madridClock(nowMs) {
  const p = {};
  for (const part of madridFmt.formatToParts(new Date(nowMs))) p[part.type] = part.value;
  const dayIndex = Math.floor(Date.UTC(+p.year, +p.month - 1, +p.day) / 86400000);
  const frac = (((nowMs % 1000) + 1000) % 1000) / 1000;
  const secondsOfDay = (+p.hour % 24) * 3600 + +p.minute * 60 + +p.second + frac;
  return { dayIndex, secondsOfDay };
}

// Momento (ms) en que se añadió una canción al catálogo (la fecha viene en UTC sin zona).
const createdMs = (t) => {
  const s = String((t && t.created_date) || '');
  if (!s) return 0;
  const ms = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`);
  return Number.isFinite(ms) ? ms : 0;
};

const normGenre = (g) => (g || '').toString().trim().toLowerCase();

// Listas de canciones de cada franja (memoizadas por catálogo). Si una franja
// se queda sin canciones de su estilo, suena todo el catálogo en lugar de silencio.
const slotMemo = new WeakMap();
function slotLists(list) {
  let memo = slotMemo.get(list);
  if (memo) return memo;
  const electronic = list.filter((t) => ELECTRONIC_GENRES.has(normGenre(t.genre)));
  const latino = list.filter((t) => LATINO_GENRES.has(normGenre(t.genre)));
  const poprock = list.filter((t) => POPROCK_GENRES.has(normGenre(t.genre)));
  const baladas = list.filter((t) => BALADAS_GENRES.has(normGenre(t.genre)));
  const idiomas = list.filter((t) => normGenre(t.language) === 'otros idiomas');
  const byLikes = [...list].sort(
    (a, b) => (b.likes || 0) - (a.likes || 0) || String(a.id).localeCompare(String(b.id))
  );
  const top = byLikes.slice(0, TOP_SIZE);
  const topIds = new Set(top.map((t) => t.id));
  const rest = list.filter((t) => !topIds.has(t.id));
  memo = {
    electronic: electronic.length ? electronic : list,
    latino: latino.length ? latino : list,
    poprock, // si no hay pop rock, la franja sigue como Top Sonoria
    baladas, // si no hay baladas, la franja sigue como Top Sonoria
    idiomas, // si no hay canciones en otros idiomas, la franja sigue como Top Sonoria
    top,
    rest,
  };
  slotMemo.set(list, memo);
  return memo;
}

// Lista que se baraja en la vuelta k de una franja. Top Sonoria alterna:
// Top 10, resto del catálogo (variedad), Top 10... así los 10 éxitos suenan el doble.
function cycleList(lists, slot, k) {
  if (slot.kind === 'electronic') return lists.electronic;
  if (slot.kind === 'latino') return lists.latino;
  if (slot.kind === 'poprock' && lists.poprock.length) return lists.poprock;
  if (slot.kind === 'baladas' && lists.baladas.length) return lists.baladas;
  if (slot.kind === 'idiomas' && lists.idiomas.length) return lists.idiomas;
  if (!lists.rest.length) return lists.top;
  return k % 3 === 1 ? lists.rest : lists.top;
}
function legacyFindPosition(list, nowMs) {
  const { dayIndex, secondsOfDay } = madridClock(nowMs);
  const slot = [...SLOTS].reverse().find((sl) => secondsOfDay >= sl.start) || SLOTS[0];
  const secondsInSlot = secondsOfDay - slot.start;
  const lists = slotLists(list);
  // Las canciones nuevas entran en la emisión al EMPEZAR la siguiente vuelta: cada vuelta
  // solo incluye las canciones que ya existían cuando empezó. Así, aprobar una canción
  // no recoloca la emisión que ya está sonando ni corta a nadie a mitad de tema.
  const slotStartMs = nowMs - secondsOfDay * 1000 + slot.start * 1000;
  const cycleFor = (k, acc, prevList) => {
    const raw = cycleList(lists, slot, k);
    const startMs = slotStartMs + acc * 1000;
    let cl = raw.filter((t) => createdMs(t) <= startMs);
    if (!cl.length) cl = raw;
    return { cl, schedule: buildCycle(cl, dayIndex * 100000 + slot.id * 1000 + k, prevList) };
  };
  let acc = 0;
  let prevList = null;
  for (let k = 0; k < MAX_CYCLES_PER_DAY; k++) {
    const built = cycleFor(k, acc, prevList);
    const schedule = built.schedule;
    prevList = built.cl;
    const len = schedule.reduce((sum, item) => sum + item.dur, 0) || FALLBACK_DURATION;
    if (secondsInSlot < acc + len) {
      let t = secondsInSlot - acc;
      for (let i = 0; i < schedule.length; i++) {
        if (t < schedule[i].dur) return { schedule, index: i, offset: t };
        t -= schedule[i].dur;
      }
      return { schedule, index: 0, offset: 0 };
    }
    acc += len;
  }
  return { schedule: cycleFor(0, 0, null).schedule, index: 0, offset: 0 };
}

// --- Cola de emisión del servidor (RadioQueue) ---------------------------
// El servidor mantiene la lista de canciones con su inicio y fin exactos: cada una empieza
// cuando acaba la anterior y el cambio de franja ocurre al terminar la canción en curso
// (nunca se corta ni se solapa nada). Si la cola no está disponible, se usa el cálculo
// antiguo por reloj.
const queueState = { entries: [], clockOffset: 0, version: 0, mapped: null, mappedVersion: -1, loadedAt: 0 };

async function loadQueue() {
  try {
    const t0 = Date.now();
    const res = await base44.functions.invoke('radioNow', { count: 40, backMs: 10 * 60 * 1000 });
    const t1 = Date.now();
    const data = res && res.data ? res.data : res;
    const tracks = data && Array.isArray(data.tracks) ? data.tracks : [];
    if (!tracks.length || !data.serverTime) return false;
    queueState.clockOffset = data.serverTime - (t0 + t1) / 2;
    queueState.entries = tracks.filter((e) => e && e.audio_url && e.endsAt > e.startsAt);
    queueState.version += 1;
    queueState.loadedAt = Date.now();
    return queueState.entries.length > 0;
  } catch {
    return false;
  }
}

function findPosition(list, nowMs) {
  const q = queueState.entries;
  if (q.length) {
    const t = nowMs + queueState.clockOffset;
    let i = q.findIndex((e) => t >= e.startsAt && t < e.endsAt);
    if (i >= 0) {
      if (queueState.mappedVersion !== queueState.version || queueState.mappedList !== list) {
        const byId = new Map((list || []).map((tr) => [String(tr.id), tr]));
        queueState.mapped = q.map((e) => ({
          track: byId.get(String(e.id)) || { ...e, id: e.id },
          dur: (e.endsAt - e.startsAt) / 1000,
        }));
        queueState.mappedVersion = queueState.version;
        queueState.mappedList = list;
      }
      return { schedule: queueState.mapped, index: i, offset: (t - q[i].startsAt) / 1000 };
    }
  }
  return legacyFindPosition(list, nowMs);
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
  // Precarga de la siguiente canción: al terminar una, la siguiente ya está en caché
  // y entra sin el hueco de silencio de la descarga.
  const prefetchRef = useRef(null);

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
      // Si mientras carga se elige otra canción (a la carta) o se cambia de modo,
      // este arranque ya no es válido: no debe tocar la posición del audio nuevo.
      const ep = epochRef.current;
      const settle = (applyOffset) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        audio.removeEventListener('loadedmetadata', onMeta);
        if (applyOffset && epochRef.current === ep) {
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
      // Otra reproducción (canción a la carta, volver a la radio) tomó el audio
      // mientras cargaba esta: se abandona sin tocar nada para no pisarla.
      if (epochRef.current !== myEpoch) { inFlightRef.current = false; return; }
      try {
        await audio.play();
        if (epochRef.current !== myEpoch) { inFlightRef.current = false; return; }
        currentRef.current = item.track;
        setCurrentTrack(item.track);
        announcePlay();
        setIsLoading(false);
        inFlightRef.current = false;
        try {
          const nx = schedule[(index + step + 1) % schedule.length];
          const nxUrl = nx && nx.track && nx.track.audio_url;
          if (prefetchRef.current) { prefetchRef.current.src = ''; prefetchRef.current = null; }
          // Los WAV pesan decenas de MB: no se precargan.
          if (nxUrl && !/\.wav(\?|$)/i.test(nxUrl) && nx.track.id !== item.track.id) {
            const pf = new Audio();
            pf.preload = 'auto';
            pf.src = nxUrl;
            prefetchRef.current = pf;
          }
        } catch { /* la precarga es opcional */ }
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
  const playScheduled = useCallback(async () => {
    if (!playlistRef.current.length) {
      setIsLoading(false);
      setError(true);
      return;
    }
    // Cola del servidor al día (máx. 4 s de espera; si falla, reloj local).
    if (Date.now() - queueState.loadedAt > 30000) {
      await Promise.race([loadQueue(), new Promise((r) => setTimeout(r, 4000))]);
    }
    const { schedule, index, offset } = findPosition(playlistRef.current, Date.now());
    enter(schedule, index, offset);
  }, [enter]);

  // Refresco de la cola cada minuto (siempre hay ~2 h por delante en el servidor).
  useEffect(() => {
    loadQueue();
    const timer = setInterval(loadQueue, 60000);
    return () => clearInterval(timer);
  }, []);

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
    const curId = currentRef.current?.id;
    if (schedule[start] && schedule[start].track.id === curId) {
      start = (start + 1) % schedule.length;
      startOffset = 0;
    } else if (curId && offset > 0 && offset <= 20) {
      // La canción terminó de forma natural y el reloj ya entró unos segundos en la
      // siguiente (la carga de cada tema retrasa al oyente). Si esa siguiente es la
      // que viene justo después de la que sonaba, se empieza desde el principio:
      // así no se come la intro. El control de sincronía de 20 s tolera este desfase.
      const before = findPosition(playlistRef.current, Date.now() - (offset + 0.5) * 1000);
      if (before.schedule[before.index] && before.schedule[before.index].track.id === curId) {
        startOffset = 0;
      }
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
      const now = Date.now();
      const { schedule, index, offset } = findPosition(playlistRef.current, now);
      const item = schedule[index];
      const curId = currentRef.current.id;
      // Cada canción dura en el reloj unos decimales más de lo que suena de verdad
      // (la duración se guarda redondeada hacia arriba), así que el oyente va
      // siempre unos segundos por delante del reloj. Antes, en cuanto el reloj
      // seguía en la canción anterior, se le devolvía al final de esa canción
      // (se enganchaban el final de una y el principio de la siguiente). Ahora
      // se busca si lo que suena corresponde a la emisión con un desfase
      // razonable (hasta 90 s por delante o 45 s por detrás) y solo se corta
      // si de verdad está descolgado.
      const cur = audio.currentTime;
      for (let dt = -45; dt <= 90; dt += 3) {
        const p = findPosition(playlistRef.current, now + dt * 1000);
        if (p.schedule[p.index].track.id === curId && Math.abs(p.offset - cur) <= 4) return;
      }
      if (item.track.id !== curId) {
        enter(schedule, index, offset);
        return;
      }
      if (Math.abs(cur - offset) > 45) {
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