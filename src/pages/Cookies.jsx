import { Link } from 'react-router-dom';
import { LegalPage, Section, List } from '@/components/LegalBlocks';
import { LEGAL } from '@/lib/legalInfo';
import { openCookieSettings } from '@/lib/cookieConsent';

const BROWSERS = [
  ['Google Chrome', 'https://support.google.com/chrome/answer/95647'],
  ['Mozilla Firefox', 'https://support.mozilla.org/es/kb/habilitar-y-deshabilitar-cookies-sitios-web-rastrear-preferencias'],
  ['Microsoft Edge', 'https://support.microsoft.com/es-es/microsoft-edge/eliminar-las-cookies-en-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09'],
  ['Apple Safari', 'https://support.apple.com/es-es/guide/safari/sfri11471/mac'],
];

export default function Cookies() {
  return (
    <LegalPage
      title="Política de Cookies de SONORIA FM"
      updated={LEGAL.privacyUpdated}
      intro="Las cookies (y el almacenamiento local del navegador) son pequeños archivos que una web guarda en tu dispositivo para recordar cosas. Esto es lo que usa SONORIA FM."
    >
      <Section title="1. ¿Qué usamos?">
        <p><strong>Técnicos y necesarios</strong> (siempre activos):</p>
        <List>
          <li><strong>Sesión:</strong> te mantienen conectado cuando inicias sesión (y se borran al cerrar sesión).</li>
          <li><strong>Voto:</strong> al votar una canción se guarda en tu navegador un código aleatorio para contar un solo voto por canción, y una marca para no volver a preguntarte si quieres dejar tu correo. No se crean si no votas.</li>
          <li><strong>Seguridad:</strong> una marca de tiempo que evita envíos repetidos en los formularios de contacto y sugerencias.</li>
          <li><strong>Tu elección sobre las cookies:</strong> recuerda si aceptaste o rechazaste las estadísticas.</li>
        </List>
        <p>
          Son imprescindibles para prestar el servicio que pides, por eso no necesitan consentimiento.
        </p>
        <p><strong>De estadísticas</strong> (solo si pulsas «Aceptar»):</p>
        <List>
          <li><strong>Visitas (Base44 Analytics):</strong> un identificador aleatorio guardado en tu navegador (<code>base44_analytics_session_id</code>), las páginas que ves, cuándo y cuánto tiempo, y la web o campaña desde la que llegas. Si has iniciado sesión, las visitas se asocian a tu cuenta.</li>
          <li><strong>Origen de la visita:</strong> las cookies <code>base44_referrer_id</code> y <code>base44_referrer_origin</code> recuerdan durante 30 días el enlace o la web que te trajo.</li>
        </List>
        <p><strong>No usamos cookies de publicidad.</strong></p>
      </Section>

      <Section title="2. ¿Quién las pone?">
        <p>
          Las de esta web las gestionan SONORIA FM y Base44, la plataforma donde está alojada. Al pagar una donación o un
          servicio pasas a la pasarela de pago de Wix, que puede usar sus propias cookies según su política. Los enlaces a nuestras redes sociales te llevan a esas plataformas, que tienen sus
          propias normas.
        </p>
      </Section>

      <Section title="3. Cómo controlarlas">
        <p>
          Puedes aceptar o rechazar las estadísticas, y cambiar de opinión cuando quieras:{' '}
          <button type="button" onClick={openCookieSettings} className="text-primary hover:underline">Configurar cookies</button>.
        </p>
        <p>También puedes borrarlas o bloquearlas desde tu navegador. Si bloqueas las técnicas, es posible que no puedas iniciar sesión.</p>
        <List>
          {BROWSERS.map(([name, url]) => (
            <li key={name}>
              <a className="text-primary hover:underline" href={url} target="_blank" rel="noopener noreferrer">{name}</a>
            </li>
          ))}
        </List>
      </Section>

      <Section title="4. Si cambia en el futuro">
        <p>
          Si algún día añadimos publicidad u otras cookies no necesarias, te pediremos tu consentimiento antes de
          activarlas y actualizaremos esta página. Más información sobre tus datos en la{' '}
          <Link to="/privacidad" className="text-primary hover:underline">Política de Privacidad</Link>.
        </p>
      </Section>

      <Section title="5. ¿Dudas?">
        <p>Escríbenos a <a className="text-primary hover:underline" href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.</p>
      </Section>
    </LegalPage>
  );
}
