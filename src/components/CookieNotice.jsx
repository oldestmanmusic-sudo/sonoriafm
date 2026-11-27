import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cookie } from 'lucide-react';
import { SETTINGS_EVENT, getConsent, setConsent } from '@/lib/consent';

// Mismo peso visual en los dos botones: rechazar es tan fácil como aceptar.
const BUTTON =
  'flex-1 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 sm:flex-none sm:min-w-32';

export default function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!getConsent()) setVisible(true);
    const open = () => setVisible(true);
    window.addEventListener(SETTINGS_EVENT, open);
    return () => window.removeEventListener(SETTINGS_EVENT, open);
  }, []);

  const choose = (value) => {
    setConsent(value);
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
          Usamos cookies técnicas necesarias para que la web funcione. Si las aceptas, usamos también cookies de
          estadísticas para saber cuántas visitas tenemos y de dónde llegan. No hay publicidad. Más información en la{' '}
          <Link to="/cookies" className="text-primary hover:underline">Política de Cookies</Link> y la{' '}
          <Link to="/privacidad" className="text-primary hover:underline">Política de Privacidad</Link>.
        </p>
      </div>
      <div className="mt-3 flex gap-2 sm:justify-end">
        <button type="button" onClick={() => choose('denied')} className={BUTTON}>
          Rechazar
        </button>
        <button type="button" onClick={() => choose('granted')} className={BUTTON}>
          Aceptar
        </button>
      </div>
    </div>
  );
}
