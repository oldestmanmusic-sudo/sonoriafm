import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Mail, Trash2, Inbox } from 'lucide-react';

export default function AdminMessages() {
  const [messages, setMessages] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    try {
      const { items } = await base44.entities.ContactMessage.filter({}, { sort: '-created_date', limit: 100 });
      setMessages(items);
    } catch {
      setMessages([]);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    setBusyId(id);
    try {
      await base44.entities.ContactMessage.delete(id);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold">Mensajes</h1>
      <p className="mt-1 text-sm text-muted-foreground">Mensajes recibidos desde el formulario de contacto.</p>

      <div className="mt-6">
        {messages === null ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-16 text-center">
            <Inbox className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No hay mensajes todavía.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {messages.map((m) => (
              <li key={m.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{m.name}</p>
                    <a href={`mailto:${m.email}`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                      <Mail className="h-3.5 w-3.5" /> {m.email}
                    </a>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Eliminar mensaje"
                    onClick={() => handleDelete(m.id)}
                    disabled={busyId === m.id}
                    className="text-destructive hover:text-destructive"
                  >
                    {busyId === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </div>
                {m.subject && <p className="mt-3 text-sm font-medium">{m.subject}</p>}
                <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{m.message}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}