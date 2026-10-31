import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cookie } from 'lucide-react';

const KEY = 'sonoria_cookie_notice';

// Aviso informativo: la web solo usa cookies técnicas. Si algún día se añade analítica o
// publicidad, aquí habrá que pedir consentimiento (Aceptar / Rechazar) antes de cargarlas.
export default function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const close = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* sin almacenamiento: se mostrará de nuevo */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Aviso de cookies"
      className="fixed inset-x-3 bottom-24 z-50 mx-auto max-w-xl rounded-2xl border border-border bg-card p-4 shadow-2xl sm:bottom-6"
    >
      <div className="flex items-start gap-3">
        <Cookie className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <p className="text-sm text-muted-foreground">
          Usamos solo cookies técnicas necesarias para que la web funcione (sesión y seguridad). No usamos analítica ni
          publicidad. Más información en la{' '}
          <Link to="/cookies" className="text-primary hover:underline">Política de Cookies</Link> y la{' '}
          <Link to="/privacidad" className="text-primary hover:underline">Política de Privacidad</Link>.
        </p>
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={close}
          className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
