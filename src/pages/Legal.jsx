import { Link } from 'react-router-dom';

const CONTACT_EMAIL = 'Oldestmanmusic@gmail.com';

function Section({ title, children }) {
  return (
    <article className="rounded-2xl border border-border bg-card p-6">
      <h2 className="font-heading text-lg font-bold">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </article>
  );
}

function List({ children }) {
  return <ul className="list-disc space-y-1 pl-5">{children}</ul>;
}

export default function Legal() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
        Términos para Artistas de Sonoria FM
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">Última actualización: 22/10/2026</p>
      <p className="mt-4 text-muted-foreground">
        <strong>¡Hola, artista!</strong> 👋 Si quieres que tu música generada por IA suene en Sonoria FM,
        es importante que leas y aceptes estas condiciones. Así nos aseguramos de que todo esté claro y de
        que tu arte llegue a nuestros oyentes de forma legal y transparente.
      </p>

      <div className="mt-8 space-y-6">
        <Section title="1. ¿Quién puede enviar música?">
          <p>
            Solo pueden enviar música los artistas o titulares de derechos que hayan creado o posean los
            derechos de la música generada por inteligencia artificial. Al enviar tu música, confirmas que
            tienes todos los permisos necesarios y que eres el único y legítimo titular de los derechos de
            propiedad intelectual sobre la obra.
          </p>
        </Section>

        <Section title="2. Tu música y la IA">
          <p>
            En Sonoria FM nos centramos en la música creada con inteligencia artificial. Al enviarnos tu
            obra, garantizas que ha sido generada total o parcialmente con IA bajo tu dirección creativa,
            que cumples con las políticas de uso de las herramientas de IA que hayas utilizado, y que la
            obra resultante es original y no infringe derechos de terceros.
          </p>
        </Section>

        <Section title="3. Autorización para la emisión (¡esto es clave!)">
          <p>
            Al enviar tu música a Sonoria FM, nos concedes una licencia no exclusiva, mundial y gratuita
            para:
          </p>
          <List>
            <li><strong>Emitir y reproducir técnicamente</strong> tu música en nuestra radio online.</li>
            <li><strong>Almacenar</strong> tu música en nuestros servidores para poder emitirla.</li>
            <li>
              <strong>Promocionar</strong> tu música y Sonoria FM usando fragmentos de tus obras en
              nuestros canales de comunicación.
            </li>
            <li>
              <strong>Asociar publicidad</strong> junto o durante la emisión de tu música, sin que esto
              genere derecho a compensación adicional por tu parte.
            </li>
          </List>
          <p>
            Esta licencia nos permite emitir tu música, pero <strong>tú sigues siendo el dueño de tus
            derechos de autor</strong>. No te preocupes, no vendemos tu música ni la usamos para otros
            fines sin tu permiso expreso.
          </p>
        </Section>

        <Section title="4. Tus responsabilidades como artista">
          <p>Al enviar tu música, te comprometes a:</p>
          <List>
            <li>
              Asegurarte de que tienes todos los derechos y permisos sobre la música que nos envías,
              incluyendo los derechos de las fuentes de datos utilizadas por la IA si fuera relevante.
            </li>
            <li>
              Garantizar que tu música no infringe derechos de autor de terceros, marcas registradas,
              derechos de privacidad, derechos de imagen, o cualquier otra ley o derecho de propiedad
              intelectual.
            </li>
            <li>
              No enviar contenido ilegal, ofensivo, difamatorio o que promueva la violencia o la
              discriminación.
            </li>
            <li>
              <strong>Indemnizar y eximir de responsabilidad a Sonoria FM</strong> frente a cualquier
              reclamación, demanda, daño, pérdida o gasto (incluidos los honorarios de abogados) que
              surja de cualquier incumplimiento de estas garantías por tu parte o de cualquier
              reclamación de terceros relacionada con la música que nos has enviado.
            </li>
          </List>
        </Section>

        <Section title="5. Nuestros derechos (Sonoria FM)">
          <p>Nos reservamos el derecho de:</p>
          <List>
            <li>
              <strong>Seleccionar</strong> la música que emitimos. No toda la música enviada será
              emitida.
            </li>
            <li><strong>Programar</strong> tu música en el momento que consideremos oportuno.</li>
            <li>
              <strong>Retirar</strong> tu música de nuestra programación en cualquier momento y por
              cualquier motivo, sin previo aviso.
            </li>
            <li>
              <strong>Editar</strong> tu música para adaptarla a los formatos de emisión (por ejemplo,
              ajustar el volumen o cortar intros/outros si es necesario), siempre respetando la
              integridad de la obra.
            </li>
          </List>
        </Section>

        <Section title="6. Contacto para derechos y reclamaciones">
          <p>
            Si tienes alguna duda sobre los derechos de tu música, o si crees que tu música ha sido
            utilizada de forma indebida, puedes contactarnos en:{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-primary hover:underline">
              {CONTACT_EMAIL}
            </a>
          </p>
        </Section>

        <Section title="7. Ley aplicable y jurisdicción">
          <p>
            Estos términos se rigen por la ley española. Para cualquier disputa, los tribunales del
            domicilio legal del titular de Sonoria FM serán los competentes.
          </p>
        </Section>
      </div>

      <p className="mt-10 text-center text-xs text-muted-foreground">
        <Link to="/envia-tu-cancion" className="hover:text-foreground">Volver a enviar tu canción</Link>
      </p>
    </section>
  );
}
