import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { DEFAULT_COVER } from '@/lib/brand';
import { Button } from '@/components/ui/button';
import { Share2, Download, Copy, MessageCircle, Loader2 } from 'lucide-react';
import { buildShareCard, cardFileName } from '@/lib/shareCard';

// Tarjeta de una canción lista para que su artista la comparta pidiendo votos.
export default function Tarjeta() {
  const { id } = useParams();
  const [track, setTrack] = useState(null);
  const [card, setCard] = useState(null);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setTrack(null);
    setCard(null);
    setError(false);
    (async () => {
      try {
        const t = await base44.entities.Track.get(id);
        if (!t) throw new Error('sin canción');
        if (!active) return;
        setTrack(t);
        document.title = `Tarjeta de «${t.title}» · SONORIA FM`;
        const blob = await buildShareCard({
          title: t.title,
          artist: t.artist,
          coverUrl: t.cover_url || DEFAULT_COVER,
          headline: 'VOTA MI CANCIÓN',
        });
        if (!blob) throw new Error('sin imagen');
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setCard({ url: objectUrl, file: new File([blob], cardFileName(t.title), { type: 'image/png' }) });
      } catch {
        if (active) setError(true);
      }
    })();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  if (error) {
    return (
      <section className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="font-heading text-3xl font-bold">No se ha podido crear la tarjeta</h1>
        <p className="mt-2 text-muted-foreground">Recarga la página o abre la ficha de la canción.</p>
        <Link to={`/cancion/${id}`} className="mt-6 inline-block text-sm font-medium text-primary hover:underline">
          Ver la canción
        </Link>
      </section>
    );
  }

  if (!track || !card) {
    return (
      <div className="flex flex-col items-center gap-3 py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Preparando tu tarjeta…</p>
      </div>
    );
  }

  const link = `${window.location.origin}/cancion/${id}`;
  const text = `Vota mi canción «${track.title}» en SONORIA FM. Es un toque y sin registrarte: ${link}`;
  const canShareFile = Boolean(navigator.canShare?.({ files: [card.file] }));

  const share = async () => {
    try {
      await navigator.share({ files: [card.file], title: `${track.title} — ${track.artist}`, text });
    } catch { /* cancelado */ }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <section className="mx-auto max-w-xl px-4 pt-8 pb-40 text-center">
      <h1 className="font-heading text-3xl font-extrabold tracking-tight">Tu tarjeta para pedir votos</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Compártela con tu gente. Pueden votar en un toque, sin registrarse. El TOP 10 empieza de cero cada lunes.
      </p>

      <img
        src={card.url}
        alt={`Tarjeta de ${track.title}, de ${track.artist}`}
        className="mx-auto mt-6 w-full max-w-sm rounded-3xl border border-border"
      />

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {canShareFile && (
          <Button onClick={share} className="rounded-full">
            <Share2 className="h-4 w-4" /> Compartir tarjeta
          </Button>
        )}
        <Button asChild variant={canShareFile ? 'outline' : 'default'} className="rounded-full">
          <a href={card.url} download={card.file.name}>
            <Download className="h-4 w-4" /> Descargar imagen
          </a>
        </Button>
        <Button asChild variant="outline" className="rounded-full">
          <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-4 w-4" /> Enviar por WhatsApp
          </a>
        </Button>
        <Button onClick={copy} variant="outline" className="rounded-full">
          <Copy className="h-4 w-4" /> {copied ? 'Texto copiado' : 'Copiar texto y enlace'}
        </Button>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        En las historias de Instagram, añade el enlace con la pegatina «Enlace».
      </p>
      <Link to={`/cancion/${id}`} className="mt-6 inline-block text-sm font-medium text-primary hover:underline">
        Ver la canción y sus votos
      </Link>
    </section>
  );
}
