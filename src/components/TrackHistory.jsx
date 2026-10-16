import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { DEFAULT_COVER } from '@/lib/brand';
import { Image } from '@/components/ui/image';
import { Loader2, History } from 'lucide-react';

function formatTime(d) {
  try {
    return new Date(d).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function TrackHistory({ genre = 'Todo SONORIA' }) {
  const [tracks, setTracks] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const query = genre && genre !== 'Todo SONORIA' ? { genre } : {};
        const { items } = await base44.entities.Track.filter(query, { sort: '-played_at', limit: 12 });
        if (active) setTracks(items);
      } catch {
        if (active) setTracks([]);
      }
    })();
    return () => { active = false; };
  }, [genre]);

  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex items-center gap-2 mb-6">
        <History className="h-5 w-5 text-primary" />
        <h2 className="font-heading text-2xl font-bold">
          {genre && genre !== 'Todo SONORIA' ? `Canal ${genre}` : 'Historial musical'}
        </h2>
      </div>

      {tracks === null ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : tracks.length === 0 ? (
        <p className="text-muted-foreground">Todavía no hay canciones en este canal.</p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x no-scrollbar">
          {tracks.map((t) => (
            <Link key={t.id} to={`/cancion/${t.id}`} className="snap-start shrink-0 w-40 group">
              <div className="relative aspect-square overflow-hidden rounded-2xl bg-secondary">
                <Image
                  src={t.cover_url || DEFAULT_COVER}
                  alt={t.title}
                  className="h-full w-full transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug">{t.title}</p>
              <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">{t.artist}</p>
              {t.played_at && <p className="text-[11px] text-muted-foreground/70">{formatTime(t.played_at)}</p>}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}