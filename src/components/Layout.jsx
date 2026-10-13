import { Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import SiteNav from '@/components/SiteNav';
import RadioPlayer from '@/components/RadioPlayer';
import { RadioProvider } from '@/lib/radioContext';
import { base44 } from '@/api/base44Client';

export default function Layout() {
  const [nowPlaying, setNowPlaying] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { items } = await base44.entities.Track.filter({}, { sort: '-played_at', limit: 1 });
        if (active && items.length) setNowPlaying(items[0]);
      } catch {
        /* ignore */
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <RadioProvider>
      <div className="min-h-screen flex flex-col">
        <SiteNav />
        <main className="flex-1">
          <Outlet />
        </main>
        <footer className="border-t border-border py-8 mt-12">
          <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
            <p>SONORIA · Música variada en vivo 24/7</p>
            <p>© {new Date().getFullYear()} SONORIA</p>
          </div>
        </footer>
        <div className="h-24" aria-hidden />
        <RadioPlayer nowPlaying={nowPlaying} />
      </div>
    </RadioProvider>
  );
}