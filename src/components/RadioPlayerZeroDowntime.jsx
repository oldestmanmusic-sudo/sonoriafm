import { useEffect, useRef, useState, useCallback } from 'react';
import { useRadio } from '@/lib/radioContext';
import { useTrackLike } from '@/lib/useTrackLike';
import { DEFAULT_COVER } from '@/lib/brand';
import { Radio, Heart, Loader2, Wifi, WifiOff, Zap, Shield } from 'lucide-react';
import Hls from 'hls.js';

/**
 * RadioPlayerZeroDowntime - Player con failover automático entre múltiples fuentes
 *
 * Fuentes (en orden de prioridad):
 * 1. Tu Backend HLS (primario) - http://localhost:8000/stream/playlist.m3u8
 * 2. Base44 HLS (fallback) - cuando Base44 lo tenga implementado
 * 3. Direct Audio (último recurso) - URLs directas de Supabase/S3
 *
 * Failover transparente: mismo horario determinista = mismo offset en todas las fuentes
 */
export default function RadioPlayerZeroDowntime({ nowPlaying }) {
  const {
    isPlaying,
    error: radioError,
    currentTrack,
    scheduledTrack,
    onDemandTrack,
    resumeLive,
    toggle,
    volume,
    setVolume,
    playOnDemand
  } = useRadio();

  const track = onDemandTrack || currentTrack || scheduledTrack || nowPlaying;
  const { likes, liked, liking, like } = useTrackLike(track?.id, track?.likes);

  // ===== FAILOVER STATE =====
  const [sourceStatus, setSourceStatus] = useState({
    primary: 'checking',    // 'healthy' | 'degraded' | 'failed' | 'checking'
    fallback: 'unknown',    // Base44 HLS
    direct: 'unknown'       // Direct audio
  });
  const [activeSource, setActiveSource] = useState('primary'); // 'primary' | 'fallback' | 'direct'
  const [hlsError, setHlsError] = useState(null);
  const [showSourceIndicator, setShowSourceIndicator] = useState(false);

  // ===== REFS =====
  const audioRef = useRef(null);
  const hlsRef = useRef(null);
  const healthCheckIntervalRef = useRef(null);
  const failoverInProgressRef = useRef(false);
  const lastHealthCheckRef = useRef(0);
  const currentScheduleOffsetRef = useRef(0); // Offset en segundos dentro del horario

  // Configuración de fuentes (orden de prioridad)
  const sources = [
    {
      id: 'primary',
      name: 'Tu Backend',
      icon: Zap,
      getHlsUrl: () => 'http://localhost:8000/stream/playlist.m3u8',
      getDirectUrl: (t) => t?.audio_url,
      healthEndpoint: 'http://localhost:8000/health',
      color: 'text-green-400'
    },
    {
      id: 'fallback',
      name: 'Base44',
      icon: Shield,
      getHlsUrl: () => '/api/stream/playlist.m3u8', // Cuando Base44 lo implemente
      getDirectUrl: (t) => t?.audio_url,
      healthEndpoint: '/api/health',
      color: 'text-blue-400'
    },
    {
      id: 'direct',
      name: 'Directo (Supabase/S3)',
      icon: Wifi,
      getHlsUrl: () => null, // No HLS para directo
      getDirectUrl: (t) => t?.audio_url,
      healthEndpoint: null,
      color: 'text-amber-400'
    }
  ];

  // ===== HLS INITIALIZATION =====
  const initializeHls = useCallback((sourceId) => {
    const source = sources.find(s => s.id === sourceId);
    if (!source) return false;

    const audio = audioRef.current;
    if (!audio) return false;

    // Cleanup previous HLS
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const hlsUrl = source.getHlsUrl();
    if (!hlsUrl || !Hls.isSupported()) {
      return false;
    }

    try {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        maxBufferSize: 60 * 1000 * 1000,
        maxBufferHole: 0.5,
        highBufferWatchdogPeriod: 3,
        nudgeOffset: 0.1,
        nudgeMaxRetry: 3,
        maxFragLookUpTolerance: 0.25,
        manifestLoadingTimeOut: 10000,
        manifestLoadingMaxRetry: 3,
        manifestLoadingRetryDelay: 1000,
        levelLoadingTimeOut: 10000,
        levelLoadingMaxRetry: 4,
        levelLoadingRetryDelay: 1000,
        fragLoadingTimeOut: 20000,
        fragLoadingMaxRetry: 6,
        fragLoadingRetryDelay: 1000,
        fragLoadingLoopThreshold: 3,
        startLevel: -1,
        capLevelToPlayerSize: true,
        startFragPrefetch: true,
        appendErrorMaxRetry: 3
      });

      hlsRef.current = hls;

      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        hls.loadSource(hlsUrl);
      });

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        // Seek to current schedule offset if we have one
        if (currentScheduleOffsetRef.current > 0 && audio.duration) {
          const seekTime = Math.min(currentScheduleOffsetRef.current, audio.duration - 1);
          audio.currentTime = seekTime;
        }
        audio.play().catch(() => {
          // Autoplay blocked - user will need to click play
        });
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn(`[HLS] Network error on ${sourceId}, attempting recovery...`);
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn(`[HLS] Media error on ${sourceId}, recovering...`);
              hls.recoverMediaError();
              break;
            default:
              console.error(`[HLS] Fatal error on ${sourceId}:`, data);
              triggerFailover(sourceId);
              break;
          }
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          // Non-fatal media errors - just log
          console.debug(`[HLS] Non-fatal media error:`, data.details);
        }
      });

      hls.on(Hls.Events.FRAG_LOAD_EMERGENCY_ABORTED, () => {
        console.warn(`[HLS] Fragment load aborted on ${sourceId}`);
      });

      hls.attachMedia(audio);
      return true;
    } catch (err) {
      console.error(`[HLS] Failed to initialize ${sourceId}:`, err);
      return false;
    }
  }, []);

  // ===== DIRECT AUDIO (no HLS) =====
  const playDirectAudio = useCallback((track) => {
    const audio = audioRef.current;
    if (!audio || !track?.audio_url) return false;

    // Cleanup HLS
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    audio.src = track.audio_url;
    audio.load();

    // Seek to schedule offset if available
    if (currentScheduleOffsetRef.current > 0) {
      audio.addEventListener('loadedmetadata', () => {
        if (audio.duration) {
          audio.currentTime = Math.min(currentScheduleOffsetRef.current, audio.duration - 1);
        }
      }, { once: true });
    }

    audio.play().catch(() => {
      // Autoplay blocked
    });

    return true;
  }, []);

  // ===== FAILOVER LOGIC =====
  const triggerFailover = useCallback(async (failedSourceId) => {
    if (failoverInProgressRef.current) return;
    failoverInProgressRef.current = true;

    console.log(`[Failover] ${failedSourceId} failed, searching for healthy source...`);

    // Mark failed source
    setSourceStatus(prev => ({
      ...prev,
      [failedSourceId]: 'failed'
    }));

    // Find next healthy source
    const currentIndex = sources.findIndex(s => s.id === activeSource);
    const availableSources = sources.slice(currentIndex + 1);

    for (const source of availableSources) {
      if (source.id === 'direct') {
        // Direct audio doesn't need health check, just try to play
        if (track?.audio_url) {
          console.log(`[Failover] Switching to ${source.name} (direct audio)`);
          setActiveSource(source.id);
          setSourceStatus(prev => ({ ...prev, [source.id]: 'healthy' }));
          playDirectAudio(track);
          failoverInProgressRef.current = false;
          return;
        }
      } else {
        // Try HLS source
        const healthy = await checkSourceHealth(source);
        if (healthy) {
          console.log(`[Failover] Switching to ${source.name} (HLS)`);
          setActiveSource(source.id);
          setSourceStatus(prev => ({ ...prev, [source.id]: 'healthy' }));
          initializeHls(source.id);
          failoverInProgressRef.current = false;
          return;
        }
      }
    }

    // No healthy sources found
    console.error('[Failover] No healthy sources available!');
    setSourceStatus(prev => ({ ...prev, [activeSource]: 'failed' }));
    failoverInProgressRef.current = false;
  }, [activeSource, track]);

  // ===== HEALTH CHECK =====
  const checkSourceHealth = useCallback(async (source) => {
    if (!source.healthEndpoint) return false;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(source.healthEndpoint, {
        signal: controller.signal,
        cache: 'no-cache'
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        return data.status === 'ok' && data.database === 'connected';
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const runHealthChecks = useCallback(async () => {
    if (failoverInProgressRef.current) return;

    const now = Date.now();
    lastHealthCheckRef.current = now;

    // Check all sources
    for (const source of sources) {
      if (source.id === 'direct') continue; // Direct audio doesn't have health endpoint

      const healthy = await checkSourceHealth(source);
      const wasHealthy = sourceStatus[source.id] === 'healthy';
      const isHealthy = healthy;

      setSourceStatus(prev => ({
        ...prev,
        [source.id]: isHealthy ? 'healthy' : (wasHealthy ? 'degraded' : 'failed')
      }));

      // If current active source became unhealthy, trigger failover
      if (source.id === activeSource && !isHealthy && wasHealthy) {
        console.warn(`[Health] Active source ${source.id} became unhealthy`);
        triggerFailover(source.id);
      }

      // If a previously failed source recovered and is higher priority, consider switching back
      if (isHealthy && !wasHealthy) {
        const sourcePriority = sources.findIndex(s => s.id === source.id);
        const activePriority = sources.findIndex(s => s.id === activeSource);
        if (sourcePriority < activePriority) {
          console.log(`[Health] Higher priority source ${source.id} recovered, switching back`);
          setActiveSource(source.id);
          if (source.id !== 'direct') {
            initializeHls(source.id);
          } else if (track?.audio_url) {
            playDirectAudio(track);
          }
        }
      }
    }
  }, [activeSource, sourceStatus, track]);

  // ===== SCHEDULE OFFSET TRACKING =====
  const updateScheduleOffset = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;

    // Get current position in the schedule
    // This would come from your radioContext's scheduledTrack timing
    // For now, we track the current playback position
    currentScheduleOffsetRef.current = audio.currentTime;
  }, []);

  // ===== EFFECTS =====
  // Initialize audio element
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'none';
    audio.volume = volume;
    audio.crossOrigin = 'anonymous';
    audioRef.current = audio;

    const handleEnded = () => {
      // RadioContext handles advance via onEnded
    };

    const handleError = () => {
      console.error('[Audio] Error event:', audio.error);
      if (activeSource !== 'direct') {
        triggerFailover(activeSource);
      }
    };

    const handleWaiting = () => {
      // Buffering - could indicate source issues
    };

    const handleStalled = () => {
      // Stalled - could indicate source issues
    };

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('stalled', handleStalled);

    // Initial health check
    runHealthChecks();

    // Periodic health checks
    healthCheckIntervalRef.current = setInterval(runHealthChecks, 10000);

    // Schedule offset tracking
    const offsetInterval = setInterval(updateScheduleOffset, 1000);

    // Try initial source
    if (track?.audio_url) {
      const primarySource = sources[0];
      const hlsInitialized = initializeHls(primarySource.id);
      if (!hlsInitialized && track.audio_url) {
        playDirectAudio(track);
      }
    }

    return () => {
      clearInterval(healthCheckIntervalRef.current);
      clearInterval(offsetInterval);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('stalled', handleStalled);
      audio.pause();
      audio.src = '';
    };
  }, [volume, activeSource, track?.audio_url, sourceStatus]);

  // Volume sync
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // ===== UI HELPERS =====
  const getCurrentSourceInfo = () => {
    return sources.find(s => s.id === activeSource) || sources[0];
  };

  const getSourceStatusIcon = (sourceId) => {
    const status = sourceStatus[sourceId];
    switch (status) {
      case 'healthy': return <Wifi className="w-4 h-4 text-green-400" />;
      case 'degraded': return <Wifi className="w-4 h-4 text-amber-400" />;
      case 'failed': return <WifiOff className="w-4 h-4 text-red-400" />;
      default: return <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />;
    }
  };

  // ===== RENDER =====
  const currentSource = getCurrentSourceInfo();

  return (
    <div className="fixed left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-2xl px-1 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] md:bottom-4">
      {/* Main Player Card */}
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/80 backdrop-blur-2xl shadow-2xl shadow-primary/10 px-3 py-3 sm:px-4">
        {/* Album Art */}
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-secondary">
          <img src={track?.cover_url || DEFAULT_COVER} alt="" className="h-full w-full object-cover" />
          {isPlaying && (
            <div className="absolute inset-0 flex items-end justify-center gap-0.5 bg-black/40 p-2">
              <span className="eq-bar w-0.5 h-3 bg-accent" style={{ animationDelay: '0ms' }} />
              <span className="eq-bar w-0.5 h-3 bg-accent" style={{ animationDelay: '150ms' }} />
              <span className="eq-bar w-0.5 h-3 bg-accent" style={{ animationDelay: '300ms' }} />
              <span className="eq-bar w-0.5 h-3 bg-accent" style={{ animationDelay: '450ms' }} />
            </div>
          )}
          {/* Source indicator overlay */}
          {showSourceIndicator && (
            <div className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-t from-black/60 to-transparent flex items-end justify-center px-1">
              <span className="text-[8px] font-bold uppercase tracking-wider text-white drop-shadow">
                {currentSource.name}
              </span>
            </div>
          )}
        </div>

        {/* Track Info */}
        <div className="min-w-0 flex-1">
          {onDemandTrack ? (
            <button
              onClick={resumeLive}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-accent/50 bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent transition-colors hover:bg-accent/20"
            >
              <Radio className="h-3 w-3 shrink-0" /> <span className="truncate">Volver a la radio en vivo</span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent pulse-live" /> En vivo
            </span>
          )}
          <p className="line-clamp-2 text-sm font-semibold leading-tight">{track?.title ?? 'SONORIA FM'}</p>
          <p className="line-clamp-2 text-xs text-muted-foreground">{track?.artist ?? 'La radio de la música hecha con IA'}</p>
        </div>

        {/* Like Button */}
        {track?.id && (
          <button
            onClick={like}
            disabled={liking}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-accent/50 hover:text-accent disabled:opacity-50"
            aria-label={liked ? 'Ya te gusta esta canción' : 'Me gusta esta canción'}
            aria-pressed={liked}
          >
            {liking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className={`h-4 w-4 text-accent ${liked ? 'fill-accent' : ''}`} />}
            {likes}
          </button>
        )}

        {/* Source Status Indicator */}
        <button
          onClick={() => setShowSourceIndicator(!showSourceIndicator)}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:border-accent/50 hover:text-accent"
          title="Fuente de audio actual"
        >
          <currentSource.icon className={`h-3 w-3 ${currentSource.color}`} />
          <span className="hidden sm:inline">{currentSource.name}</span>
          {getSourceStatusIcon(activeSource)}
        </button>
      </div>

      {/* Source Status Panel */}
      {showSourceIndicator && (
        <div className="mt-2 px-1">
          <div className="rounded-xl border border-border bg-card/80 backdrop-blur-2xl shadow-xl p-3 text-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold">Estado de fuentes</span>
              <button onClick={() => setShowSourceIndicator(false)} className="text-muted-foreground hover:text-foreground">×</button>
            </div>
            <div className="space-y-1.5">
              {sources.map(source => (
                <div key={source.id} className="flex items-center gap-2 p-1.5 rounded-lg bg-background/50">
                  <source.icon className={`h-3 w-3 ${source.color}`} />
                  <span className="font-medium text-[11px] flex-1">{source.name}</span>
                  {getSourceStatusIcon(source.id)}
                  {source.id === activeSource && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/20 text-primary">ACTIVO</span>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-border flex items-center gap-2">
              <button
                onClick={() => runHealthChecks()}
                disabled={failoverInProgressRef.current}
                className="flex-1 py-1.5 px-2 text-xs font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50"
              >
                {failoverInProgressRef.current ? 'Comprobando...' : 'Revisar ahora'}
              </button>
              <button
                onClick={() => triggerFailover(activeSource)}
                className="flex-1 py-1.5 px-2 text-xs font-medium rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20"
              >
                Forzar cambio
              </button>
            </div>
          </div>
        )}

      {/* Error Message */}
      {(radioError || hlsError) && (
        <div className="mt-1 text-center text-xs text-destructive flex items-center justify-center gap-1">
          <WifiOff className="h-3 w-3" />
          <span>{radioError || hlsError || 'Error de conexión. Reintentando...'}</span>
        </div>
      )}
    </div>
  );
}

export default RadioPlayerZeroDowntime;