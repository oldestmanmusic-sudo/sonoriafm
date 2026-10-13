import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Image } from '@/components/ui/image';
import EntityForm from '@/components/admin/EntityForm';
import { Loader2, Plus, Pencil, Trash2, Search } from 'lucide-react';

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    try {
      return new Date(value).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return value;
    }
  }
  return String(value);
}

export default function EntityManager({
  entity,
  title,
  description,
  fields,
  primaryField,
  secondaryFields = [],
  thumbnailField,
  searchField,
  sort = '-created_date',
  emptyText = 'Aún no hay registros.',
  canCreate = true,
  canEdit = true,
  canDelete = true,
  defaults = {},
}) {
  const [items, setItems] = useState(null);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(
    async (term = '') => {
      const query = term && searchField ? { [searchField]: { $regex: term, $options: 'i' } } : {};
      try {
        const { items: rows } = await base44.entities[entity].filter(query, { sort, limit: 100 });
        setItems(rows);
      } catch {
        setItems([]);
      }
    },
    [entity, searchField, sort]
  );

  useEffect(() => { load(''); }, [load]);

  const openCreate = () => { setEditing(null); setOpen(true); };
  const openEdit = (item) => { setEditing(item); setOpen(true); };

  const handleSave = async (values) => {
    if (editing) {
      await base44.entities[entity].update(editing.id, values);
    } else {
      await base44.entities[entity].create(values);
    }
    setOpen(false);
    setEditing(null);
    await load(search);
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await base44.entities[entity].delete(toDelete.id);
      await load(search);
    } finally {
      setDeleting(false);
      setToDelete(null);
    }
  };

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {canCreate && (
          <Button onClick={openCreate} className="rounded-full shrink-0">
            <Plus className="mr-2 h-4 w-4" /> Nuevo
          </Button>
        )}
      </div>

      {searchField && (
        <div className="relative mt-5 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); load(e.target.value); }}
            placeholder="Buscar…"
            className="pl-9"
          />
        </div>
      )}

      <div className="mt-5">
        {items === null ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
            {emptyText}
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-4 rounded-2xl border border-border bg-card p-3 sm:p-4"
              >
                {thumbnailField && (
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-secondary">
                    {item[thumbnailField] ? (
                      <Image src={item[thumbnailField]} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-primary/30 to-accent/20" />
                    )}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{item[primaryField]}</p>
                  {secondaryFields.length > 0 && (
                    <p className="truncate text-sm text-muted-foreground">
                      {secondaryFields.map((f) => formatValue(item[f])).filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {canEdit && (
                    <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => openEdit(item)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Eliminar"
                      onClick={() => setToDelete(item)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Editar ${title.toLowerCase()}` : `Nuevo en ${title.toLowerCase()}`}</DialogTitle>
            <DialogDescription>
              {editing ? 'Modifica los campos y guarda los cambios.' : 'Rellena los campos para crear el registro.'}
            </DialogDescription>
          </DialogHeader>
          <EntityForm
            fields={fields}
            initialValues={editing || defaults}
            onSubmit={handleSave}
            onCancel={() => { setOpen(false); setEditing(null); }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(v) => { if (!v) setToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este registro?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará «{toDelete?.[primaryField]}» de forma permanente. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}