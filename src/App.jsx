import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { ThemeProvider } from 'next-themes';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import { lazy, Suspense } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';

// Carga diferida: cada pantalla se descarga solo cuando se visita.
const Home = lazy(() => import('@/pages/Home'));
const Artists = lazy(() => import('@/pages/Artists'));
const ArtistDetail = lazy(() => import('@/pages/ArtistDetail'));
const TrackDetail = lazy(() => import('@/pages/TrackDetail'));
const EnviarCancion = lazy(() => import('@/pages/EnviarCancion'));
const SubirCancion = lazy(() => import('@/pages/SubirCancion'));
const Programming = lazy(() => import('@/pages/Programming'));
const Noticias = lazy(() => import('@/pages/Noticias'));
const ArticleDetail = lazy(() => import('@/pages/ArticleDetail'));
const SobreNosotros = lazy(() => import('@/pages/SobreNosotros'));
const Contacto = lazy(() => import('@/pages/Contacto'));
const Sugerencias = lazy(() => import('@/pages/Sugerencias'));
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const AdminLayout = lazy(() => import('@/pages/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));
const AdminArticles = lazy(() => import('@/pages/admin/AdminArticles'));
const AdminArtists = lazy(() => import('@/pages/admin/AdminArtists'));
const AdminPrograms = lazy(() => import('@/pages/admin/AdminPrograms'));
const AdminTracks = lazy(() => import('@/pages/admin/AdminTracks'));
const AdminMessages = lazy(() => import('@/pages/admin/AdminMessages'));
const AdminSuggestions = lazy(() => import('@/pages/admin/AdminSuggestions'));
const AdminSubmissions = lazy(() => import('@/pages/admin/AdminSubmissions'));
const Cuenta = lazy(() => import('@/pages/Cuenta'));
const Donar = lazy(() => import('@/pages/Donar'));
const ThankYou = lazy(() => import('@/pages/ThankYou'));
const Promociona = lazy(() => import('@/pages/Promociona'));
const Legal = lazy(() => import('@/pages/Legal'));


const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/artistas" element={<Artists />} />
        <Route path="/artistas/:id" element={<ArtistDetail />} />
        <Route path="/cancion/:id" element={<TrackDetail />} />
        <Route path="/envia-tu-cancion" element={<EnviarCancion />} />
        <Route path="/subir-cancion" element={<SubirCancion />} />
        <Route path="/programacion" element={<Programming />} />
        <Route path="/noticias" element={<Noticias />} />
        <Route path="/noticias/:id" element={<ArticleDetail />} />
        <Route path="/sobre-nosotros" element={<SobreNosotros />} />
        <Route path="/contacto" element={<Contacto />} />
        <Route path="/sugerencias" element={<Sugerencias />} />
        <Route path="/donar" element={<Donar />} />
        <Route path="/promociona-tu-musica" element={<Promociona />} />
        <Route path="/terminos" element={<Legal />} />

        <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login?returnTo=/cuenta" replace />} />}>
          <Route path="/cuenta" element={<Cuenta />} />
        </Route>
      </Route>

      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login?returnTo=/admin" replace />} />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="articulos" element={<AdminArticles />} />
          <Route path="artistas" element={<AdminArtists />} />
          <Route path="programacion" element={<AdminPrograms />} />
          <Route path="historial" element={<AdminTracks />} />
          <Route path="envios" element={<AdminSubmissions />} />
          <Route path="mensajes" element={<AdminMessages />} />
          <Route path="sugerencias" element={<AdminSuggestions />} />
        </Route>
      </Route>

      <Route path="/ThankYou" element={<ThankYou />} />

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <ScrollToTop />
            <Suspense fallback={null}>
              <AuthenticatedApp />
            </Suspense>
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App