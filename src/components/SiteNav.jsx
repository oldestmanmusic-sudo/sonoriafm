import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Radio, Menu, Upload, LogIn, LogOut, UserRound, Repeat, ChevronDown } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

// Menú agrupado: 4 secciones principales + "Más" para el resto, así cabe bien en pantallas pequeñas.
const mainLinks = [
  { to: '/', label: 'Radio' },
  { to: '/artistas', label: 'Artistas' },
  { to: '/programacion', label: 'Programación' },
  { to: '/noticias', label: 'Noticias' },
];
const moreLinks = [
  { to: '/sobre-nosotros', label: 'Sobre Nosotros' },
  { to: '/contacto', label: 'Contacto' },
  { to: '/sugerencias', label: 'Sugerencias' },
  { to: '/promociona-tu-musica', label: 'Promociona tu música' },
];

const UPLOAD_LINK = { to: '/subir-cancion', label: 'Subir canción' };
const AUTH_LABEL = 'Conéctate';

// Cierra la sesión y vuelve a la radio, o abre directamente el acceso para entrar con otra cuenta.
const signOut = () => base44.auth.logout('/');
const switchAccount = () => base44.auth.logout('/login');

export default function SiteNav() {
  const { pathname, search } = useLocation();
  const { isAuthenticated, user } = useAuth();
  const displayName = user?.full_name || user?.email || 'Mi cuenta';
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
          {mainLinks.map((l) => (
            <Link key={l.to} to={l.to} className={linkClass(l.to)}>
              {l.label}
            </Link>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(linkClass('/__more'), 'inline-flex items-center gap-1 outline-none', moreLinks.some((l) => isActive(l.to)) && 'bg-primary/15 text-primary')}
            >
              Más
              <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              {moreLinks.map((l) => (
                <DropdownMenuItem key={l.to} asChild>
                  <Link to={l.to} className={cn('cursor-pointer', isActive(l.to) && 'text-primary')}>
                    {l.label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
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
          {isAuthenticated && (
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex max-w-44 items-center gap-1.5 rounded-full border border-primary/50 px-3 py-2 text-sm font-medium text-foreground outline-none transition-colors hover:bg-primary/10">
                <UserRound className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="truncate">{displayName}</span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-56">
                <DropdownMenuLabel className="font-normal">
                  <p className="truncate text-sm font-semibold">{user?.full_name || 'Conectado'}</p>
                  {user?.email && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/cuenta" className="cursor-pointer"><UserRound className="mr-2 h-4 w-4" />Mi cuenta</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={switchAccount} className="cursor-pointer">
                  <Repeat className="mr-2 h-4 w-4" />Cambiar de cuenta
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={signOut} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
              Conéctate
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
            <SheetContent side="right" className="w-72 overflow-y-auto">
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
                {isAuthenticated && (
                  <div className="rounded-xl border border-border p-3">
                    <p className="truncate text-sm font-semibold">{user?.full_name || 'Conectado'}</p>
                    {user?.email && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
                    <div className="mt-3 flex flex-col gap-1">
                      <Link to="/cuenta" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-secondary">
                        <UserRound className="h-4 w-4 text-primary" /> Mi cuenta
                      </Link>
                      <button type="button" onClick={switchAccount} className="flex items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-secondary">
                        <Repeat className="h-4 w-4 text-primary" /> Cambiar de cuenta
                      </button>
                      <button type="button" onClick={signOut} className="flex items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-secondary">
                        <LogOut className="h-4 w-4 text-primary" /> Cerrar sesión
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-4 flex flex-col gap-1">
                {mainLinks.map((l) => (
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
              <p className="mt-5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Más</p>
              <div className="mt-1 flex flex-col gap-1">
                {moreLinks.map((l) => (
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
