import { Link } from 'react-router-dom';
import { useRadio } from '@/lib/radioContext';
import { DEFAULT_COVER } from '@/lib/brand';
import { Trophy, Heart, Play, Pause, Loader2 } from 'lucide-react';

export default function TopTen({ tracks, className = '' }) {
  const { onDemandTrack, isPlaying, isLoading, playOnDemand, toggle } = useRadio();

  const play = (e, t) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDemandTrack?.id === t.id && isPlaying) toggle();
    else playOnDemand(t);
  };

  return (
    <aside className={`rounded-2xl border border-border bg-card/60 backdrop-blur p-4 text-left ${className}`}>
      <div className="mb-3 flex items-center gap-2">
        <Trophy className="h-5 w-5 text-accent" />
        <h2 className="font-heading text-lg font-bold uppercase tracking-wider">
          TOP <span className="text-primary">10</span>
        </h2>
      </div>

      {tracks === null ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : tracks.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay canciones en el ranking.</p>
      ) : (
        <ol className="space-y-1">
          {tracks.map((t, i) => {
            const active = onDemandTrack?.id === t.id;
            return (
              <li key={t.id}>
                <Link
                  to={`/cancion/${t.id}`}
                  className="group flex items-center gap-3 rounded-xl p-1.5 transition-colors hover:bg-secondary/60"
                >
                  <span
                    className={`w-5 shrink-0 text-center font-heading text-sm font-extrabold ${
                      i < 3 ? 'text-accent' : 'text-muted-foreground'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-secondary">
                    <img src={t.cover_url || DEFAULT_COVER} alt="" className="h-full w-full object-cover" loading="lazy" />
                    <button
                      onClick={(e) => play(e, t)}
                      className={`absolute inset-0 flex items-center justify-center bg-black/55 text-white transition-opacity ${
                        active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
                      }`}
                      aria-label={active && isPlaying ? `Pausar ${t.title}` : `Reproducir ${t.title}`}
                    >
                      {active && isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : active && isPlaying ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4 ml-0.5" />
                      )}
                    </button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold leading-tight">{t.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{t.artist}</p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-muted-foreground">
                    <Heart className="h-3.5 w-3.5 text-accent" />
                    {t.likes ?? 0}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
}
