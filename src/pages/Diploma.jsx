import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { DEFAULT_COVER } from '@/lib/brand';
import { Button } from '@/components/ui/button';
import { Share2, Download, Loader2 } from 'lucide-react';
import { buildDiploma, weekLabel } from '@/lib/diploma';
import { cardFileName } from '@/lib/shareCard';

// Diploma de un premiado del TOP semanal, listo para descargar y compartir.
export default function Diploma() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [image, setImage] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setData(null);
    setImage(null);
    setError(false);
    (async () => {
      try {
        const res = await base44.functions.invoke('diploma', { id });
        const d = res?.data?.diploma ?? res?.diploma;
        if (!d) throw new Error('sin diploma');
        const blob = await buildDiploma({
          title: d.song_title,
          artist: d.artist,
          coverUrl: d.cover_url || DEFAULT_COVER,
          position: d.position,
          likes: d.likes,
          tie: d.tie,
          week: weekLabel(d.week_date),
        });
        if (!blob) throw new Error('sin imagen');
        if (!active) return;
        document.title = `Diploma de «${d.song_title}» · SONORIA FM`;
        objectUrl = URL.createObjectURL(blob);
        const name = `diploma-${cardFileName(d.song_title)}`;
        setData(d);
        setImage({ url: objectUrl, file: new File([blob], name, { type: 'image/png' }) });
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
        <h1 className="font-heading text-3xl font-bold">No encontramos este diploma</h1>
        <p className="mt-2 text-muted-foreground">Recarga la página o revisa el enlace del correo.</p>
        <Link to="/" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">Ir a la radio</Link>
      </section>
    );
  }

  if (!data || !image) {
    return (
      <div className="flex flex-col items-center gap-3 py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Preparando el diploma…</p>
      </div>
    );
  }

  const text = `«${data.song_title}», de ${data.artist}, en el podio del TOP semanal de SONORIA FM: ${window.location.href}`;
  const canShareFile = Boolean(navigator.canShare?.({ files: [image.file] }));

  const share = async () => {
    try {
      await navigator.share({ files: [image.file], title: `${data.song_title} — ${data.artist}`, text });
    } catch { /* cancelado */ }
  };

  return (
    <section className="mx-auto max-w-xl px-4 pt-8 pb-40 text-center">
      <h1 className="font-heading text-3xl font-extrabold tracking-tight">¡Enhorabuena!</h1>
      <p className="mt-2 text-sm text-muted-foreground">Descarga tu diploma y compártelo con tu gente.</p>

      <img
        src={image.url}
        alt={`Diploma de ${data.artist} por «${data.song_title}»`}
        className="mx-auto mt-6 w-full max-w-sm rounded-3xl border border-border"
      />

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {canShareFile && (
          <Button onClick={share} className="rounded-full">
            <Share2 className="h-4 w-4" /> Compartir diploma
          </Button>
        )}
        <Button asChild variant={canShareFile ? 'outline' : 'default'} className="rounded-full">
          <a href={image.url} download={image.file.name}>
            <Download className="h-4 w-4" /> Descargar imagen
          </a>
        </Button>
      </div>

      {data.track_id && (
        <Link to={`/cancion/${data.track_id}`} className="mt-6 inline-block text-sm font-medium text-primary hover:underline">
          Escuchar la canción
        </Link>
      )}
    </section>
  );
}
