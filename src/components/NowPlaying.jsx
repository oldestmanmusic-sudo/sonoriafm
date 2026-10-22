import { useRadio } from '@/lib/radioContext';
import { Link } from 'react-router-dom';
import { useTrackLike } from '@/lib/useTrackLike';
import { Loader2, Upload, Heart } from 'lucide-react';

export default function NowPlaying({ track, sideLeft = null }) {
  const { isPlaying, currentTrack, scheduledTrack, onDemandTrack } = useRadio();
  // Misma canción que muestra el banner inferior (reproducción a la carta o en vivo).
  const liveTrack = onDemandTrack || currentTrack || scheduledTrack || track;
  const { likes, liked, liking, like } = useTrackLike(liveTrack?.id, liveTrack?.likes);
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-primary/30 blur-[120px]" />
        <div className="absolute top-20 right-10 h-72 w-72 rounded-full bg-accent/20 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 pt-16 pb-20 sm:pt-24 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)_17rem] lg:gap-6 lg:items-start">
        <div className="hidden lg:block">{sideLeft}</div>
        <div className="min-w-0 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-accent pulse-live" /> En vivo 24/7
        </span>

        <h1 className="mt-6 font-heading text-6xl sm:text-8xl lg:text-7xl xl:text-8xl font-extrabold tracking-tighter text-glow">
          SONOR<span className="text-primary">IA</span> FM
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">La radio de la música hecha con IA. Música en español, artistas de todo el mundo, las 24 horas.</p>

        <div className="mt-10 flex justify-center">
          <Link
            to="/envia-tu-cancion"
            className="inline-flex items-center gap-2 rounded-full border border-primary/50 px-8 py-4 text-base font-semibold text-primary transition-colors hover:bg-primary/10">
            
            <Upload className="h-5 w-5" /> Envía tu canción
          </Link>
        </div>

        <div className="mt-3">
          <Link
            to="/donar"
            className="inline-flex items-center gap-2 rounded-full border border-accent/50 px-6 py-3 text-sm font-semibold text-accent transition-colors hover:bg-accent/10">
            
            <Heart className="h-4 w-4" /> Apóyanos con una donación
          </Link>
        </div>

        {liveTrack &&
        <div className="mx-auto mt-12 flex max-w-md items-center gap-4 rounded-2xl border border-border bg-card/60 backdrop-blur p-4 text-left">
            <div className="h-16 w-16 overflow-hidden rounded-xl bg-secondary shrink-0">
              {liveTrack.cover_url ?
            <img src={liveTrack.cover_url} alt="" className="h-full w-full object-cover" /> :

            <div className="h-full w-full bg-gradient-to-br from-primary/40 to-accent/30" />
            }
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wider text-accent">Sonando ahora</p>
              <p className="truncate font-semibold">{liveTrack.title}</p>
              <p className="truncate text-sm text-muted-foreground">{liveTrack.artist}</p>
            </div>
            <button
            onClick={like}
            disabled={liking}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-accent/50 hover:text-accent disabled:opacity-50"
            aria-label={liked ? 'Ya te gusta esta canción' : 'Me gusta esta canción'}
            aria-pressed={liked}>
            
              {liking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className={`h-4 w-4 text-accent ${liked ? 'fill-accent' : ''}`} />}
              {likes}
            </button>
          </div>
        }

        <div className="mt-10 flex items-end justify-center gap-1 h-16">
          {Array.from({ length: 32 }).map((_, i) =>
          <span
            key={i}
            className="eq-bar w-1 rounded-full bg-gradient-to-t from-primary to-accent"
            style={{
              height: '100%',
              animationDelay: `${i * 60}ms`,
              animationDuration: `${1 + i % 4 * 0.25}s`,
              opacity: isPlaying ? 1 : 0.35
            }} />

          )}
        </div>
        </div>
        <div className="hidden lg:block" aria-hidden />
      </div>
    </section>);

}