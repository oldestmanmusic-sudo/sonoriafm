import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';

export default function ArtistCard({ artist }) {
  return (
    <Link
      to={`/artistas/${artist.id}`}
      className="group relative block overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary/50"
    >
      <div className="relative aspect-[4/5] overflow-hidden">
        {artist.image_url ? (
          <img src={artist.image_url} alt={artist.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary/30 to-accent/20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="font-heading text-lg font-bold leading-tight">{artist.name}</h3>
          {artist.genre && <p className="text-sm text-primary">{artist.genre}</p>}
          {artist.country && <p className="text-xs text-muted-foreground">{artist.country}</p>}
        </div>
        <div className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-background/70 backdrop-blur px-2 py-1 text-xs">
          <Heart className="h-3 w-3 text-accent" /> {artist.likes ?? 0}
        </div>
      </div>
      {artist.bio && <p className="p-4 text-sm text-muted-foreground line-clamp-3">{artist.bio}</p>}
    </Link>
  );
}