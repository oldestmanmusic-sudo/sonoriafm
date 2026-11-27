import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

// Aviso en la portada para llevar a la página de descarga de la app.
export default function AppBanner() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-6">
      <Link
        to="/app"
        className="group flex flex-col items-center gap-4 rounded-2xl border border-primary/40 bg-primary/10 p-5 text-center transition-colors hover:bg-primary/15 sm:flex-row sm:text-left"
      >
        <img src="/icons/sonoria-192.png" alt="" width="56" height="56" className="h-14 w-14 shrink-0 rounded-2xl" />
        <span className="flex-1">
          <span className="block font-heading text-lg font-bold">Lleva SONORIA FM en el móvil</span>
          <span className="block text-sm text-muted-foreground">App gratis para Android y Android Auto. En iPhone, directa desde la web.</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
          Descargar la app
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
    </section>
  );
}
