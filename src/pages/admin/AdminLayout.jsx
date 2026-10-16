import { NavLink, Link, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import {
  Radio,
  LayoutDashboard,
  Newspaper,
  Users,
  CalendarClock,
  History,
  Inbox,
  Mail,
  Lightbulb,
  LogOut,
  ArrowLeft,
  ShieldAlert,
} from 'lucide-react';

const NAV = [
  { to: '/admin', label: 'Resumen', Icon: LayoutDashboard, end: true },
  { to: '/admin/articulos', label: 'Artículos', Icon: Newspaper },
  { to: '/admin/artistas', label: 'Artistas', Icon: Users },
  { to: '/admin/programacion', label: 'Programación', Icon: CalendarClock },
  { to: '/admin/historial', label: 'Historial', Icon: History },
  { to: '/admin/envios', label: 'Envíos', Icon: Inbox },
  { to: '/admin/mensajes', label: 'Mensajes', Icon: Mail },
  { to: '/admin/sugerencias', label: 'Sugerencias', Icon: Lightbulb },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();

  if (user && user.role !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="mt-4 font-heading text-xl font-bold">Acceso restringido</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta zona es solo para administradores de SONORIA. Si crees que es un error, pide acceso al equipo.
          </p>
          <Link to="/" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">
            Volver a la web
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/admin" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/40">
              <Radio className="h-5 w-5 text-primary" />
            </span>
            <span className="font-heading text-lg font-extrabold tracking-tight">
              SONOR<span className="text-primary">IA</span>
              <span className="ml-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Panel</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="hidden items-center gap-1 rounded-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground sm:inline-flex"
            >
              <ArrowLeft className="h-4 w-4" /> Ver web
            </Link>
            <button
              type="button"
              onClick={() => logout()}
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <LogOut className="h-4 w-4" /> Salir
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[220px_1fr]">
        <nav className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {NAV.map(({ to, label, Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  )
                }
              >
                <Icon className="h-4 w-4" /> {label}
              </NavLink>
            ))}
          </div>
        </nav>

        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}