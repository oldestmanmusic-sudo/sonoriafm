import { Image } from '@/components/ui/image';

const TEAM = [
  {
    name: 'Marta Ibáñez',
    role: 'Fundadora y directora',
    bio: 'Puso en marcha SONORIA con una idea sencilla: que la buena música no entienda de fronteras ni de géneros.',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Diego Ferrer',
    role: 'Director musical',
    bio: 'Selecciona cada tema de la parrilla y rescata joyas que no suenan en ninguna otra parte.',
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Nuria Sanz',
    role: 'Locutora y productora',
    bio: 'Da voz a los directos y a los especiales. Su programa de madrugada ya es un clásico de la casa.',
    image: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Álex Moreno',
    role: 'Técnico de sonido',
    bio: 'Cuida que la señal llegue limpia y sin cortes a cada rincón, las 24 horas del día.',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
  },
];

export default function TeamGrid() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {TEAM.map((m) => (
        <article key={m.name} className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="aspect-square bg-secondary">
            <Image src={m.image} alt={m.name} className="h-full w-full object-cover" />
          </div>
          <div className="p-4">
            <h3 className="font-heading font-bold">{m.name}</h3>
            <p className="text-xs font-medium uppercase tracking-wider text-primary">{m.role}</p>
            <p className="mt-2 text-sm text-muted-foreground">{m.bio}</p>
          </div>
        </article>
      ))}
    </div>
  );
}