import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Car, Check, Copy, Download, Heart, Loader2, MessageCircle, Radio, Share2, Smartphone } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { APK_URL, APP_PAGE_URL, APP_SHARE_TEXT, SUPPORT_AMOUNT, detectDevice } from '@/lib/appDownload';

const card = 'rounded-2xl border border-border bg-card p-6';
const supportLabel = `${SUPPORT_AMOUNT.toFixed(2).replace('.', ',')} €`;

function Steps({ items }) {
  return (
    <ol className="mt-4 space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
            {i + 1}
          </span>
          <span className="pt-0.5 text-sm leading-relaxed">{item}</span>
        </li>
      ))}
    </ol>
  );
}

function AndroidSection() {
  return (
    <section className={card}>
      <h2 className="flex items-center gap-2 font-heading text-xl font-bold">
        <Smartphone className="h-5 w-5 text-primary" /> Cómo instalarla en Android
      </h2>
      <Steps
        items={[
          <>Pulsa <strong>Descargar para Android</strong>. Como no viene de Google Play, el navegador puede avisarte: elige <strong>Descargar de todos modos</strong>.</>,
          <>Abre el archivo <strong>SONORIA-FM.apk</strong> (en el aviso de descarga o en la carpeta Descargas).</>,
          <>La primera vez el móvil te pedirá permiso: pulsa <strong>Ajustes</strong>, activa <strong>Permitir desde esta fuente</strong> y vuelve atrás.</>,
          <>Pulsa <strong>Instalar</strong> y después <strong>Abrir</strong>. ¡Ya suena!</>,
        ]}
      />
      <p className="mt-4 text-xs text-muted-foreground">
        Necesitas Android 8 o superior. Cuando haya una versión nueva, la propia app te avisa con el botón «Actualizar».
        Si tu móvil no deja instalar apps de fuera de la tienda, puedes escuchar la radio desde la web sin instalar nada.
      </p>
    </section>
  );
}

function IosSection() {
  return (
    <section className={card}>
      <h2 className="flex items-center gap-2 font-heading text-xl font-bold">
        <Smartphone className="h-5 w-5 text-primary" /> En iPhone y iPad
      </h2>
      <p className="mt-3 text-sm text-muted-foreground">No hay que descargar nada. Pon un acceso directo en tu pantalla de inicio:</p>
      <Steps
        items={[
          <>Abre <strong>sonoriafm.com</strong> en <strong>Safari</strong>.</>,
          <>Pulsa el botón <strong>Compartir</strong> (el cuadrado con una flecha hacia arriba).</>,
          <>Elige <strong>Añadir a pantalla de inicio</strong> y confirma con <strong>Añadir</strong>.</>,
        ]}
      />
      <Button asChild variant="outline" className="mt-5 rounded-full">
        <Link to="/"><Radio className="h-4 w-4" /> Escuchar ahora</Link>
      </Button>
    </section>
  );
}

