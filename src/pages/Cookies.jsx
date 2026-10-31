import { Link } from 'react-router-dom';
import { LegalPage, Section, List } from '@/components/LegalBlocks';
import { LEGAL } from '@/lib/legalInfo';

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
      updated={LEGAL.updated}
      intro="Las cookies (y el almacenamiento local del navegador) son pequeños archivos que una web guarda en tu dispositivo para recordar cosas. Esto es lo que usa SONORIA FM."
    >
      <Section title="1. ¿Qué usamos?">
        <p>Hoy SONORIA FM solo usa cookies y almacenamiento <strong>técnicos y necesarios</strong>:</p>
        <List>
          <li><strong>Sesión:</strong> te mantienen conectado cuando inicias sesión (y se borran al cerrar sesión).</li>
          <li><strong>Seguridad:</strong> una marca de tiempo que evita envíos repetidos en los formularios de contacto y sugerencias.</li>
          <li><strong>Aviso de cookies:</strong> recuerda que ya has leído este aviso para no mostrártelo otra vez.</li>
        </List>
        <p>
          <strong>No usamos cookies de analítica, de personalización con fines comerciales ni de publicidad.</strong> Las
          cookies técnicas están exentas de consentimiento porque son imprescindibles para prestar el servicio que pides.
        </p>
      </Section>

      <Section title="2. ¿Quién las pone?">
        <p>
          Son propias de SONORIA FM. Al pagar una donación o un servicio pasas a la pasarela de pago de Wix, que puede usar sus
          propias cookies según su política. Los enlaces a nuestras redes sociales te llevan a esas plataformas, que tienen sus
          propias normas.
        </p>
      </Section>

      <Section title="3. Cómo controlarlas">
        <p>Puedes borrarlas o bloquearlas desde tu navegador. Si bloqueas las técnicas, es posible que no puedas iniciar sesión.</p>
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
          Si algún día añadimos analítica, publicidad u otras cookies no necesarias, te pediremos tu consentimiento antes de
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
