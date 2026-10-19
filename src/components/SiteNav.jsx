import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Radio, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

const links = [
  { to: '/', label: 'Radio en Vivo' },
  { to: '/artistas', label: 'Artistas' },
  { to: '/programacion', label: 'Programación' },
  { to: '/noticias', label: 'Noticias' },
  { to: '/sobre-nosotros', label: 'Sobre Nosotros' },
  { to: '/contacto', label: 'Contacto' },
  { to: '/sugerencias', label: 'Sugerencias' },
  { to: '/envia-tu-cancion', label: 'Envía tu canción' },
  { to: '/promociona-tu-musica', label: 'Promociona tu música' },
];

export default function SiteNav() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  const isActive = (to) => (to === '/' ? pathname === '/' : pathname.startsWith(to));

  return (
    <header
      className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 border-b border-border"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <nav className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group shrink-0">
          <span className="relative flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/40 transition-transform group-hover:scale-105">
            <Radio className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          </span>
          <span className="font-heading text-lg sm:text-xl font-extrabold tracking-tight">
            SONOR<span className="text-primary">IA</span>
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={cn(
                'px-3 py-2 text-sm font-medium rounded-full transition-colors whitespace-nowrap',
                isActive(l.to) ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Mobile menu */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="Abrir menú"
              className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground hover:bg-secondary"
            >
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetTitle className="font-heading text-lg font-extrabold tracking-tight">
              SONOR<span className="text-primary">IA</span>
            </SheetTitle>
            <div className="mt-6 flex flex-col gap-1">
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
      </nav>
    </header>
  );
}