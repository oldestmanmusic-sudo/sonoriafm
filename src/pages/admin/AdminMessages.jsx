import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Loader2, Mail, Trash2, Inbox, Reply, Archive, ArchiveRestore, ChevronDown } from 'lucide-react';

const TABS = [
  { key: 'inbox', label: 'Recibidos' },
  { key: 'archived', label: 'Archivados' },
];

export default function AdminMessages() {
  const [tab, setTab] = useState('inbox');
  const [messages, setMessages] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [replyFor, setReplyFor] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyDone, setReplyDone] = useState({});
  const [open, setOpen] = useState({});

  const load = async () => {
    setMessages(null);
    try {
      const { items } = await base44.entities.ContactMessage.filter(
        { archived: tab === 'archived' },
        { sort: '-created_date', limit: 100 }
      );
      setMessages(items);
    } catch {
      setMessages([]);
    }
  };

  useEffect(() => { load(); }, [tab]);

  // Leer un mensaje lo marca como leído y lo archiva automáticamente.
  const toggleOpen = async (m) => {
    const isOpen = !!open[m.id];
    setOpen((prev) => ({ ...prev, [m.id]: !isOpen }));
    if (!isOpen && !m.read) {
      await base44.entities.ContactMessage.update(m.id, { read: true, archived: true }).catch(() => {});
      setMessages((prev) => prev.map((r) => (r.id === m.id ? { ...r, read: true, archived: true } : r)));
    }
  };

  const setArchived = async (m, archived) => {
    setBusyId(m.id);
    try {
      await base44.entities.ContactMessage.update(m.id, { archived, read: archived ? m.read : false });
      setMessages((prev) => prev.filter((r) => r.id !== m.id));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id) => {
    setBusyId(id);
    try {
      await base44.entities.ContactMessage.delete(id);
      setMessages((prev) => prev.filter((r) => r.id !== id));
    } finally {
      setBusyId(null);
    }
  };

  const sendReply = async (m) => {
    if (!replyText.trim()) return;
    setReplyBusy(true);
    try {
      const res = await base44.functions.invoke('sendContactReply', { message_id: m.id, reply: replyText.trim() });
      if (res.data?.ok) {
        setReplyDone((prev) => ({ ...prev, [m.id]: true }));
        setReplyFor(null);
        setReplyText('');
        if (!m.read) {
          await base44.entities.ContactMessage.update(m.id, { read: true, archived: true }).catch(() => {});
        }
      }
    } finally {
      setReplyBusy(false);
    }
  };

  const toggleReply = (m) => {
    setReplyFor(replyFor === m.id ? null : m.id);
    setReplyText('');
  };

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold">Mensajes</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Mensajes recibidos desde el formulario de contacto. Los leídos se marcan y se archivan automáticamente.
      </p>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              'shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
              tab === t.key
                ? 'border-primary bg-primary/15 text-primary'
                : 'border-border text-muted-foreground hover:bg-secondary hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {messages === null ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-16 text-center">
            <Inbox className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No hay mensajes en esta bandeja.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {messages.map((m) => (
              <li key={m.id} className={cn('rounded-2xl border bg-card p-5', m.read ? 'border-border' : 'border-primary/40')}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => toggleOpen(m)}
                    className="flex min-w-0 flex-1 items-start gap-2 text-left"
                  >
                    {!m.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                    <div className="min-w-0">
                      <p className={cn('truncate font-semibold', !m.read && 'text-foreground')}>{m.name}</p>
                      <a
                        href={`mailto:${m.email}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        <Mail className="h-3.5 w-3.5" /> {m.email}
                      </a>
                      {m.subject && <p className="mt-1 truncate text-sm font-medium">{m.subject}</p>}
                      {!open[m.id] && <p className="mt-1 truncate text-sm text-muted-foreground">{m.message}</p>}
                    </div>
                    <ChevronDown className={cn('ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform', open[m.id] && 'rotate-180')} />
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Contestar"
                      title="Contestar"
                      onClick={() => toggleReply(m)}
                      className="text-primary hover:text-primary"
                    >
                      <Reply className="h-4 w-4" />
                    </Button>
                    {tab === 'inbox' ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Archivar"
                        title="Archivar"
                        disabled={busyId === m.id}
                        onClick={() => setArchived(m, true)}
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Desarchivar"
                        title="Desarchivar"
                        disabled={busyId === m.id}
                        onClick={() => setArchived(m, false)}
                      >
                        <ArchiveRestore className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Eliminar mensaje"
                      disabled={busyId === m.id}
                      onClick={() => handleDelete(m.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      {busyId === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {open[m.id] && <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{m.message}</p>}
                {replyDone[m.id] && (
                  <p className="mt-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">Respuesta enviada</p>
                )}

                {replyFor === m.id && (
                  <div className="mt-3">
                    <Textarea
                      rows={4}
                      placeholder="Escribe tu respuesta… se enviará por correo a quien contactó."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                    />
                    <div className="mt-2 flex items-center gap-2">
                      <Button size="sm" className="rounded-full" disabled={replyBusy || !replyText.trim()} onClick={() => sendReply(m)}>
                        {replyBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Reply className="h-4 w-4" />} Enviar respuesta
                      </Button>
                      <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setReplyFor(null)}>Cancelar</Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}