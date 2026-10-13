import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Loader2, Newspaper, Users, CalendarClock, History, Mail, ArrowRight } from 'lucide-react';

const SECTIONS = [
  { key: 'articles', to: '/admin/articulos', label: 'Artículos', Icon: Newspaper, hint: 'Publica y edita noticias' },
  { key: 'artists', to: '/admin/artistas', label: 'Artistas', Icon: Users, hint: 'Perfiles destacados' },
  { key: 'programs', to: '/admin/programacion', label: 'Programación', Icon: CalendarClock, hint: 'Parrilla semanal' },
  { key: 'tracks', to: '/admin/historial', label: 'Historial', Icon: History, hint: 'Temas emitidos' },
  { key: 'messages', to: '/admin/mensajes', label: 'Mensajes', Icon: Mail, hint: 'Contacto recibido' },
];

export default function AdminDashboard() {
  const { user } = useAuth();
  const [counts, setCounts] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [articles, artists, programs, tracks, messages] = await Promise.all([
          base44.entities.Article.count(),
          base44.entities.Artist.count(),
          base44.entities.Program.count(),
          base44.entities.Track.count(),
          base44.entities.ContactMessage.count(),
        ]);
        if (active) setCounts({ articles, artists, programs, tracks, messages });
      } catch {
        if (active) setCounts({});
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold">
        Hola{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Gestiona el contenido de SONORIA: publica artículos y actualiza artistas, programación e historial.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map(({ key, to, label, Icon, hint }) => (
          <Link
            key={key}
            to={to}
            className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/50"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/40">
                <Icon className="h-5 w-5 text-primary" />
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
            </div>
            <p className="mt-4 font-heading text-lg font-bold">{label}</p>
            <p className="text-sm text-muted-foreground">{hint}</p>
            <p className="mt-3 text-2xl font-extrabold">
              {counts === null ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                counts[key] ?? '—'
              )}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}