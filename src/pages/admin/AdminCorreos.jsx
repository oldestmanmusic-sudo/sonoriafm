import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Loader2, AtSign, Copy, Trash2, Inbox, UserMinus } from 'lucide-react';

export default function AdminCorreos() {
  const [items, setItems] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const { items: rows } = await base44.entities.Subscriber.filter({}, { sort: '-created_date', limit: 500 });
      setItems(rows);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (item, fn) => {
    setBusyId(item.id);
    try {
      await fn();
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const active = (items ?? []).filter((s) => s.status !== 'baja');

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(active.map((s) => s.email).join(', '));
      toast({ title: 'Correos copiados', description: 'Pégalos siempre en copia oculta (CCO).', duration: 5000 });
    } catch {
      toast({ title: 'No se ha podido copiar', duration: 4000 });
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/40">
          <AtSign className="h-5 w-5 text-primary" />
        </span>
        <div>
          <h1 className="font-heading text-2xl font-bold">Correos de oyentes</h1>
          <p className="text-sm text-muted-foreground">
            Los dejan voluntariamente después de votar. No están verificados. Si escribes, usa copia oculta e indica cómo darse de baja.
          </p>
        </div>
      </div>

      {active.length > 0 && (
        <Button className="mt-5 rounded-full" onClick={copyAll}>
          <Copy className="h-4 w-4" /> Copiar {active.length} {active.length === 1 ? 'correo activo' : 'correos activos'}
        </Button>
      )}

      <div className="mt-5 space-y-3">
        {items === null ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
            <Inbox className="mx-auto mb-2 h-6 w-6" />
            Todavía no hay ningún correo.
          </p>
        ) : (
          items.map((s) => (
            <article key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
              <div className="min-w-0">
                <p className="break-all text-sm font-medium">{s.email}</p>
                <p className="text-xs text-muted-foreground">{s.day}{s.status === 'baja' ? ' · de baja' : ''}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {s.status !== 'baja' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    disabled={busyId === s.id}
                    onClick={() => act(s, () => base44.entities.Subscriber.update(s.id, { status: 'baja' }))}
                  >
                    <UserMinus className="h-4 w-4" /> Dar de baja
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full text-destructive hover:text-destructive"
                  aria-label={`Borrar ${s.email}`}
                  disabled={busyId === s.id}
                  onClick={() => {
                    if (window.confirm(`¿Borrar ${s.email}?`)) act(s, () => base44.entities.Subscriber.delete(s.id));
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
