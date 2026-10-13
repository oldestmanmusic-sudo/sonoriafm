import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import NowPlaying from '@/components/NowPlaying';
import TrackHistory from '@/components/TrackHistory';
import ArtistCard from '@/components/ArtistCard';
import { ArrowRight, Loader2 } from 'lucide-react';

export default function Home() {
  const [nowPlaying, setNowPlaying] = useState(null);
  const [artists, setArtists] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [trackRes, artistRes] = await Promise.all([
          base44.entities.Track.filter({}, { sort: '-played_at', limit: 1 }),
          base44.entities.Artist.filter({}, { sort: '-likes', limit: 4 }),
        ]);
        if (!active) return;
        if (trackRes.items.length) setNowPlaying(trackRes.items[0]);
        setArtists(artistRes.items);
      } catch {
        if (active) setArtists([]);
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <>
      <NowPlaying track={nowPlaying} />
      <TrackHistory />

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="font-heading text-2xl font-bold">Artistas destacados</h2>
            <p className="text-muted-foreground text-sm">Voces y sonidos que suenan en SONORIA</p>
          </div>
          <Link to="/artistas" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Ver todos <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {artists === null ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : artists.length === 0 ? (
          <p className="text-muted-foreground">Pronto destacaremos aquí a nuestros artistas.</p>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {artists.map((a) => (
              <ArtistCard key={a.id} artist={a} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}