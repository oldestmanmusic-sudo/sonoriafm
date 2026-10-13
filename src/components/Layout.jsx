import { Link, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import SiteNav from '@/components/SiteNav';
import SocialLinks from '@/components/SocialLinks';
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
        <footer className="border-t border-border py-10 mt-12">
          <div className="mx-auto max-w-6xl px-4 grid gap-8 sm:grid-cols-[1.5fr_1fr_1.4fr]">
            <div>
              <p className="font-heading text-lg font-extrabold tracking-tight">
                SONO<span className="text-primary">RIA</span>
              </p>
              <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                Música variada en vivo, las 24 horas. Una radio cercana, libre y sin etiquetas.
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold">Explora</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li><Link to="/artistas" className="hover:text-foreground">Artistas</Link></li>
                <li><Link to="/programacion" className="hover:text-foreground">Programación</Link></li>
                <li><Link to="/noticias" className="hover:text-foreground">Noticias</Link></li>
                <li><Link to="/sobre-nosotros" className="hover:text-foreground">Sobre Nosotros</Link></li>
                <li><Link to="/contacto" className="hover:text-foreground">Contacto</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold">Síguenos</p>
              <SocialLinks className="mt-3" />
            </div>
          </div>
          <div className="mx-auto max-w-6xl px-4 mt-8 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
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