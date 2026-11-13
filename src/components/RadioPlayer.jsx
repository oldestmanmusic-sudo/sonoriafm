import { useLocation } from 'react-router-dom';
import { useRadio } from '@/lib/radioContext';
import { useTrackLike } from '@/lib/useTrackLike';
import { DEFAULT_COVER } from '@/lib/brand';
import { Radio, Heart, Loader2 } from 'lucide-react';

export default function RadioPlayer({ nowPlaying }) {
  const { isPlaying, error, currentTrack, scheduledTrack, onDemandTrack, resumeLive } = useRadio();
  // Misma canción en portada y banner: la de la emisión según el reloj.
  const track = onDemandTrack || currentTrack || scheduledTrack || nowPlaying;
  const { likes, liked, liking, like } = useTrackLike(track?.id, track?.likes);
  const { pathname } = useLocation();
  // En la portada ya está la tarjeta «Ahora suena»: no se repite el banner.
  if (pathname === '/') return null;

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
          <p className="line-clamp-2 text-sm font-semibold leading-tight">{track?.title ?? 'SONORIA FM'}</p>
          <p className="line-clamp-2 text-xs text-muted-foreground">{track?.artist ?? 'La radio de la música hecha con IA'}</p>
        </div>

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
      </div>
      {error && !isPlaying && (
        <p className="mt-1 text-center text-xs text-destructive">No se pudo conectar con la radio. Reintentando…</p>
      )}
    </div>
  );
}