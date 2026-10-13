import { Link } from 'react-router-dom';
import TeamGrid from '@/components/about/TeamGrid';
import { Sparkles, HeartHandshake, Globe2, ArrowRight } from 'lucide-react';

const VALUES = [
  {
    Icon: Sparkles,
    title: 'Música sin etiquetas',
    text: 'Pasamos del pop al rock, del soul a la electrónica. Aquí conviven todos los géneros porque la curiosidad es la mejor parrilla.',
  },
  {
    Icon: HeartHandshake,
    title: 'Cerca de los artistas',
    text: 'Damos espacio a voces emergentes y a proyectos independientes que merecen sonar mucho más alto.',
  },
  {
    Icon: Globe2,
    title: 'En directo, siempre',
    text: 'Una señal continua las 24 horas, sin pausas y sin repetir la misma lista de siempre.',
  },
];

export default function SobreNosotros() {
  return (
    <div className="pb-4">
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 left-1/3 h-80 w-80 rounded-full bg-primary/25 blur-[120px]" />
          <div className="absolute top-10 right-0 h-64 w-64 rounded-full bg-accent/20 blur-[100px]" />
        </div>
        <div className="relative mx-auto max-w-4xl px-4 pt-16 pb-12 text-center sm:pt-20">
          <h1 className="font-heading text-4xl font-extrabold tracking-tight sm:text-5xl">
            La radio que suena <span className="text-primary">a todos</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            SONORIA nació para devolverle a la radio su magia: música variada, sin cortes y con la sensación de que
            siempre hay algo nuevo por descubrir.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-10">
          <h2 className="font-heading text-2xl font-bold">Nuestra historia</h2>
          <div className="mt-4 space-y-4 text-muted-foreground">
            <p>
              Empezamos como un pequeño proyecto de fin de semana: unos cuantos amigos, una lista de reproducción
              infinita y la idea de que la radio podía seguir siendo un lugar de encuentro. Lo que comenzó como un
              experimento pronto se convirtió en una emisora que suena en hogares, coches y oficinas de medio mundo.
            </p>
            <p>
              Hoy emitimos las 24 horas con una programación viva, hecha por personas que escuchan tanta música como
              tú. Cada semana sumamos artistas emergentes, especiales temáticos y directos desde nuestro estudio.
            </p>
          </div>

          <div className="mt-8 rounded-xl border border-primary/30 bg-primary/5 p-6">
            <h3 className="font-heading text-lg font-bold text-primary">Nuestra misión</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Acompañarte con la mejor música posible, dar voz a quien empieza y demostrar que una radio puede ser
              cercana, libre y sorprendente. Sin algoritmos que decidan por ti: solo buenas canciones bien elegidas.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-5 sm:grid-cols-3">
          {VALUES.map(({ Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-border bg-card p-6">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/40">
                <Icon className="h-5 w-5 text-primary" />
              </span>
              <h3 className="mt-4 font-heading font-bold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6">
          <h2 className="font-heading text-2xl font-bold">El equipo</h2>
          <p className="text-sm text-muted-foreground">Las personas que hacen que SONORIA suene cada día.</p>
        </div>
        <TeamGrid />
      </section>

      <section className="mx-auto max-w-4xl px-4 py-10 text-center">
        <h2 className="font-heading text-2xl font-bold">¿Quieres formar parte?</h2>
        <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
          Si eres artista, tienes una idea o quieres colaborar con nosotros, nos encantará escucharte.
        </p>
        <Link
          to="/contacto"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground transition-transform hover:scale-105"
        >
          Escríbenos <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}