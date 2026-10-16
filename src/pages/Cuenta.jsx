import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Loader2, ShieldAlert, Trash2, UserRound } from 'lucide-react';

export default function Cuenta() {
  const [user, setUser] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    base44.auth.me().then((u) => { if (active) setUser(u); }).catch(() => {});
    return () => { active = false; };
  }, []);

  const deleteAccount = async () => {
    setDeleting(true);
    setError('');
    try {
      await base44.functions.invoke('deleteMyAccount', {});
      await base44.auth.logout('/');
    } catch (e) {
      setError(
        String(e?.message || '').includes('owner')
          ? 'El propietario de la app no puede eliminar su propia cuenta.'
          : 'No se pudo eliminar la cuenta. Inténtalo de nuevo.'
      );
      setDeleting(false);
    }
  };

  if (!user) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="font-heading text-3xl font-extrabold tracking-tight">Mi cuenta</h1>
      <p className="mt-2 text-muted-foreground">Datos de tu sesión en SONORIA.</p>

      <div className="mt-8 flex items-center gap-4 rounded-3xl border border-border bg-card p-6">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/40">
          <UserRound className="h-6 w-6 text-primary" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold">{user.full_name || 'Usuario de SONORIA'}</p>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
        </div>
      </div>

      <div className="mt-8 rounded-3xl border border-destructive/40 bg-destructive/5 p-6">
        <div className="flex items-center gap-2 text-destructive">
          <ShieldAlert className="h-5 w-5" />
          <h2 className="font-heading text-lg font-bold">Zona de riesgo</h2>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Al eliminar tu cuenta se borran permanentemente tu perfil y tus datos asociados (envíos de canciones y mensajes de contacto). Esta acción no se puede deshacer.
        </p>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="mt-5 rounded-full" disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Eliminar mi cuenta
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar tu cuenta definitivamente?</AlertDialogTitle>
              <AlertDialogDescription>
                Perderás el acceso a SONORIA y se eliminarán tu perfil y tus datos asociados. Esta acción es irreversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={deleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Sí, eliminar mi cuenta
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </section>
  );
}