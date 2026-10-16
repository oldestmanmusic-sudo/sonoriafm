import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Lightbulb, Loader2, Send, CheckCircle2 } from 'lucide-react';

const CATEGORIES = ['Mejora', 'Fallo', 'Idea'];

export default function Sugerencias() {
  const [category, setCategory] = useState('Mejora');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) {
      setError('Cuéntanos qué quieres sugerir o arreglar.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await base44.entities.Suggestion.create({
        category,
        message: message.trim(),
      });
      setSent(true);
    } catch {
      setError('No se pudo enviar la sugerencia. Inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-20 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
        <h1 className="mt-4 font-heading text-3xl font-extrabold">¡Sugerencia recibida!</h1>
        <p className="mt-3 text-muted-foreground">
          Gracias por ayudarnos a mejorar SONORIA. El equipo la revisará en breve.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-2xl px-4 py-12">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/40">
        <Lightbulb className="h-6 w-6 text-primary" />
      </div>
      <h1 className="mt-4 font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">Sugerencias</h1>
      <p className="mt-2 text-muted-foreground">
        ¿Se te ocurre una mejora? ¿Algo falla o no funciona como debería? Cuéntanoslo y lo revisaremos.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5 rounded-3xl border border-border bg-card p-6 sm:p-8">
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="message">Tu sugerencia <span className="text-primary">*</span></Label>
          <Textarea
            id="message"
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe la mejora o el fallo: dónde pasa, qué esperabas, qué pasó…"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={submitting} className="w-full rounded-full">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {submitting ? 'Enviando…' : 'Enviar sugerencia'}
        </Button>
      </form>
    </section>
  );
}