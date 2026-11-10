import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Loader2, Search, Pencil, Trash2, UserX, ShieldCheck, MailCheck, X, Users } from 'lucide-react';

const fmt = (d) => (d ? new Date(d).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '—');

export default function AdminUsers() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState(null);

  const call = async (payload) => {
    const res = await base44.functions.invoke('adminUsers', payload);
    if (res.data?.error) throw new Error(res.data.error);
    return res.data;
  };

  const load = async () => {
    setError('');
    try {
      const data = await call({ action: 'list' });
      setUsers(data.items || []);
    } catch (e) {
      setUsers([]);
      setError(e.message || 'No se pudieron cargar los usuarios.');
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!users) return null;
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter((u) => `${u.email} ${u.full_name || ''}`.toLowerCase().includes(s));
  }, [users, q]);

  const startEdit = (u) => {
    setEditing(u.id);
    setForm({
      full_name: u.full_name || '',
      role: u.role || 'user',
      is_verified: !!u.is_verified,
      disabled: !!u.disabled,
      disabled_reason: u.disabled_reason || '',
    });
    setError('');
  };

  const save = async (u) => {
    setBusy(true);
    setError('');
    try {
      await call({ action: 'update', id: u.id, data: form });
      setUsers((prev) => prev.map((r) => (r.id === u.id ? { ...r, ...form } : r)));
      setEditing(null);
    } catch (e) {
      setError(e.message || 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (u) => {
    setBusy(true);
    setError('');
    try {
      await call({ action: 'delete', id: u.id });
      setUsers((prev) => prev.filter((r) => r.id !== u.id));
      setConfirmId(null);
    } catch (e) {
      setError(e.message || 'No se pudo borrar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold">Usuarios</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Cuentas registradas en SONORIA FM. Edita el nombre, el rol o el estado, o bórralas si hace falta actuar a mano
        (por ejemplo, si alguien no puede entrar: verifica su correo o bórrale la cuenta para que se registre de nuevo).
      </p>

      <div className="relative mt-5">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por correo o nombre…"
          className="h-11 pl-10"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <div className="mt-5">
        {filtered === null ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-16 text-center">
            <Users className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No hay usuarios que coincidan.</p>
          </div>
        ) : (
          <>
            <p className="mb-2 text-xs text-muted-foreground">{filtered.length} usuario(s)</p>
            <ul className="space-y-3">
              {filtered.map((u) => {
                const isMe = me?.id === u.id;
                return (
                  <li key={u.id} className={cn('rounded-2xl border bg-card p-5', u.disabled ? 'border-destructive/40' : 'border-border')}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{u.full_name || '(sin nombre)'}{isMe && <span className="ml-2 text-xs font-normal text-muted-foreground">(tú)</span>}</p>
                        <p className="truncate text-sm text-primary">{u.email}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1', u.role === 'admin' ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground')}>
                            <ShieldCheck className="h-3 w-3" /> {u.role === 'admin' ? 'Administrador' : 'Usuario'}
                          </span>
                          <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1', u.is_verified ? 'bg-secondary text-muted-foreground' : 'bg-amber-500/15 text-amber-500')}>
                            <MailCheck className="h-3 w-3" /> {u.is_verified ? 'Correo verificado' : 'Sin verificar'}
                          </span>
                          {u.disabled && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-destructive">
                              <UserX className="h-3 w-3" /> Desactivada
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Alta: {fmt(u.created_date)} · Última actividad: {fmt(u.updated_date)}
                        </p>
                        {u.disabled && u.disabled_reason && (
                          <p className="mt-1 text-xs text-muted-foreground">Motivo: {u.disabled_reason}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button variant="ghost" size="icon" aria-label="Editar usuario" title="Editar" onClick={() => (editing === u.id ? setEditing(null) : startEdit(u))}>
                          {editing === u.id ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Borrar usuario"
                          title={isMe ? 'No puedes borrarte a ti mismo' : 'Borrar'}
                          disabled={isMe || busy}
                          onClick={() => setConfirmId(confirmId === u.id ? null : u.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {confirmId === u.id && (
                      <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
                        <p>
                          ¿Borrar la cuenta de <strong>{u.email}</strong>? Se elimina el usuario y podrá volver a registrarse con ese correo. No se puede deshacer.
                        </p>
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" variant="destructive" className="rounded-full" disabled={busy} onClick={() => remove(u)}>
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Sí, borrar
                          </Button>
                          <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setConfirmId(null)}>Cancelar</Button>
                        </div>
                      </div>
                    )}

                    {editing === u.id && (
                      <div className="mt-4 space-y-4 rounded-xl border border-border p-4">
                        <div className="space-y-2">
                          <Label htmlFor={`n-${u.id}`}>Nombre</Label>
                          <Input id={`n-${u.id}`} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`r-${u.id}`}>Rol</Label>
                          <select
                            id={`r-${u.id}`}
                            value={form.role}
                            disabled={isMe}
                            onChange={(e) => setForm({ ...form, role: e.target.value })}
                            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                          >
                            <option value="user">Usuario</option>
                            <option value="admin">Administrador</option>
                          </select>
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={form.is_verified} onChange={(e) => setForm({ ...form, is_verified: e.target.checked })} />
                          Correo verificado
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={form.disabled} disabled={isMe} onChange={(e) => setForm({ ...form, disabled: e.target.checked })} />
                          Cuenta desactivada (no podrá entrar)
                        </label>
                        {form.disabled && (
                          <div className="space-y-2">
                            <Label htmlFor={`d-${u.id}`}>Motivo (opcional)</Label>
                            <Input id={`d-${u.id}`} value={form.disabled_reason} onChange={(e) => setForm({ ...form, disabled_reason: e.target.value })} />
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button size="sm" className="rounded-full" disabled={busy} onClick={() => save(u)}>
                            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Guardar cambios
                          </Button>
                          <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setEditing(null)}>Cancelar</Button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
