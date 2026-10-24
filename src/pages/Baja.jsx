import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';

// Página pública de baja de comunicaciones comerciales (enlace de los correos de marketing).
export default function Baja() {
  const [params] = useSearchParams();
  const token = params.get('t') || '';
  const [state, setState] = useState('loading'); // loading | ok | error

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await base44.functions.invoke('unsubscribeMarketing', { token });
        if (!cancelled) setState('ok');
      } catch {
        if (!cancelled) setState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-3xl font-bold">
        {state === 'loading' && 'Procesando tu baja…'}
        {state === 'ok' && 'Baja confirmada'}
        {state === 'error' && 'No hemos podido procesar la baja'}
      </h1>
      <p className="mt-4 text-muted-foreground">
        {state === 'ok' && 'No volverás a recibir comunicaciones comerciales de SONORIA FM. Disculpa las molestias.'}
        {state === 'error' &&
          'El enlace no es válido o ha caducado. Escríbenos a Oldestmanmusic@gmail.com con la palabra BAJA y lo gestionamos a mano.'}
      </p>
    </div>
  );
}
