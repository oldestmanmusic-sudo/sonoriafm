import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Image } from '@/components/ui/image';
import { Button } from '@/components/ui/button';
import { Loader2, Radio, Play, Pause, RefreshCw, Pencil, ExternalLink } from 'lucide-react';
import { DEFAULT_COVER } from '@/lib/brand';

const madridTime = (ms) => {
  if (!ms) return '';
  try {
    return new Intl.DateTimeFormat('es-ES', {
      timeZone: 'Europe/Madrid',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ms));
  } catch {
    return '';
  }
};

export default function AdminEmision() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playingId, setPlayingId] = useState(null);
  const audioRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('radioNow', { count: 40, backMs: 90000 });
      setData(res.data);
    } catch (e) {
      setError(e?.message || 'No se pudo cargar la emisión.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => {
      clearInterval(t);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [load]);

  const togglePlay = (track) => {
    let el = audioRef.current;
    if (!el) {
      el = new Audio();
      audioRef.current = el;
      el.addEventListener('ended', () => setPlayingId(null));
    }
    if (playingId === track.id) {
      el.pause();
      setPlayingId(null);
      return;
    }
    el.src = track.audio_url;
    el.play().catch(() => {});
    setPlayingId(track.id);
  };

  const tracks = data?.tracks || [];
  const current = tracks[0] || null;
  const upcoming = tracks.slice(1);

  return (
    <div>
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Emisión en vivo</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Qué suena ahora en SONORIA FM y qué viene a continuación. Se actualiza cada minuto.
          </p>
        </div>
        <Button variant="outline" className="rounded-full shrink-0" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
        </Button>
      </div>

      {error && (
        <p className="mt-6 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading && !data ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !current ? (
        <p className="mt-6 rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          No hay emisión programada ahora mismo.
        </p>
      ) : (
        <>
          {/* Canción actual */}
          <div className="mt-6 rounded-2xl border border-accent/40 bg-accent/10 p-4 sm:p-5">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-accent/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent pulse-live" /> Sonando ahora
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-secondary">
                <Image src={current.cover_url || DEFAULT_COVER} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-heading text-lg font-bold">{current.title}</p>
                <p className="truncate text-sm text-muted-foreground">{current.artist}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {current.genre || 'Sin canal'} · hasta las {madridTime(current.endsAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {current.audio_url && (
                  <Button variant="outline" size="icon" aria-label="Escuchar" onClick={() => togglePlay(current)}>
                    {playingId === current.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                )}
                <Link to="/admin/historial">
                  <Button variant="ghost" size="icon" aria-label="Editar en historial">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Próximas */}
          <h2 className="mt-8 font-heading text-lg font-bold">A continuación</h2>
          {upcoming.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No hay más canciones programadas.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {upcoming.map((t, i) => (
                <li
                  key={`${t.id}-${i}`}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 sm:p-4"
                >
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-secondary">
                    <Image src={t.cover_url || DEFAULT_COVER} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{t.title}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {t.artist} · {t.genre || 'Sin canal'}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-muted-foreground">
                    {madridTime(t.startsAt)}
                  </span>
                  {t.audio_url && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={playingId === t.id ? 'Pausar' : 'Escuchar'}
                      onClick={() => togglePlay(t)}
                    >
                      {playingId === t.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                  )}
                  <Link to="/admin/historial" className="hidden sm:block">
                    <Button variant="ghost" size="icon" aria-label="Editar en historial">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
            <Radio className="h-3.5 w-3.5" />
            <Link to="/programacion" className="inline-flex items-center gap-1 hover:text-foreground">
              Ver parrilla completa <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}