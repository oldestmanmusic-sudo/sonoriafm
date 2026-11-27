// Elección del visitante sobre las cookies de estadísticas. La lógica que habla con la
// plataforma está en index.html, porque tiene que ejecutarse antes de que cargue la web.
export const SETTINGS_EVENT = 'sonoria:cookie-settings';

export const getConsent = () => window.sonoriaConsent?.get() ?? null;

export const setConsent = (value) => window.sonoriaConsent?.set(value);

// Vuelve a mostrar el aviso para cambiar la elección.
export const openCookieSettings = () => window.dispatchEvent(new Event(SETTINGS_EVENT));
