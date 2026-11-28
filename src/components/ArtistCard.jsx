import { Link } from 'react-router-dom';
import { Heart, Loader2 } from 'lucide-react';
import { useArtistLike } from '@/lib/useArtistLike';

export default function ArtistCard({ artist }) {
  const { likes, liked, liking, like } = useArtistLike(artist.id, artist.likes);

  // El botón del corazón va fuera del enlace: al pulsarlo no se abre la ficha.
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary/50">
    <Link to={`/artistas/${artist.id}`} className="block">
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
      </div>
      {artist.bio && <p className="p-4 text-sm text-muted-foreground line-clamp-3">{artist.bio}</p>}
    </Link>
      <button
        type="button"
        onClick={like}
        aria-pressed={liked}
        aria-label={liked ? `Ya has dado tu corazón a ${artist.name}` : `Dar un corazón a ${artist.name}`}
        className="absolute top-2 right-2 inline-flex min-h-9 items-center gap-1.5 rounded-full bg-background/70 px-3 py-1.5 text-sm font-semibold backdrop-blur transition-transform hover:scale-105 active:scale-95"
      >
        {liking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className={`h-4 w-4 text-accent ${liked ? 'fill-accent' : ''}`} />}
        {likes}
      </button>
    </div>
  );
}