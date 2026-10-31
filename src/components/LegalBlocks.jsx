export function Section({ title, children }) {
  return (
    <article className="rounded-2xl border border-border bg-card p-6">
      <h2 className="font-heading text-lg font-bold">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </article>
  );
}

export function List({ children }) {
  return <ul className="list-disc space-y-1 pl-5">{children}</ul>;
}

export function LegalPage({ title, updated, intro, children }) {
  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última actualización: {updated}</p>
      {intro && <p className="mt-4 text-muted-foreground">{intro}</p>}
      <div className="mt-8 space-y-6">{children}</div>
    </section>
  );
}
