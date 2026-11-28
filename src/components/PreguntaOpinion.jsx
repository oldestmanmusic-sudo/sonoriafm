import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { inCooldown, looksLikeBot, markSent } from '@/lib/antiSpam';

// No sale nada más entrar: primero se deja escuchar la radio. Aparece tras unos minutos en la
// web, como mucho una vez cada 30 días, y nunca más a quien ya ha respondido.
const SEEN_KEY = 'sonoria_opinion_vista_at';
const SENT_KEY = 'sonoria_opinion_enviada';
const COOLDOWN_KEY = 'sonoria_last_suggestion';
const DELAY_MS = 3 * 60 * 1000;
const REASK_MS = 30 * 24 * 3600 * 1000;
let seenInMemory = false;

function shouldAsk() {
  if (seenInMemory) return false;
  try {
    if (window.localStorage.getItem(SENT_KEY)) return false;
    const seenAt = Number(window.localStorage.getItem(SEEN_KEY)) || 0;
    return Date.now() - seenAt > REASK_MS;
  } catch {
    return false;
  }
}

function remember(storage, key, value = '1') {
  try { window[storage].setItem(key, value); } catch { /* sin almacenamiento */ }
}

/** Tras unos minutos en la web, pregunta qué echa en falta el visitante. Las respuestas llegan a Sugerencias. */
export default function PreguntaOpinion() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [trap, setTrap] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const openedAt = useRef(0);
  // Quien entra para darse de baja del correo no necesita preguntas.
  const skip = pathname.startsWith('/baja');

  useEffect(() => {
    if (skip || !shouldAsk()) return undefined;
    const timer = setTimeout(() => {
      seenInMemory = true;
      remember('localStorage', SEEN_KEY, String(Date.now()));
      openedAt.current = Date.now();
      setOpen(true);
    }, DELAY_MS);
    return () => clearTimeout(timer);
  }, [skip]);

  const thank = () => {
    remember('localStorage', SENT_KEY);
    setOpen(false);
    toast({ title: '¡Gracias!', description: 'Hemos recibido tu respuesta.', duration: 5000 });
  };

  const submit = async (e) => {
    e.preventDefault();
    const text = message.trim();
    if (!text || sending) return;
    if (looksLikeBot({ honeypot: trap, startedAt: openedAt.current })) {
      if (trap) setOpen(false);
      else setError('Espera un par de segundos y vuelve a pulsar ENVIAR.');
      return;
    }
    if (inCooldown(COOLDOWN_KEY)) {
      setError('Acabas de enviar un mensaje. Espera un minuto antes de enviar otro.');
      return;
    }
    setSending(true);
    setError('');
    try {
      await base44.entities.Suggestion.create({ category: 'Idea', message: text.slice(0, 2000) });
      markSent(COOLDOWN_KEY);
      thank();
    } catch {
      setError('No se ha podido enviar. Inténtalo de nuevo.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="w-[calc(100%-2rem)] max-w-md rounded-2xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
        // Un toque fuera no cierra la ventana: así no se pierde lo escrito.
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="pr-4 text-xl leading-snug">
            ¿Echas algo en falta en SONORIA FM?
          </DialogTitle>
          <DialogDescription>Cuéntanos qué te gustaría encontrar en la radio. Lo leemos todo.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={trap}
            onChange={(e) => setTrap(e.target.value)}
            className="absolute left-[-9999px] h-0 w-0 opacity-0"
          />
          <Textarea
            rows={5}
            maxLength={2000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Escribe aquí tu respuesta…"
            aria-label="Tu respuesta"
            className="text-base"
          />
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Button type="button" variant="outline" className="rounded-full font-bold" onClick={() => setOpen(false)}>
              CANCELAR
            </Button>
            <Button type="submit" className="rounded-full font-bold" disabled={!message.trim() || sending}>
              {sending ? 'ENVIANDO…' : 'ENVIAR'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
