import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Loader2, Lightbulb, Check, Trash2, Inbox } from 'lucide-react';

const TABS = [
  { key: 'nueva', label: 'Nuevas' },
  { key: 'revisada', label: 'Revisadas' },
];

export default function AdminSuggestions() {
  const [status, setStatus] = useState('nueva');
  const [items, setItems] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setItems(null);
    try {
      const { items: rows } = await base44.entities.Suggestion.filter({ status }, { sort: '-created_date', limit: 100 });
      setItems(rows);
    } catch {
      setItems([]);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const markReviewed = async (item) => {
    setBusyId(item.id);
    try {
      await base44.entities.Suggestion.update(item.id, { status: 'revisada' });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (item) => {
    setBusyId(item.id);
    try {
      await base44.entities.Suggestion.delete(item.id);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/40">
          <Lightbulb className="h-5 w-5 text-primary" />
        </span>
        <div>
          <h1 className="font-heading text-2xl font-bold">Sugerencias</h1>
          <p className="text-sm text-muted-foreground">Mejoras e incidencias que envían los usuarios.</p>
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setStatus(t.key)}
            className={cn(
              'rounded-full border px-4 py-2 text-sm font-medium transition-colors',
              status === t.key
                ? 'border-primary bg-primary/15 text-primary'
                : 'border-border text-muted-foreground hover:bg-secondary hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {items === null ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
            <Inbox className="mx-auto mb-2 h-6 w-6" />
            No hay sugerencias en esta bandeja.
          </p>
        ) : (
          items.map((s) => (
            <article key={s.id} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="inline-block rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
                    {s.category || 'Mejora'}
                  </span>
                  <p className="mt-2 whitespace-pre-line text-sm">{s.message}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{s.created_date}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    disabled={busyId === s.id}
                    onClick={() => markReviewed(s)}
                  >
                    <Check className="h-4 w-4" /> Revisada
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full text-destructive hover:text-destructive"
                    disabled={busyId === s.id}
                    onClick={() => remove(s)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}