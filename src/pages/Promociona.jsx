import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Star, PenLine, Repeat, Sparkles, ShieldCheck } from 'lucide-react';

const PRODUCTS = [
{
  id: 'destacado_semana',
  icon: Star,
  title: 'Artista destacado de la semana',
  price: '15 €',
  period: 'pago único',
  desc: "Tu nombre y tu m\xFAsica en un hueco protagonista de la portada durante siete d\xEDas. Plazas limitadas: un artista por semana."
},
{
  id: 'resena_entrevista',
  icon: PenLine,
  title: 'Reseña o entrevista en la web',
  price: '20 €',
  period: 'pago único',
  desc: 'Un artículo contando quién eres y qué llevas entre manos, publicado en Noticias.'
},
{
  id: 'rotacion_mensual',
  icon: Repeat,
  title: 'Más rotación de tu tema',
  price: '10 €/mes',
  period: 'suscripción mensual',
  desc: "Tu canci\xF3n suena hasta 3 veces m\xE1s en la programaci\xF3n."
}];


export default function Promociona() {
  const [artistName, setArtistName] = useState('');
  const [songTitle, setSongTitle] = useState('');
  const [loadingId, setLoadingId] = useState(null);
  const [formError, setFormError] = useState('');
  const [payError, setPayError] = useState('');

  const hire = async (productId) => {
    setFormError('');
    setPayError('');
    if (!artistName.trim() || !songTitle.trim()) {
      setFormError('Indica tu nombre artístico y el título de la canción para continuar.');
      return;
    }
    setLoadingId(productId);
    try {
      const res = await base44.functions.invoke('create-checkout', {
        productId,
        artistName: artistName.trim(),
        songTitle: songTitle.trim()
      });
      if (res?.data?.redirectUrl) {
        window.location.href = res.data.redirectUrl;
      } else {
        setPayError('No se pudo iniciar el pago. Inténtalo de nuevo.');
        setLoadingId(null);
      }
    } catch (e) {
      setPayError(e?.response?.data?.error || 'No se pudo iniciar el pago. Inténtalo de nuevo.');
      setLoadingId(null);
    }
  };

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
      <div className="text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
          <Sparkles className="h-3.5 w-3.5" /> Servicios para artistas
        </span>
        <h1 className="mt-4 font-heading text-4xl sm:text-5xl font-extrabold tracking-tighter">Promociona tu música</h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Contrata un extra para llevar tu canción más lejos en Sonoria FM. Pago seguro y contacto directo contigo para prepararlo todo.
        </p>
      </div>

      <div className="mx-auto mt-10 max-w-md rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-semibold">Sobre quién es la promoción</p>
        <div className="mt-4 grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="artist-name">Nombre artístico</Label>
            <Input
              id="artist-name"
              value={artistName}
              onChange={(e) => setArtistName(e.target.value)}
              placeholder="Ej. INERT.IA"
              maxLength={100} />
            
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="song-title">Título de la canción</Label>
            <Input
              id="song-title"
              value={songTitle}
              onChange={(e) => setSongTitle(e.target.value)}
              placeholder="Ej. mi nuevo single"
              maxLength={150} />
            
          </div>
        </div>
        {formError && <p className="mt-3 text-sm text-destructive">{formError}</p>}
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {PRODUCTS.map((p) => {
          const Icon = p.icon;
          return (
            <div key={p.id} className="flex flex-col rounded-2xl border border-border bg-card p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/40">
                <Icon className="h-5 w-5 text-primary" />
              </span>
              <h2 className="mt-4 font-heading text-lg font-bold leading-snug">{p.title}</h2>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{p.desc}</p>
              <p className="mt-4">
                <span className="font-heading text-2xl font-extrabold">{p.price}</span>
                <span className="ml-1 text-xs text-muted-foreground">{p.period}</span>
              </p>
              <Button
                onClick={() => hire(p.id)}
                disabled={loadingId !== null}
                className="mt-5 w-full rounded-full">
                
                {loadingId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {loadingId === p.id ? 'Abriendo pago...' : 'Contratar'}
              </Button>
            </div>);

        })}
      </div>

      {payError && <p className="mt-6 text-center text-sm text-destructive">{payError}</p>}

      <p className="mt-10 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-accent" /> Pago seguro gestionado por la pasarela oficial. Te contactaremos por email tras el pago.
      </p>
    </section>);

}