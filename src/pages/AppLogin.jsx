import { useEffect, useState } from 'react';

// Puente entre el inicio de sesión de la web (Google) y la app de Android: la app abre
// /api/apps/auth/login con from_url=/app-login; al volver, el token ya está guardado
// y se le entrega a la app con un enlace sonoriafm://login.
export default function AppLogin() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let token = null;
    try {
      token = window.localStorage.getItem('base44_access_token');
    } catch {
      token = null;
    }
    if (token) {
      window.location.href = `sonoriafm://login?token=${encodeURIComponent(token)}`;
    } else {
      setFailed(true);
    }
  }, []);

  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="font-heading text-2xl font-bold">SONORIA FM</h1>
      {failed ? (
        <p className="mt-3 text-muted-foreground">
          No se ha podido completar el inicio de sesión. Vuelve a la app e inténtalo otra vez.
        </p>
      ) : (
        <p className="mt-3 text-muted-foreground">Volviendo a la app…</p>
      )}
    </div>
  );
}
