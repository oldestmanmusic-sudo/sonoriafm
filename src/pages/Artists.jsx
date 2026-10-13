import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import ArtistCard from '@/components/ArtistCard';
import { Loader2 } from 'lucide-react';

export default function Artists() {
  const [artists, setArtists] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { items } = await base44.entities.Artist.filter({}, { sort: '-likes', limit: 50 });
        if (active) setArtists(items);
      } catch {
        if (active) setArtists([]);
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="font-heading text-3xl font-extrabold tracking-tight">Artistas destacados</h1>
      <p className="mt-2 text-muted-foreground">Voces independientes y música con identidad que suenan en SONORIA.</p>

      <div className="mt-8">
        {artists === null ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : artists.length === 0 ? (
          <p className="text-muted-foreground">Pronto destacaremos aquí a nuestros artistas.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {artists.map((a) => (
              <ArtistCard key={a.id} artist={a} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}