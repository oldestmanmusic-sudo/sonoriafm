// Traduce al español los errores más habituales del acceso; si no reconoce el mensaje, usa el texto por defecto.
export function authError(err, fallback) {
  const m = String(err?.message || '').toLowerCase();
  if (!m) return fallback;
  if (m.includes('already') && (m.includes('exist') || m.includes('registered'))) return 'Ya existe una cuenta con ese correo.';
  if (m.includes('too many') || m.includes('rate limit')) return 'Demasiados intentos. Espera un momento y vuelve a probar.';
  if ((m.includes('code') || m.includes('otp')) && (m.includes('invalid') || m.includes('expired') || m.includes('incorrect'))) {
    return 'El código no es válido o ha caducado.';
  }
  if (m.includes('verify') || m.includes('not verified')) return 'Tienes que verificar tu correo antes de entrar.';
  if (m.includes('password') && (m.includes('short') || m.includes('weak') || m.includes('least') || m.includes('characters'))) {
    return 'La contraseña es demasiado corta o débil. Prueba con una más larga.';
  }
  if (m.includes('invalid') || m.includes('incorrect') || m.includes('credentials') || m.includes('not found')) return fallback;
  return fallback;
}
