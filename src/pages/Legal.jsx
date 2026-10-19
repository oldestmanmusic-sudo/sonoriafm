import { Link } from 'react-router-dom';

const SECTIONS = [
  {
    title: '1. Objeto y naturaleza del servicio',
    body: `SONORIA es una plataforma web de radiodifusión musical que reproduce música facilitada voluntariamente por los propios autores o titulares de los derechos correspondientes. SONORIA actúa en todo momento como un mero intermediario técnico: no compone, no edita, no comercializa ni distribuye la música que emite, y se limita a reproducir los ficheros de audio que los usuarios remiten de forma voluntaria y expresa a través del formulario de envío de canciones.`,
  },
  {
    title: '2. Autorización expresa de reproducción',
    body: `Al enviar una canción a SONORIA, el remitente declara y garantiza que es el autor, intérprete o titular legítimo de todos los derechos de propiedad intelectual e industrial sobre la obra remitida (incluidos la música, la letra, la grabación, la carátula y las imágenes asociadas), o que dispone de todas las licencias y autorizaciones necesarias para su difusión pública.
Al completar el envío, el remitente otorga a SONORIA una autorización expresa, gratuita, mundial y por tiempo indefinido (revocable mediante solicitud escrita a Oldestmanmusic@gmail.com) para reproducir, comunicar públicamente y poner a disposición del público la obra remitida en su radio en línea y en su sitio web, sin obligación de compensación económica alguna.`,
  },
  {
    title: '3. Renuncia de reclamaciones',
    body: `El remitente renuncia de forma expresa a formular contra SONORIA cualquier reclamación derivada de la reproducción de los contenidos que él mismo ha enviado, incluidas reclamaciones por derechos de autor, derechos conexos, gestión colectiva (SGAE u otras entidades), remuneración equitativa, uso de imagen, o cualquier otra naturaleza económica o moral.
Asimismo, el remitente exime a SONORIA de toda responsabilidad civil, mercantil o administrativa que pudiera derivarse de la publicación y difusión de los contenidos por él remitidos.`,
  },
  {
    title: '4. Responsabilidad del remitente',
    body: `La total responsabilidad sobre la legalidad, titularidad, originalidad y licitud de los contenidos remitidos corresponde íntegra y exclusivamente a la persona que los envía.
En caso de que un tercero reclame contra SONORIA por la reproducción de un contenido (por infracción de derechos de autor, derechos de imagen, difamación o cualquier otro motivo), el remitente de dicho contenido asumirá íntegramente la responsabilidad del hecho generador, y se obliga a mantener a SONORIA indemne frente a cualquier demanda, perjuicio, coste o gasto (incluidos honorarios de defensa jurídica) derivado de tales reclamaciones.`,
  },
  {
    title: '5. Datos personales del remitente',
    body: `Para poder emitir una canción y disponer en todo momento de la identificación de la persona responsable de cada contenido, SONORIA solicita datos personales en el momento del envío (nombre artístico, nombre real si se facilita, dirección de correo electrónico y datos de contacto adicionales que el remitente facilite voluntariamente).
Estos datos se tratan con las siguientes finalidades: (a) identificar al remitente del contenido; (b) gestionar la revisión, aprobación y emisión de la canción; (c) contactar con el remitente en relación con su envío; y (d) atender a los deberes legales de identificación del responsable de cada obra ante reclamaciones de terceros o requerimientos de autoridades competentes.
Los datos se conservan mientras la canción permanezca publicada y, en cualquier caso, durante los plazos legalmente exigibles para la atención de posibles reclamaciones. El remitente puede ejercitar sus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a Oldestmanmusic@gmail.com. Si su contenido se retira de la emisión, sus datos identificativos podrán conservarse de forma bloqueada por el plazo de prescripción legal.`,
  },
  {
    title: '6. Retirada de contenidos',
    body: `SONORIA se reserva el derecho de no publicar, o de retirar de la emisión en cualquier momento y sin necesidad de justificación previa, cualquier contenido remitido, sin que ello genere derecho a indemnización alguna. Igualmente, ante una reclamación fundada de un tercero, el contenido afectado podrá suspenderse cautelarmente de forma inmediata.`,
  },
  {
    title: '7. Limitación general de responsabilidad',
    body: `Dentro de lo permitido por la ley, SONORIA no responde de: (a) la veracidad, titularidad y licitud de los contenidos remitidos por los usuarios; (b) la indisponibilidad, interrupciones o fallos técnicos de la emisión; (c) los usos que terceros hagan de los contenidos publicados en la plataforma; ni (d) daños indirectos, lucro cesante o pérdida de beneficios alegados por cualquier usuario o tercero en relación con el servicio.`,
  },
  {
    title: '8. Aceptación',
    body: `El envío de una canción a través del formulario de SONORIA implica el conocimiento y la aceptación plena y sin reservas de estas condiciones. SONORIA podrá actualizar este texto; las relaciones ya iniciadas se regirán por las condiciones vigentes en el momento de cada envío.`,
  },
];

export default function Legal() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
        Términos y Condiciones
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Última actualización: 19/10/2026
      </p>
      <p className="mt-4 text-muted-foreground">
        El envío de una canción a SONORIA implica la aceptación plena de este texto. En particular,
        el remitente <strong>declara ser el titular de los derechos</strong> sobre lo que envía,
        <strong> autoriza su reproducción</strong> en la radio, <strong>renuncia a reclamar</strong>
        contra SONORIA por ello y <strong>asume toda la responsabilidad</strong> sobre el contenido
        remitido.
      </p>

      <div className="mt-8 space-y-6">
        {SECTIONS.map((s) => (
          <article key={s.title} className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-heading text-lg font-bold">{s.title}</h2>
            <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">
              {s.body.split('\n\n').map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </article>
        ))}
      </div>

      <p className="mt-10 text-center text-sm text-muted-foreground">
        Dudas sobre este texto: escríbenos a{' '}
        <a href="mailto:Oldestmanmusic@gmail.com" className="font-medium text-primary hover:underline">
          Oldestmanmusic@gmail.com
        </a>
      </p>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        <Link to="/envia-tu-cancion" className="hover:text-foreground">Volver a enviar tu canción</Link>
      </p>
    </section>
  );
}