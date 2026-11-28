import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useRadio, detectZone } from '@/lib/radioContext';
import { DEFAULT_COVER } from '@/lib/brand';
import { Image } from '@/components/ui/image';
import { Loader2, History, Play, Pause } from 'lucide-react';

function formatTime(d) {
  try {
    return new Date(d).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

// Lo que ha sonado de verdad en la emisión de tu zona (últimas 3 horas), de lo más reciente
// a lo más antiguo, con la hora a la que empezó cada canción.
async function loadAired() {
  const res = await base44.functions.invoke('radioNow', { count: 60, backMs: 3 * 3600 * 1000, zone: detectZone() });
  const data = res?.data ?? res;
  const now = Number(data?.serverTime) || Date.now();
  const list = Array.isArray(data?.tracks) ? data.tracks : [];
  return list
    .filter((e) => e && e.kind !== 'cuna' && e.genre !== 'Cuña' && e.endsAt <= now)
    .reverse()
    .slice(0, 12)
    .map((e) => ({ ...e, key: `${e.id}-${e.startsAt}`, played_at: e.startsAt }));
}

export default function TrackHistory({ genre = 'Todo SONORIA FM' }) {
  const [tracks, setTracks] = useState(null);
  const { onDemandTrack, isPlaying, isLoading, playOnDemand, toggle } = useRadio();
  const isChannel = Boolean(genre && genre !== 'Todo SONORIA FM');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        if (isChannel) {
          const { items } = await base44.entities.Track.filter({ genre }, { sort: '-created_date', limit: 12 });
          if (active) setTracks(items);
          return;
        }
        const aired = await loadAired();
        if (active) setTracks(aired);
      } catch {
        if (active) setTracks((prev) => prev || []);
      }
    };
    load();
    const timer = isChannel ? null : setInterval(load, 2 * 60 * 1000);
    return () => { active = false; if (timer) clearInterval(timer); };
  }, [genre, isChannel]);

  const play = (e, t) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDemandTrack?.id === t.id && isPlaying) toggle();
    else playOnDemand(t);
  };

  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex items-center gap-2 mb-6">
        <History className="h-5 w-5 text-primary" />
        <h2 className="font-heading text-2xl font-bold">
          {isChannel ? `Canal ${genre}` : 'Ha sonado en SONORIA FM'}
        </h2>
      </div>

      {tracks === null ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : tracks.length === 0 ? (
        <p className="text-muted-foreground">
          {isChannel ? 'Todavía no hay canciones en este canal.' : 'En cuanto termine la canción que suena, aparecerá aquí.'}
        </p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x no-scrollbar">
          {tracks.map((t) => {
            const active = onDemandTrack?.id === t.id;
            return (
              <div key={t.key || t.id} className="relative snap-start shrink-0 w-40 group">
                <Link to={`/cancion/${t.id}`} className="block">
                  <div className="relative aspect-square overflow-hidden rounded-2xl bg-secondary">
                    <Image
                      src={t.cover_url || DEFAULT_COVER}
                      alt={t.title}
                      className="h-full w-full transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug">{t.title}</p>
                  <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">{t.artist}</p>
                  {!isChannel && t.played_at && (
                    <p className="text-[11px] text-muted-foreground/70">Sonó a las {formatTime(t.played_at)}</p>
                  )}
                </Link>
                <button
                  onClick={(e) => play(e, t)}
                  className="absolute top-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition-transform hover:scale-105 active:scale-95"
                  aria-label={active && isPlaying ? `Pausar ${t.title}` : `Reproducir ${t.title}`}
                >
                  {active && isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : active && isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4 ml-0.5" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}