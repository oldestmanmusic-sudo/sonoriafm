import { useRef, useState } from 'react';
import { inCooldown, looksLikeBot, markSent } from '@/lib/antiSpam';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Loader2, Send } from 'lucide-react';

const EMPTY = { name: '', email: '', subject: '', message: '' };

export default function ContactForm() {
  const [form, setForm] = useState(EMPTY);
  const [trap, setTrap] = useState('');
  const startedAt = useRef(Date.now());
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setError('Completa tu nombre, tu correo y tu mensaje.');
      return;
    }
    if (looksLikeBot({ honeypot: trap, startedAt: startedAt.current })) {
      // Se finge éxito para no dar pistas a los bots.
      setForm(EMPTY);
      setSent(true);
      return;
    }
    if (inCooldown('sonoria_last_contact')) {
      setError('Acabas de enviar un mensaje. Espera un minuto antes de enviar otro.');
      return;
    }
    setSending(true);
    try {
      await base44.entities.ContactMessage.create({
        name: form.name.trim().slice(0, 200),
        email: form.email.trim().slice(0, 200),
        subject: form.subject.trim().slice(0, 200),
        message: form.message.trim().slice(0, 3000),
      });
      markSent('sonoria_last_contact');
      setForm(EMPTY);
      setSent(true);
    } catch {
      setError('No pudimos enviar tu mensaje. Inténtalo de nuevo en unos minutos.');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-2xl border border-primary/40 bg-primary/5 p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
        <h3 className="mt-4 font-heading text-xl font-bold">¡Mensaje enviado!</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Gracias por escribirnos. El equipo de SONORIA FM te responderá lo antes posible.
        </p>
        <Button variant="outline" className="mt-6 rounded-full" onClick={() => setSent(false)}>
          Enviar otro mensaje
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-4">
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
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" value={form.name} onChange={update('name')} placeholder="Tu nombre" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Correo electrónico</Label>
          <Input id="email" type="email" value={form.email} onChange={update('email')} placeholder="tucorreo@email.com" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="subject">Asunto</Label>
        <Input id="subject" value={form.subject} onChange={update('subject')} placeholder="¿Sobre qué nos escribes?" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="message">Mensaje</Label>
        <Textarea
          id="message"
          value={form.message}
          onChange={update('message')}
          placeholder="Cuéntanos, te leemos…"
          rows={5}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={sending} className="w-full rounded-full sm:w-auto">
        {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
        {sending ? 'Enviando…' : 'Enviar mensaje'}
      </Button>
    </form>
  );
}