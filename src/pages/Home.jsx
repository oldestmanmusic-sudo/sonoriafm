import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import PullToRefresh from '@/components/PullToRefresh';
import NowPlaying from '@/components/NowPlaying';
import GenreChips from '@/components/GenreChips';
import TrackHistory from '@/components/TrackHistory';
import ArtistCard from '@/components/ArtistCard';
import { ArrowRight, Loader2 } from 'lucide-react';

export default function Home() {
  const [nowPlaying, setNowPlaying] = useState(null);
  const [artists, setArtists] = useState(null);
  const [genre, setGenre] = useState('Todo SONORIA');
  const [refreshKey, setRefreshKey] = useState(0);
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    return () => { activeRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    try {
      const [trackRes, artistRes] = await Promise.all([
        base44.entities.Track.filter({}, { sort: '-played_at', limit: 1 }),
        base44.entities.Artist.filter({ name: { $ne: 'SONORIA' } }, { sort: '-likes', limit: 4 }),
      ]);
      if (!activeRef.current) return;
      if (trackRes.items.length) setNowPlaying(trackRes.items[0]);
      setArtists(artistRes.items);
    } catch {
      if (activeRef.current) setArtists([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(async () => {
    await load();
    setRefreshKey((k) => k + 1); // también recarga el historial de canciones
  }, [load]);

  return (
    <PullToRefresh onRefresh={refresh}>
      <NowPlaying track={nowPlaying} />

      <section className="mx-auto max-w-6xl px-4 pt-2">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Canales por estilo</p>
        <GenreChips value={genre} onChange={setGenre} />
      </section>

      <TrackHistory genre={genre} key={refreshKey} />

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
    </PullToRefresh>
  );
}