import { Navigate, useLocation } from 'react-router-dom';

// Lleva al inicio de sesión recordando la página que se intentaba abrir:
// tras entrar (o registrarse) el usuario vuelve exactamente a ella.
export default function RedirectToLogin() {
  const { pathname, search } = useLocation();
  return <Navigate to={`/login?returnTo=${encodeURIComponent(pathname + search)}`} replace />;
}
