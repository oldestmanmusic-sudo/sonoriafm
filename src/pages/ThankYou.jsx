import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { HeartHandshake } from 'lucide-react';

export default function ThankYou() {
  return (
    <section className="mx-auto max-w-xl px-4 py-20 text-center">
      <div className="rounded-3xl border border-border bg-card p-8 sm:p-12">
        <HeartHandshake className="mx-auto h-14 w-14 text-primary" />
        <h1 className="mt-4 font-heading text-3xl font-extrabold tracking-tight">¡Gracias de corazón!</h1>
        <p className="mt-3 text-muted-foreground">
          Tu pago ya está registrado. Si contrataste un servicio de promoción, te escribimos en breve por email para prepararlo; si fue una donación, hace posible que SONORIA siga emitiendo música independiente las 24 horas.
        </p>
        <Link to="/" className="mt-8 inline-block">
          <Button className="rounded-full">Volver a la radio</Button>
        </Link>
      </div>
    </section>
  );
}