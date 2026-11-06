import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

const FIELDS = ['artist_name','email','song_title','genre','genre_other','language','audio_link','cover_url','artist_image_url','artist_bio','description','tool','lyrics','confirmed','terms_accepted','terms_accepted_at'];
const PENDING_KEY = 'sonoria_pending_submission';

// Cuando un artista se registra (o inicia sesión) después de haber subido su
// canción sin cuenta, el envío guardado se convierte en un envío propio.
// Funciona en cualquier página y desde cualquier dispositivo (por email o token).
export default function ClaimPendingSubmission() {
  const { isAuthenticated } = useAuth();
  const running = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || running.current) return;
    running.current = true;
    (async () => {
      try {
        let token = '';
        try { token = localStorage.getItem(PENDING_KEY) || ''; } catch { /* sin almacenamiento */ }
        const res = await base44.functions.invoke('claimPendingSubmission', { token });
        const items = res?.data?.items || res?.items || [];
        for (const p of items) {
          const fields = Object.fromEntries(FIELDS.map((k) => [k, p[k]]).filter(([, v]) => v !== undefined && v !== null));
          await base44.entities.Submission.create(fields);
        }
        try { localStorage.removeItem(PENDING_KEY); } catch { /* nada */ }
        if (items.length) window.location.assign('/envia-tu-cancion?enviada=1');
      } catch {
        /* sin envíos pendientes o error: no molestamos al usuario */
      } finally {
        running.current = false;
      }
    })();
  }, [isAuthenticated]);

  return null;
}
