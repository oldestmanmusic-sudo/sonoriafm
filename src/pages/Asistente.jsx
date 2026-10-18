import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';

export default function Asistente() {
  const connectUrl = base44.agents.getWhatsAppConnectURL('superagente');

  return (
    <section className="mx-auto max-w-2xl px-4 py-12">
      <div className="rounded-3xl border border-border bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15">
          <svg viewBox="0 0 24 24" className="h-8 w-8 text-primary" fill="currentColor" aria-hidden="true">
            <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .2-1.7-.1a13 13 0 0 1-5.5-4.8c-.6-1-.9-2.1-.7-3 .1-.5.5-1.1 1-1.4.2-.2.5-.2.8-.2h.5c.2 0 .4 0 .6.5l.8 1.9c0 .2.1.4-.1.6l-.5.7c-.1.2-.3.4-.1.7.5.9 1.2 1.6 2 2.2.4.3.8.5 1.2.7.2.1.4.1.6-.1l.8-.9c.2-.2.4-.2.6-.1l1.8.9c.2.1.4.2.4.4.1.3 0 .9-.2 1.3Z" />
          </svg>
        </div>
        <h1 className="font-heading text-2xl font-bold">Superagente de SONORIA</h1>
        <p className="mt-2 text-muted-foreground">
          Tu asistente con IA conectado a los datos de la emisora: qué está sonando, historial, programación, artistas, noticias y envíos. También registra sugerencias que le envíes por WhatsApp.
        </p>
        <a href={connectUrl} target="_blank" rel="noreferrer" className="mt-6 inline-block">
          <Button size="lg" className="bg-[#25D366] text-white hover:bg-[#1eb959]">
            Conectar con WhatsApp
          </Button>
        </a>
        <p className="mt-4 text-xs text-muted-foreground">
          Al pulsar, se abrirá WhatsApp para vincular tu número con el superagente. Después podrás escribirle directamente desde tu chat.
        </p>
      </div>
    </section>
  );
}