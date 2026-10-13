import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, History } from 'lucide-react';

function formatTime(d) {
  try {
    return new Date(d).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function TrackHistory() {
  const [tracks, setTracks] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { items } = await base44.entities.Track.filter({}, { sort: '-played_at', limit: 12 });
        if (active) setTracks(items);
      } catch {
        if (active) setTracks([]);
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex items-center gap-2 mb-6">
        <History className="h-5 w-5 text-primary" />
        <h2 className="font-heading text-2xl font-bold">Historial musical</h2>
      </div>

      {tracks === null ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : tracks.length === 0 ? (
        <p className="text-muted-foreground">El historial aparecerá cuando la emisora actualice la información.</p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x no-scrollbar">
          {tracks.map((t) => (
            <article key={t.id} className="snap-start shrink-0 w-40 group">
              <div className="relative aspect-square overflow-hidden rounded-2xl bg-secondary">
                {t.cover_url ? (
                  <img src={t.cover_url} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-primary/30 to-accent/20" />
                )}
              </div>
              <p className="mt-2 truncate text-sm font-semibold">{t.title}</p>
              <p className="truncate text-xs text-muted-foreground">{t.artist}</p>
              {t.played_at && <p className="text-[11px] text-muted-foreground/70">{formatTime(t.played_at)}</p>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}