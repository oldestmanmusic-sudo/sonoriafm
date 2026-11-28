import { Link } from 'react-router-dom';
import { LegalPage, Section, List } from '@/components/LegalBlocks';
import { LEGAL } from '@/lib/legalInfo';

export default function Privacidad() {
  return (
    <LegalPage
      title="Política de Privacidad de SONORIA FM"
      updated={LEGAL.privacyUpdated}
      intro="En SONORIA FM tratamos solo los datos necesarios para que puedas escuchar la radio, tener tu cuenta, enviarnos música y contactar con nosotros. Aquí te explicamos qué datos usamos, para qué y qué derechos tienes."
    >
      <Section title="1. ¿Quién es el responsable de tus datos?">
        <List>
          <li><strong>Responsable:</strong> {LEGAL.name}</li>
          {LEGAL.nif && <li><strong>NIF/CIF:</strong> {LEGAL.nif}</li>}
          {LEGAL.address && <li><strong>Domicilio:</strong> {LEGAL.address}</li>}
          <li><strong>Correo de contacto para privacidad:</strong> <a className="text-primary hover:underline" href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a></li>
        </List>
      </Section>

      <Section title="2. ¿Qué datos tratamos y para qué?">
        <List>
          <li><strong>Cuenta:</strong> nombre y correo electrónico (y los datos de acceso), para que puedas iniciar sesión, enviar música y conservar tus canciones favoritas.</li>
          <li><strong>Me gusta:</strong> la canción votada, el día y un código aleatorio que se guarda en tu navegador o en la app (y, si has iniciado sesión, el identificador de tu cuenta), para contar un voto por canción y para el TOP 10. Si votas sin cuenta, guardamos además un resumen cifrado de tu conexión, distinto cada día, para limitar los abusos; no guardamos tu dirección IP. Para votar no hace falta dar ningún correo. Los registros de votos de canciones se borran cada lunes al cerrar el ranking semanal.</li>
          <li><strong>Corazones a artistas:</strong> el artista, el día y el mismo código aleatorio (y, si has iniciado sesión, el identificador de tu cuenta), para contar un corazón por persona y artista. Se conservan mientras exista el perfil del artista o hasta que borres tu cuenta. Sin cuenta, guardamos además un resumen cifrado de tu conexión para limitar los abusos, que se borra en días posteriores; no guardamos tu dirección IP.</li>
          <li><strong>Correo de oyentes (opcional):</strong> si después de votar decides dejarlo y marcas la casilla, guardamos tu correo, la fecha, el texto que aceptaste, la canción que acababas de votar y un resumen cifrado de tu conexión (para evitar abusos), para enviarte novedades de SONORIA FM y el TOP semanal. Para darte de baja, responde a cualquiera de esos correos con la palabra BAJA o escribe a {LEGAL.email}.</li>
          <li><strong>Envío de canciones (artistas):</strong> nombre artístico, correo, título, audio, portada, foto, biografía, descripción, letra, herramienta de creación y la aceptación de los Términos con su fecha. Sirven para valorar la canción, emitirla y avisarte de la decisión.</li>
          <li><strong>Contacto y sugerencias:</strong> nombre, correo y mensaje, para responderte y mejorar la web.</li>
          <li><strong>Donaciones y servicios de pago:</strong> el pago lo gestiona Wix Payments. Nosotros guardamos la referencia de la compra, el importe, el correo del comprador y, en los servicios de promoción, el nombre artístico y la canción. No vemos ni guardamos los datos de tu tarjeta.</li>
          <li><strong>Correos a empresas y colaboradores:</strong> enviamos propuestas de colaboración (cuñas, patrocinios, donaciones) a datos de contacto profesionales de empresas obtenidos de fuentes de acceso público. Cada correo incluye un enlace para darse de baja.</li>
          <li><strong>Datos técnicos:</strong> información básica del navegador y de la conexión necesaria para que la web funcione y esté protegida frente a abusos. No usamos publicidad (ver la <Link to="/cookies" className="text-primary hover:underline">Política de Cookies</Link>).</li>
          <li><strong>Estadísticas de visitas (solo si las aceptas):</strong> páginas vistas, fecha y duración, web o campaña de procedencia y un identificador aleatorio guardado en tu navegador; si has iniciado sesión, también el identificador de tu cuenta. Las recoge Base44 por nuestra cuenta y puedes rechazarlas o retirar tu permiso cuando quieras (ver la <Link to="/cookies" className="text-primary hover:underline">Política de Cookies</Link>).</li>
          <li><strong>Escucha de la radio:</strong> contamos de forma anónima cuántos minutos suena la radio en la web, qué canción y en qué zona horaria, con un código aleatorio que se pierde al cerrar la página. No se guarda nada en tu dispositivo ni se asocia a tu cuenta o a tu IP.</li>
        </List>
      </Section>

      <Section title="3. ¿En qué nos basamos para tratarlos?">
        <List>
          <li><strong>Tu consentimiento:</strong> al registrarte, escribirnos, enviarnos una sugerencia, dejarnos tu correo después de votar o aceptar las cookies de estadísticas.</li>
          <li><strong>Ejecución de un contrato:</strong> cuando envías música para su emisión o compras un servicio.</li>
          <li><strong>Interés legítimo:</strong> mantener la web segura, evitar el spam y proponer colaboraciones a empresas, siempre con opción de baja.</li>
          <li><strong>Obligación legal:</strong> por ejemplo, las obligaciones fiscales y contables de los pagos.</li>
        </List>
      </Section>

      <Section title="4. ¿Con quién compartimos tus datos?">
        <p>
          No vendemos ni cedemos tus datos. Solo los comparten con nosotros o los tratan por nuestra cuenta los proveedores
          imprescindibles para prestar el servicio: la plataforma de alojamiento y base de datos de la web (Base44), el
          proveedor de pagos (Wix Payments), los servicios de correo y documentos que usamos para comunicarnos y gestionar
          el proyecto (Google) y las autoridades cuando la ley lo exija. Las canciones, portadas y datos de artista que
          envías para su publicación son públicos en la web.
        </p>
      </Section>

      <Section title="5. Transferencias internacionales">
        <p>
          Algunos de estos proveedores pueden estar fuera del Espacio Económico Europeo. En ese caso la transferencia se
          apoya en garantías adecuadas: decisiones de adecuación de la Comisión Europea (como el Marco de Privacidad de
          Datos UE-EE.UU. para empresas certificadas) o cláusulas contractuales tipo.
        </p>
      </Section>

      <Section title="6. ¿Cuánto tiempo guardamos tus datos?">
        <List>
          <li><strong>Tu cuenta y tus envíos:</strong> mientras la mantengas. Puedes eliminarla en <Link to="/cuenta" className="text-primary hover:underline">Mi cuenta</Link>; se borran tu perfil y los datos asociados (envíos de canciones y mensajes de contacto).</li>
          <li><strong>Pagos:</strong> el tiempo que exijan las obligaciones fiscales y contables.</li>
          <li><strong>Correo de oyentes:</strong> hasta que te des de baja o nos pidas que lo borremos. Si te das de baja, lo conservamos marcado como baja para no volver a escribirte.</li>
          <li><strong>Contactos de empresas:</strong> hasta que te des de baja o nos lo pidas.</li>
          <li><strong>Mensajes y sugerencias:</strong> el tiempo necesario para atenderlos.</li>
        </List>
      </Section>

      <Section title="7. Tus derechos">
        <p>Según el RGPD y la normativa española de protección de datos, puedes:</p>
        <List>
          <li>Acceder a tus datos y rectificarlos si son incorrectos.</li>
          <li>Pedir su supresión, limitar su tratamiento u oponerte a él.</li>
          <li>Recibirlos en un formato portable.</li>
          <li>Retirar tu consentimiento en cualquier momento.</li>
        </List>
        <p>
          Para ejercerlos escribe a <a className="text-primary hover:underline" href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.
          Si crees que no hemos tratado bien tus datos, puedes reclamar ante la Agencia Española de Protección de Datos
          (<a className="text-primary hover:underline" href="https://www.aepd.es" target="_blank" rel="noopener noreferrer">www.aepd.es</a>).
        </p>
      </Section>

      <Section title="8. Menores">
        <p>SONORIA FM no está dirigida a menores de 14 años. Si crees que un menor nos ha facilitado datos, escríbenos y los eliminaremos.</p>
      </Section>

      <Section title="9. Cambios en esta política">
        <p>Podemos actualizar esta política. Publicaremos aquí la versión vigente con su fecha y te avisaremos si el cambio es importante.</p>
      </Section>
    </LegalPage>
  );
}
