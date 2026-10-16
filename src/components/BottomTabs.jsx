import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Radio, Users, CalendarDays, Newspaper, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { to: '/', label: 'Radio', icon: Radio },
  { to: '/artistas', label: 'Artistas', icon: Users },
  { to: '/programacion', label: 'Programas', icon: CalendarDays },
  { to: '/noticias', label: 'Noticias', icon: Newspaper },
  { to: '/contacto', label: 'Contacto', icon: Mail },
];

// Última pantalla visitada de cada sección: cada pestaña conserva su propio historial.
const tabHistory = {};

function isActive(to, pathname) {
  return to === '/' ? pathname === '/' : pathname.startsWith(to);
}

// A qué pestaña pertenece la pantalla actual (para recordar su última pantalla).
function sectionOf(pathname) {
  if (pathname === '/' || pathname.startsWith('/cancion')) return '/';
  const match = TABS.find((t) => t.to !== '/' && pathname.startsWith(t.to));
  return match ? match.to : null;
}

export default function BottomTabs() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const section = sectionOf(pathname);
    if (section) tabHistory[section] = pathname;
  }, [pathname]);

  const onTabClick = (to) => {
    if (isActive(to, pathname)) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    navigate(tabHistory[to] || to);
  };

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 md:hidden border-t border-border bg-background/90 backdrop-blur-xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navegación principal"
    >
      <div className="grid grid-cols-5">
        {TABS.map((t) => {
          const active = isActive(t.to, pathname);
          return (
            <button
              key={t.to}
              type="button"
              onClick={() => onTabClick(t.to)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <t.icon className="h-5 w-5" />
              {t.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}