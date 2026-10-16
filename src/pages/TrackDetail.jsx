import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { DEFAULT_COVER } from '@/lib/brand';
import { Image } from '@/components/ui/image';
import { Button } from '@/components/ui/button';
import { Heart, Share2, Loader2 } from 'lucide-react';
import BackButton from '@/components/BackButton';

export default function TrackDetail() {
  const { id } = useParams();
  const [track, setTrack] = useState(null);
  const [artist, setArtist] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [liking, setLiking] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const t = await base44.entities.Track.get(id);
        if (!active) return;
        if (!t) { setNotFound(true); return; }
        setTrack(t);
        try {
          const { items } = await base44.entities.Artist.filter({ name: t.artist }, { limit: 1 });
          if (active && items.length) setArtist(items[0]);
        } catch { /* ignore */ }
      } catch {
        if (active) setNotFound(true);
      }
    })();
    return () => { active = false; };
  }, [id]);

  const like = async () => {
    if (liking) return;
    const authed = await base44.auth.isAuthenticated();
    if (!authed) {
      base44.auth.redirectToLogin(window.location.pathname + window.location.search);
      return;
    }
    setLiking(true);
    const previous = track?.likes ?? 0;
    setTrack((t) => (t ? { ...t, likes: (t.likes ?? 0) + 1 } : t)); // optimista: se muestra al instante
    try {
      const res = await base44.functions.invoke('likeTrack', { trackId: id });
      setTrack((t) => (t ? { ...t, likes: res.data.likes } : t));
    } catch {
      setTrack((t) => (t ? { ...t, likes: previous } : t)); // error: se revierte
    } finally {
      setLiking(false);
    }
  };

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${track.title} — ${track.artist}`, url });
        return;
      } catch { /* cancelado */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  if (notFound) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-20 text-center">
        <h1 className="font-heading text-3xl font-bold">Canción no encontrada</h1>
        <p className="mt-2 text-muted-foreground">Puede que ya no esté disponible en el catálogo.</p>
        <Link to="/" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">
          Volver a la radio
        </Link>
      </section>
    );
  }

  if (!track) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const meta = [
    track.genre && ['Género', track.genre],
    track.duration && ['Duración', track.duration],
    track.year && ['Año', String(track.year)],
    track.album && ['Álbum', track.album],
  ].filter(Boolean);

  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-6">
        <BackButton to="/" label="Radio en Vivo" />
      </div>
      <div className="grid items-start gap-8 md:grid-cols-[300px_1fr]">
        <div className="aspect-square overflow-hidden rounded-3xl border border-border bg-secondary">
          <Image src={track.cover_url || DEFAULT_COVER} alt={track.title} className="h-full w-full" />
        </div>

        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">Canción</p>
          <h1 className="mt-2 font-heading text-4xl font-extrabold tracking-tight sm:text-5xl">{track.title}</h1>
          <p className="mt-2 text-lg text-muted-foreground">
            {artist ? (
              <Link to={`/artistas/${artist.id}`} className="text-primary hover:underline">{track.artist}</Link>
            ) : (
              track.artist
            )}
          </p>

          {track.description && (
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">{track.description}</p>
          )}

          {meta.length > 0 && (
            <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {meta.map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-border bg-card p-3">
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
                  <dd className="mt-1 truncate text-sm font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          )}

          {track.audio_url && (
            <audio controls src={track.audio_url} className="mt-6 w-full">
              Tu navegador no soporta audio.
            </audio>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button onClick={like} variant="outline" className="rounded-full" disabled={liking}>
              {liking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className="h-4 w-4 text-accent" />}
              {track.likes ?? 0}
            </Button>
            <Button onClick={share} variant="outline" className="rounded-full">
              <Share2 className="h-4 w-4" /> {copied ? 'Enlace copiado' : 'Compartir'}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}