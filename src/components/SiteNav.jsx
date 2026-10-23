import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Radio, Menu, Upload, LogIn } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

const links = [
  { to: '/', label: 'Radio en Vivo' },
  { to: '/artistas', label: 'Artistas' },
  { to: '/programacion', label: 'Programación' },
  { to: '/noticias', label: 'Noticias' },
  { to: '/sobre-nosotros', label: 'Sobre Nosotros' },
  { to: '/contacto', label: 'Contacto' },
  { to: '/sugerencias', label: 'Sugerencias' },
  { to: '/promociona-tu-musica', label: 'Promociona tu música' },
];

const UPLOAD_LINK = { to: '/subir-cancion', label: 'Subir canción' };
const AUTH_LABEL = 'Inicio de sesión / Registro';

export default function SiteNav() {
  const { pathname, search } = useLocation();
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);

  const isActive = (to) => (to === '/' ? pathname === '/' : pathname.startsWith(to));

  // Tras iniciar sesión o registrarse, se vuelve a la página en la que estaba.
  const here = pathname + search;
  const loginTo = '/login' + (here !== '/' ? `?returnTo=${encodeURIComponent(here)}` : '');

  const linkClass = (to) =>
    cn(
      'px-3 py-2 text-sm font-medium rounded-full transition-colors whitespace-nowrap',
      isActive(to) ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
    );

  return (
    <header
      className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 border-b border-border"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <nav className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2 group shrink-0">
          <span className="relative flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/40 transition-transform group-hover:scale-105">
            <Radio className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          </span>
          <span className="font-heading text-lg sm:text-xl font-extrabold tracking-tight">
            SONOR<span className="text-primary">IA</span> FM
          </span>
        </Link>

        {/* Desktop */}
        <div className="hidden lg:flex items-center gap-1">
          {links.map((l) => (
            <Link key={l.to} to={l.to} className={linkClass(l.to)}>
              {l.label}
            </Link>
          ))}
          <Link
            to={UPLOAD_LINK.to}
            className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-sm font-medium whitespace-nowrap text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Upload className="h-3.5 w-3.5" />
            {UPLOAD_LINK.label}
          </Link>
          {!isAuthenticated && (
            <Link
              to={loginTo}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/50 px-3 py-2 text-sm font-medium whitespace-nowrap text-foreground transition-colors hover:bg-primary/10"
            >
              <LogIn className="h-3.5 w-3.5 text-primary" />
              {AUTH_LABEL}
            </Link>
          )}
        </div>

        {/* Móvil / tablet */}
        <div className="flex items-center gap-2 lg:hidden">
          {!isAuthenticated && (
            <Link
              to={loginTo}
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-primary/50 px-3 text-sm font-medium text-foreground hover:bg-primary/10"
            >
              <LogIn className="h-4 w-4 text-primary" />
              Entrar
            </Link>
          )}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Abrir menú"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground hover:bg-secondary"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetTitle className="font-heading text-lg font-extrabold tracking-tight">
                SONOR<span className="text-primary">IA</span> FM
              </SheetTitle>
              <div className="mt-6 flex flex-col gap-2">
                <Link
                  to={UPLOAD_LINK.to}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Upload className="h-4 w-4" />
                  {UPLOAD_LINK.label}
                </Link>
                {!isAuthenticated && (
                  <Link
                    to={loginTo}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 rounded-xl border border-primary/50 px-4 py-3 text-sm font-medium text-foreground hover:bg-primary/10"
                  >
                    <LogIn className="h-4 w-4 text-primary" />
                    {AUTH_LABEL}
                  </Link>
                )}
              </div>
              <div className="mt-4 flex flex-col gap-1">
                {links.map((l) => (
                  <Link
                    key={l.to}
                    to={l.to}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'rounded-xl px-4 py-3 text-sm font-medium transition-colors',
                      isActive(l.to) ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                    )}
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}
