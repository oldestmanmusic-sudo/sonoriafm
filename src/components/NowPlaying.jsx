import { useRadio } from '@/lib/radioContext';
import { Play, Pause, Loader2 } from 'lucide-react';

export default function NowPlaying({ track }) {
  const { isPlaying, isLoading, toggle } = useRadio();
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-primary/30 blur-[120px]" />
        <div className="absolute top-20 right-10 h-72 w-72 rounded-full bg-accent/20 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 pt-16 pb-20 sm:pt-24 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-accent pulse-live" /> En vivo 24/7
        </span>

        <h1 className="mt-6 font-heading text-6xl sm:text-8xl font-extrabold tracking-tighter text-glow">
          SONO<span className="text-primary">RIA</span>
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">Estación de música variada · En vivo desde cualquier lugar</p>

        <button
          onClick={toggle}
          className="mt-10 inline-flex items-center gap-3 rounded-full bg-primary px-8 py-4 text-base font-semibold text-primary-foreground shadow-2xl shadow-primary/40 transition-transform hover:scale-105 active:scale-95"
        >
          {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
          {isLoading ? 'Conectando…' : isPlaying ? 'Pausar' : 'Escuchar ahora'}
        </button>

        {track && (
          <div className="mx-auto mt-12 flex max-w-md items-center gap-4 rounded-2xl border border-border bg-card/60 backdrop-blur p-4 text-left">
            <div className="h-16 w-16 overflow-hidden rounded-xl bg-secondary shrink-0">
              {track.cover_url ? (
                <img src={track.cover_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-primary/40 to-accent/30" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-accent">Sonando ahora</p>
              <p className="truncate font-semibold">{track.title}</p>
              <p className="truncate text-sm text-muted-foreground">{track.artist}</p>
            </div>
          </div>
        )}

        <div className="mt-10 flex items-end justify-center gap-1 h-16">
          {Array.from({ length: 32 }).map((_, i) => (
            <span
              key={i}
              className="eq-bar w-1 rounded-full bg-gradient-to-t from-primary to-accent"
              style={{
                height: '100%',
                animationDelay: `${i * 60}ms`,
                animationDuration: `${1 + (i % 4) * 0.25}s`,
                opacity: isPlaying ? 1 : 0.35,
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}