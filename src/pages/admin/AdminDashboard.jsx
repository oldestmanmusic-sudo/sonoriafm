import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Loader2, Newspaper, Users, CalendarClock, History, Mail, Inbox, ArrowRight, Send, CheckCircle2 } from 'lucide-react';

const SECTIONS = [
  { key: 'articles', to: '/admin/articulos', label: 'Artículos', Icon: Newspaper, hint: 'Publica y edita noticias' },
  { key: 'artists', to: '/admin/artistas', label: 'Artistas', Icon: Users, hint: 'Perfiles destacados' },
  { key: 'programs', to: '/admin/programacion', label: 'Programación', Icon: CalendarClock, hint: 'Parrilla semanal' },
  { key: 'tracks', to: '/admin/historial', label: 'Historial', Icon: History, hint: 'Temas emitidos' },
  { key: 'messages', to: '/admin/mensajes', label: 'Mensajes', Icon: Mail, hint: 'Contacto recibido' },
  { key: 'submissions', to: '/admin/envios', label: 'Envíos', Icon: Inbox, hint: 'Canciones pendientes' },
];

export default function AdminDashboard() {
  const { user } = useAuth();
  const [counts, setCounts] = useState(null);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  const notifyAbandoned = async () => {
    setSending(true);
    setSendResult(null);
    try {
      const res = await base44.functions.invoke('notifyAbandonedCheckouts', {});
      setSendResult(res.data);
    } catch (e) {
      setSendResult({ error: e?.response?.data?.error || 'No se pudo enviar el aviso.' });
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [articles, artists, programs, tracks, messages, submissions] = await Promise.all([
          base44.entities.Article.count(),
          base44.entities.Artist.count(),
          base44.entities.Program.count(),
          base44.entities.Track.count(),
          base44.entities.ContactMessage.count(),
          base44.entities.Submission.count({ status: 'pending' }),
        ]);
        if (active) setCounts({ articles, artists, programs, tracks, messages, submissions });
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
        Gestiona el contenido de SONORIA FM: publica artículos y actualiza artistas, programación e historial.
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

      <div className="mt-6 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-heading text-lg font-bold">Reenviar aviso a pagos incompletos</p>
            <p className="text-sm text-muted-foreground">
              Envía un correo a quienes iniciaron una donación o servicio y no terminaron el pago, para avisarles de que la pasarela ya funciona.
            </p>
          </div>
          <button
            type="button"
            onClick={notifyAbandoned}
            disabled={sending}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? 'Enviando…' : 'Enviar aviso'}
          </button>
        </div>
        {sendResult && !sendResult.error && (
          <p className="mt-3 flex items-center gap-2 text-sm text-primary">
            <CheckCircle2 className="h-4 w-4" />
            {sendResult.sent
              ? `Aviso enviado a ${sendResult.sent} ${sendResult.sent === 1 ? 'destinatario' : 'destinatarios'}.`
              : 'No hay pagos incompletos con email conocido para avisar.'}
          </p>
        )}
        {sendResult?.error && (
          <p className="mt-3 text-sm text-destructive">{sendResult.error}</p>
        )}
      </div>
    </div>
  );
}