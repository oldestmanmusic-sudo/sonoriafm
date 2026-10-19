import { Suspense, useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigationType } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import SocialLinks from '@/components/SocialLinks';
import RadioPlayer from '@/components/RadioPlayer';
import BottomTabs from '@/components/BottomTabs';
import { RadioProvider } from '@/lib/radioContext';
import { base44 } from '@/api/base44Client';

export default function Layout() {
  const [playlist, setPlaylist] = useState([]);
  const nowPlaying = playlist[0] || null;
  const location = useLocation();
  const navType = useNavigationType();

  // Transición de pantalla: empuje desde la derecha, regreso desde la izquierda.
  const pageVariants =
    navType === 'PUSH'
      ? { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '-30%' } }
      : navType === 'POP'
        ? { initial: { x: '-30%' }, animate: { x: 0 }, exit: { x: '100%' } }
        : { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // El reproductor emite TODO el catálogo de la web (barajado aleatorio,
        // sin repetir artista), no solo las últimas canciones.
        const { items } = await base44.entities.Track.filter({}, { sort: '-played_at', limit: 500 });
        if (active) setPlaylist(items);
      } catch {
        /* ignore */
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <RadioProvider playlist={playlist}>
      <div className="min-h-screen flex flex-col">
        <SiteNav />
        <main className="flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={pageVariants.initial}
              animate={pageVariants.animate}
              exit={pageVariants.exit}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <Suspense
                fallback={
                  <div className="flex justify-center py-24">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                }
              >
                <Outlet />
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
        <footer className="border-t border-border py-10 mt-12">
          <div className="mx-auto max-w-6xl px-4 grid gap-8 sm:grid-cols-[1.5fr_1fr_1.4fr]">
            <div>
              <p className="font-heading text-lg font-extrabold tracking-tight">
                SONOR<span className="text-primary">IA</span>
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
                <li><Link to="/donar" className="hover:text-foreground">Donar</Link></li>
                <li><Link to="/terminos" className="hover:text-foreground">Términos y Condiciones</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold">Síguenos</p>
              <SocialLinks className="mt-3" />
            </div>
          </div>
          <div className="mx-auto max-w-6xl px-4 mt-8 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
            <p>SONORIA · Música variada en vivo 24/7</p>
            <div className="flex items-center gap-4">
              <Link to="/admin" className="hover:text-foreground">Panel de administración</Link>
              <Link to="/cuenta" className="hover:text-foreground">Mi cuenta</Link>
              <p>© {new Date().getFullYear()} SONORIA</p>
            </div>
          </div>
        </footer>
        <div className="h-44 md:h-24" aria-hidden />
        <RadioPlayer nowPlaying={nowPlaying} />
        <BottomTabs />
      </div>
    </RadioProvider>
  );
}