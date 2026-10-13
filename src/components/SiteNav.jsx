import { Link, useLocation } from 'react-router-dom';
import { Radio } from 'lucide-react';
import { cn } from '@/lib/utils';

const links = [
  { to: '/', label: 'Radio en Vivo' },
  { to: '/artistas', label: 'Artistas' },
  { to: '/programacion', label: 'Programación' },
];

export default function SiteNav() {
  const { pathname } = useLocation();
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 border-b border-border">
      <nav className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group shrink-0">
          <span className="relative flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/40 transition-transform group-hover:scale-105">
            <Radio className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          </span>
          <span className="font-heading text-lg sm:text-xl font-extrabold tracking-tight">
            SONO<span className="text-primary">RIA</span>
          </span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-1.5">
          {links.map((l) => {
            const active = pathname === l.to;
            return (
              <Link
                key={l.to}
                to={l.to}
                className={cn(
                  'px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-full transition-colors whitespace-nowrap',
                  active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}