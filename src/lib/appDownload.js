// Datos de la app de Android: enlace de descarga y textos para compartirla.
// El enlace "latest" apunta siempre a la última versión publicada.
export const APK_URL = 'https://github.com/oldestmanmusic-sudo/Sonoriafm-android/releases/latest/download/SONORIA-FM.apk';
export const APP_PAGE_URL = 'https://sonoriafm.com/app';
export const APP_SHARE_TEXT = 'Escucha SONORIA FM, la radio 24 horas de música creada con IA. La app es gratis:';
export const SUPPORT_AMOUNT = 0.99;

export function detectDevice() {
  if (typeof navigator === 'undefined') return { os: 'other', inApp: false };
  const ua = navigator.userAgent || '';
  const iPadDesktop = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  const os = /iPhone|iPad|iPod/i.test(ua) || iPadDesktop ? 'ios' : /Android/i.test(ua) ? 'android' : 'other';
  // Navegadores internos de redes sociales: suelen bloquear las descargas.
  const inApp = /Instagram|FBAN|FBAV|musical_ly|BytedanceWebview|TikTok/i.test(ua);
  return { os, inApp };
}
