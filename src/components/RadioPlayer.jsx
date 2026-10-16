import { useRadio } from '@/lib/radioContext';
import { DEFAULT_COVER } from '@/lib/brand';
import { Play, Pause, Loader2, Volume2, VolumeX, Radio } from 'lucide-react';

export default function RadioPlayer({ nowPlaying }) {
  const { isPlaying, isLoading, error, toggle, volume, setVolume, currentTrack, onDemandTrack, resumeLive } = useRadio();
  const track = onDemandTrack || currentTrack || nowPlaying;

  return (
    <div className="fixed left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-2xl px-1 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] md:bottom-4">
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/80 backdrop-blur-2xl shadow-2xl shadow-primary/10 px-3 py-3 sm:px-4">
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
        </div>

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
          <p className="line-clamp-2 text-sm font-semibold leading-tight">{track?.title ?? 'SONORIA Radio'}</p>
          <p className="line-clamp-2 text-xs text-muted-foreground">{track?.artist ?? 'La radio de la música IA hecha en España'}</p>
        </div>

        <button
          onClick={toggle}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105 active:scale-95"
          aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
        >
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
        </button>

        <div className="hidden sm:flex items-center gap-2">
          <button
            onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Silenciar"
          >
            {volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-20 accent-primary"
            aria-label="Volumen"
          />
        </div>
      </div>
      {error && (
        <p className="mt-1 text-center text-xs text-destructive">No se pudo conectar al stream. Toca reintentar.</p>
      )}
    </div>
  );
}