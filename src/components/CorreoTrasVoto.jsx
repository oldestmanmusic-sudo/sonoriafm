import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/use-toast';
import { CONSENT_TEXT } from '@/lib/consent';
import { ASK_EMAIL_EVENT } from '@/lib/useTrackLike';

// Se pregunta una sola vez por dispositivo.
const ASKED_KEY = 'sonoria_correo_pedido';
let askedInMemory = false;

function alreadyAsked() {
  try {
    if (window.localStorage.getItem(ASKED_KEY)) return true;
  } catch { /* almacenamiento bloqueado */ }
  return askedInMemory;
}

function rememberAsked() {
  askedInMemory = true;
  try { window.localStorage.setItem(ASKED_KEY, '1'); } catch { /* se queda en memoria */ }
}

/** Después de votar sin cuenta, ofrece (sin obligar) dejar el correo para recibir novedades. */
export default function CorreoTrasVoto() {
  const [vote, setVote] = useState(null);
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onAsk = (e) => {
      if (alreadyAsked()) return;
      rememberAsked();
      setVote(e.detail);
    };
    window.addEventListener(ASK_EMAIL_EVENT, onAsk);
    return () => window.removeEventListener(ASK_EMAIL_EVENT, onAsk);
  }, []);

  const valid = /^\S+@\S+\.\S{2,}$/.test(email.trim()) && consent;

  const submit = async (e) => {
    e.preventDefault();
    if (!valid || sending) return;
    setSending(true);
    setError('');
    try {
      await base44.functions.invoke('subscribeListener', {
        email: email.trim(), consent: true, did: vote.did, trackId: vote.trackId,
      });
      setVote(null);
      toast({ title: 'Correo guardado', description: '¡Gracias por escuchar SONORIA FM!', duration: 5000 });
    } catch (err) {
      const status = err?.response?.status ?? err?.status;
      setError(status === 400 ? 'Revisa tu correo.' : 'No se ha podido guardar. Prueba más tarde.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={Boolean(vote)} onOpenChange={(open) => { if (!open) setVote(null); }}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>¡Voto contado!</DialogTitle>
          <DialogDescription>
            Si quieres, déjanos tu correo y te contaremos las novedades y el TOP de la semana. Es opcional: tu voto ya cuenta.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          <Input
            type="email"
            autoComplete="email"
            placeholder="Tu correo electrónico"
            aria-label="Tu correo electrónico"
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label className="flex items-start gap-3 text-sm">
            <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
            <span>{CONSENT_TEXT}</span>
          </label>
          <p className="text-xs text-muted-foreground">
            Responsable: SONORIA FM. Solo usaremos tu correo para eso. Más información en la{' '}
            <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Política de Privacidad
            </a>.
          </p>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button type="submit" className="rounded-full" disabled={!valid || sending}>
              {sending ? 'Guardando…' : 'Guardar mi correo'}
            </Button>
            <Button type="button" variant="ghost" className="rounded-full" onClick={() => setVote(null)}>
              No, gracias
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
