import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { DEFAULT_COVER } from '@/lib/brand';
import { Image } from '@/components/ui/image';
import { Button } from '@/components/ui/button';
import { Loader2, ExternalLink } from 'lucide-react';
import BackButton from '@/components/BackButton';

export default function ArtistDetail() {
  const { id } = useParams();
  const [artist, setArtist] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const a = await base44.entities.Artist.get(id);
        if (!active) return;
        if (!a) { setNotFound(true); return; }
        setArtist(a);
        try {
          const { items } = await base44.entities.Track.filter({ artist: a.name }, { sort: '-played_at', limit: 50 });
          if (active) setTracks(items);
        } catch { /* ignore */ }
      } catch {
        if (active) setNotFound(true);
      }
    })();
    return () => { active = false; };
  }, [id]);

  if (notFound) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-20 text-center">
        <h1 className="font-heading text-3xl font-bold">Artista no encontrado</h1>
        <Link to="/artistas" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">
          Ver todos los artistas
        </Link>
      </section>
    );
  }

  if (!artist) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-6">
        <BackButton to="/artistas" label="Artistas" />
      </div>
      <div className="grid items-center gap-8 sm:grid-cols-[220px_1fr]">
        <div className="aspect-square overflow-hidden rounded-3xl border border-border bg-secondary">
          <Image src={artist.image_url || DEFAULT_COVER} alt={artist.name} className="h-full w-full" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">Artista</p>
          <h1 className="mt-2 font-heading text-4xl font-extrabold tracking-tight sm:text-5xl">{artist.name}</h1>
          <p className="mt-2 text-muted-foreground">
            {[artist.genre, artist.country].filter(Boolean).join(' · ')}
          </p>
          {artist.bio && <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">{artist.bio}</p>}
          {artist.social_url && (
            <a href={artist.social_url} target="_blank" rel="noopener noreferrer" className="mt-5 inline-block">
              <Button variant="outline" className="rounded-full">
                <ExternalLink className="h-4 w-4" /> Redes y música
              </Button>
            </a>
          )}
        </div>
      </div>

      <h2 className="mt-12 font-heading text-2xl font-bold">Sus canciones</h2>
      {tracks.length === 0 ? (
        <p className="mt-4 text-muted-foreground">Todavía no hay canciones publicadas de este artista.</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {tracks.map((t) => (
            <Link key={t.id} to={`/cancion/${t.id}`} className="group">
              <div className="aspect-square overflow-hidden rounded-2xl bg-secondary">
                <Image src={t.cover_url || DEFAULT_COVER} alt={t.title} className="h-full w-full transition-transform duration-500 group-hover:scale-105" />
              </div>
              <p className="mt-2 truncate text-sm font-semibold">{t.title}</p>
              {t.genre && <p className="truncate text-xs text-muted-foreground">{t.genre}</p>}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}