export default function DescargaApp() {
  const { os, inApp } = useMemo(detectDevice, []);
  const [copied, setCopied] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');

  // Si se vuelve atrás desde la pantalla de pago, el botón se reactiva.
  useEffect(() => {
    const reset = () => setPaying(false);
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(APP_PAGE_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt('Copia el enlace:', APP_PAGE_URL);
    }
  };

  const share = async () => {
    if (!navigator.share) return copy();
    try {
      await navigator.share({ title: 'SONORIA FM', text: APP_SHARE_TEXT, url: APP_PAGE_URL });
    } catch {
      /* se cerró la ventana de compartir */
    }
  };

  const support = async () => {
    setPayError('');
    setPaying(true);
    try {
      const res = await base44.functions.invoke('create-checkout', { productId: 'donation', amount: SUPPORT_AMOUNT });
      window.location.href = res.data.redirectUrl;
    } catch {
      setPayError('No se pudo iniciar el pago. Inténtalo de nuevo.');
      setPaying(false);
    }
  };

  const isIos = os === 'ios';

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <header className="text-center">
        <img src="/icons/sonoria-192.png" alt="Icono de SONORIA FM" width="96" height="96" className="mx-auto h-24 w-24 rounded-3xl" />
        <h1 className="mt-5 font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">Descarga la app de SONORIA FM</h1>
        <p className="mt-3 text-muted-foreground">
          Música creada con IA las 24 horas, en tu móvil y en tu coche. Gratis y sin registrarte para escuchar.
        </p>

        {inApp && (
          <p className="mt-5 rounded-xl border border-primary/50 bg-primary/10 p-4 text-sm">
            Estás dentro de otra app (Instagram, TikTok…). Para descargar, abre el menú (⋮ o ···) y elige <strong>Abrir en el navegador</strong>.
          </p>
        )}

        {isIos ? (
          <p className="mt-5 rounded-xl border border-border bg-card p-4 text-sm">
            Estás en un iPhone o iPad: no necesitas descargar nada. Mira los pasos aquí abajo.
          </p>
        ) : (
          <>
            <Button asChild className="mt-6 h-14 w-full rounded-full text-base sm:w-auto sm:px-10">
              <a href={APK_URL} rel="noopener">
                <Download className="h-5 w-5" /> Descargar para Android
              </a>
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">Archivo SONORIA-FM.apk · unos 6 MB</p>
          </>
        )}
      </header>

      {os === 'other' && (
        <section className={`${card} flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left`}>
          <img src="/icons/qr-app.png" alt="Código QR de la página de descarga" width="140" height="140" className="h-36 w-36 shrink-0 rounded-xl bg-white p-1" />
          <div>
            <h2 className="font-heading text-xl font-bold">¿Estás en el ordenador?</h2>
            <p className="mt-2 text-sm text-muted-foreground">Apunta la cámara de tu móvil a este código para abrir esta página en él.</p>
          </div>
        </section>
      )}

      {isIos ? <><IosSection /><AndroidSection /></> : <><AndroidSection /><IosSection /></>}

      <section className={card}>
        <details>
          <summary className="flex cursor-pointer items-center gap-2 font-heading text-xl font-bold">
            <Car className="h-5 w-5 text-primary" /> Verla en el coche (Android Auto)
          </summary>
          <p className="mt-3 text-sm text-muted-foreground">
            Como la app no viene de Google Play, hay que autorizarla una sola vez. Hazlo con el coche parado, en el móvil:
          </p>
          <Steps
            items={[
              <>Abre <strong>Ajustes → Aplicaciones → Android Auto → Ajustes adicionales en la aplicación</strong>.</>,
              <>Baja hasta el final y toca <strong>10 veces</strong> en <strong>Versión e información de permisos</strong>.</>,
              <>Pulsa el menú <strong>⋮</strong> y entra en <strong>Ajustes para desarrolladores</strong>.</>,
              <>Activa <strong>Orígenes desconocidos</strong> y conecta el móvil al coche.</>,
            ]}
          />
          <p className="mt-4 text-xs text-muted-foreground">Los nombres pueden cambiar un poco según el móvil.</p>
        </details>
      </section>

      <section className={card}>
        <h2 className="font-heading text-xl font-bold">Pásasela a quien quieras</h2>
        <p className="mt-2 text-sm text-muted-foreground">A tu familia, a tus amigos, al grupo del trabajo.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild className="rounded-full">
            <a href={`https://wa.me/?text=${encodeURIComponent(`${APP_SHARE_TEXT} ${APP_PAGE_URL}`)}`} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          </Button>
          <Button type="button" variant="outline" className="rounded-full" onClick={share}>
            <Share2 className="h-4 w-4" /> Compartir
          </Button>
          <Button type="button" variant="outline" className="rounded-full" onClick={copy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Enlace copiado' : 'Copiar enlace'}
          </Button>
        </div>
      </section>

      <section className={`${card} text-center`}>
        <h2 className="font-heading text-xl font-bold">¿Te gusta? Apóyanos</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La app es gratis. Si quieres ayudar a que la radio siga sonando, puedes aportar {supportLabel}. Es voluntario y no desbloquea nada.
        </p>
        <Button type="button" onClick={support} disabled={paying} variant="outline" className="mt-4 rounded-full">
          {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className="h-4 w-4 text-primary" />}
          {paying ? 'Conectando con el pago…' : `Apóyanos con ${supportLabel}`}
        </Button>
        {payError && <p className="mt-3 text-sm text-destructive">{payError}</p>}
      </section>
    </div>
  );
}
