import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Heart, Loader2 } from 'lucide-react';

const PRESETS = [3, 5, 10, 20];

export default function Donar() {
  const [amount, setAmount] = useState(5);
  const [custom, setCustom] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const choose = (v) => {
    setAmount(v);
    setCustom('');
    setError('');
  };

  const onCustom = (v) => {
    setCustom(v);
    const n = parseFloat(v.replace(',', '.'));
    setAmount(Number.isFinite(n) ? n : 0);
    setError('');
  };

  const donate = async () => {
    setError('');
    if (!(amount >= 0.5)) {
      setError('El importe mínimo es 0,50 €.');
      return;
    }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('create-checkout', { productId: 'donation', amount });
      // Axios response: el enlace de pago llega en data.redirectUrl
      window.location.href = res.data.redirectUrl;
    } catch {
      setError('No se pudo iniciar el pago. Inténtalo de nuevo.');
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto max-w-xl px-4 py-12">
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-10 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Heart className="h-7 w-7 text-primary" />
        </div>
        <h1 className="mt-4 font-heading text-3xl font-extrabold tracking-tight">Apoya SONORIA FM</h1>
        <p className="mt-3 text-muted-foreground">
          SONORIA FM es una radio libre e independiente. Con tu donación seguimos descubriendo artistas y emitiendo música 24/7. Cada euro cuenta.
        </p>

        <div className="mt-8 grid grid-cols-4 gap-2">
          {PRESETS.map((v) => (
            <Button
              key={v}
              type="button"
              variant={amount === v && !custom ? 'default' : 'outline'}
              onClick={() => choose(v)}
              className="rounded-full"
            >
              {v} €
            </Button>
          ))}
        </div>

        <div className="mt-4 space-y-2 text-left">
          <Label htmlFor="amount">O elige tu importe (mín. 0,50 €)</Label>
          <div className="relative">
            <Input
              id="amount"
              type="number"
              min="0.5"
              step="0.01"
              inputMode="decimal"
              value={custom}
              onChange={(e) => onCustom(e.target.value)}
              placeholder="Otro importe"
              className="pr-8"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

        <Button type="button" onClick={donate} disabled={loading} className="mt-6 w-full rounded-full text-base">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Heart className="h-5 w-5" />}
          {loading ? 'Conectando con el pago…' : `Donar ${amount >= 0.5 ? amount.toFixed(2).replace('.', ',') : ''} €`}
        </Button>

        <p className="mt-4 text-xs text-muted-foreground">
          Pago seguro con tarjeta. Al finalizar vuelves automáticamente a SONORIA FM.
        </p>
      </div>
    </section>
  );
}