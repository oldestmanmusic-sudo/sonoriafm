import ProgramSchedule from '@/components/ProgramSchedule';

export default function Programming() {
  return (
    <div>
      <section className="mx-auto max-w-4xl px-4 pt-12">
        <h1 className="font-heading text-3xl font-extrabold tracking-tight">Programación</h1>
        <p className="mt-2 text-muted-foreground">Lo que suena en SONORIA, día a día.</p>
      </section>
      <ProgramSchedule />
    </div>
  );
}