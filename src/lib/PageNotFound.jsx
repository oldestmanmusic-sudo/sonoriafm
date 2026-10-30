import { Link, useLocation } from 'react-router-dom';
import { Radio } from 'lucide-react';

export default function PageNotFound() {
  const { pathname } = useLocation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <div className="w-full max-w-md space-y-6 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/40">
          <Radio className="h-7 w-7 text-primary" />
        </span>
        <div className="space-y-2">
          <h1 className="font-heading text-6xl font-extrabold tracking-tight">404</h1>
          <h2 className="text-2xl font-semibold">Esta página no existe</h2>
          <p className="break-words text-muted-foreground">
            No encontramos <span className="font-medium text-foreground">{pathname}</span>. Puede que el enlace haya cambiado o esté mal escrito.
          </p>
        </div>
        <Link
          to="/"
          className="inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Volver a la radio
        </Link>
      </div>
    </div>
  );
}
