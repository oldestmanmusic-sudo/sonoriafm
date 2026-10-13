import ContactForm from '@/components/contact/ContactForm';
import SocialLinks from '@/components/SocialLinks';
import { Mail, MapPin, Radio } from 'lucide-react';

export default function Contacto() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
      <div className="max-w-2xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
          <Radio className="h-3.5 w-3.5" /> Hablemos
        </span>
        <h1 className="mt-4 font-heading text-4xl font-extrabold tracking-tight sm:text-5xl">Contacto</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          ¿Quieres pedir un tema, proponer una colaboración o anunciarte en SONORIA? Escríbenos, leemos cada mensaje.
        </p>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <ContactForm />

        <aside className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-heading text-lg font-bold">Síguenos</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Novedades, directos y la música del día en nuestras redes.
            </p>
            <SocialLinks className="mt-4" />
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-semibold">Correo</p>
                <p className="text-sm text-muted-foreground">hola@sonoria.fm</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-semibold">Estudios</p>
                <p className="text-sm text-muted-foreground">Madrid, España · emitiendo para todo el mundo</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Radio className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-semibold">En antena</p>
                <p className="text-sm text-muted-foreground">24 horas al día, 7 días a la semana</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}