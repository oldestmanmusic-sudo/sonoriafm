import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { normalizeTrackTitle } from '@/lib/trackUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LANGUAGES, SUBMISSION_TOOLS } from '@/lib/brand';
import { useGenreOptions, resolveGenre } from '@/lib/useGenres';
import { Loader2, Send, CheckCircle2, UserRound, Upload } from 'lucide-react';

const MAX_AUDIO_MB = 25;
const Req = () => <span className="text-primary">*</span>;

// Subida rápida para artistas ya registrados: título, portada y canción.
// El resto de datos (nombre artístico, foto, biografía) se reutilizan
// del primer envío del artista. La canción entra como "pendiente" y solo suena
// en la radio cuando el equipo la aprueba (en ese momento se crea la pista).
export default function SubirCancion() {
  // loading | anon | noprofile | error | ready
  const [view, setView] = useState('loading');
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('');
  const [genreOther, setGenreOther] = useState('');
  const { options: genreOptions } = useGenreOptions();
  const [language, setLanguage] = useState('');
  const [tool, setTool] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [coverFile, setCoverFile] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const ok = await base44.auth.isAuthenticated();
        if (!ok) { if (active) setView('anon'); return; }
        const me = await base44.auth.me();
        const { items } = await base44.entities.Submission.filter(
          { created_by_id: me.id },
          { sort: '-created_date', limit: 1 }
        );
        if (!active) return;
        setUser(me);
        if (items.length) {
          setProfile(items[0]);
          setView('ready');
        } else {
          setView('noprofile');
        }
      } catch {
        if (active) setView('error');
      }
    })();
    return () => { active = false; };
  }, []);

  const reset = () => {
    setTitle('');
    setGenre('');
    setGenreOther('');
    setLanguage('');
    setTool('');
    setLyrics('');
    setCoverFile(null);
    setAudioFile(null);
    setAccepted(false);
    setError('');
    setSent(false);
    setFormKey((k) => k + 1); // vacía los selectores de archivo
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const missing = [];
    if (!title.trim()) missing.push('título');
    if (!genre) missing.push('tipo de música');
    if (genre === 'Otros' && !genreOther.trim()) missing.push('qué género o tipo de música es');
    if (!language) missing.push('idioma');
    if (!tool) missing.push('herramienta de IA usada');
    if (!lyrics.trim()) missing.push('letra');
    if (!coverFile) missing.push('imagen de portada');
    if (!audioFile) missing.push('canción');
    if (missing.length) {
      setError(`Todos los campos son obligatorios. Falta: ${missing.join(', ')}.`);
      return;
    }
    if (!coverFile.type.startsWith('image/')) {
      setError('La portada debe ser un archivo de imagen.');
      return;
    }
    const ext = audioFile.name.split('.').pop().toLowerCase();
    if (!['mp3', 'wav'].includes(ext)) {
      setError('La canción debe ser un archivo MP3 o WAV.');
      return;
    }
    if (audioFile.size > MAX_AUDIO_MB * 1024 * 1024) {
      setError(`La canción supera el máximo de ${MAX_AUDIO_MB} MB.`);
      return;
    }
    if (!accepted) {
      setError('Debes confirmar los derechos y aceptar los Términos para Artistas.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      // Anti-duplicados: mismo artista y título equivalente (ignora mayúsculas
      // y paréntesis como "(Remastered)"), tanto en la radio como en envíos propios.
      const wanted = normalizeTrackTitle(title);
      const esc = profile.artist_name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      try {
        const { items: tracks } = await base44.entities.Track.filter(
          { artist: { $regex: `^${esc}$`, $options: 'i' } },
          { limit: 500, fields: ['title'] }
        );
        if (tracks.some((t) => normalizeTrackTitle(t.title) === wanted)) {
          setError('Esa canción ya está en SONORIA FM.');
          return;
        }
        const { items: mine } = await base44.entities.Submission.filter(
          { created_by_id: user.id },
          { limit: 500, fields: ['song_title', 'status'] }
        );
        if (mine.some((s) => s.status !== 'rejected' && normalizeTrackTitle(s.song_title) === wanted)) {
          setError('Ya nos enviaste una canción con ese título.');
          return;
        }
      } catch { /* si la comprobación falla, seguimos con el envío normal */ }

      // Audio y portada van a almacenamiento público: la radio y la web
      // necesitan una URL permanente para emitirlos cuando se apruebe.
      const audioRes = await base44.integrations.Core.UploadPublicFile({ file: audioFile });
      const coverRes = await base44.integrations.Core.UploadPublicFile({ file: coverFile });

      await base44.entities.Submission.create({
        artist_name: profile.artist_name,
        email: user.email,
        song_title: title.trim(),
        ...resolveGenre(genre, genreOther),
        language,
        audio_link: audioRes.file_url,
        cover_url: coverRes.file_url,
        artist_image_url: profile.artist_image_url || '',
        artist_bio: profile.artist_bio || '',
        tool,
        description: '',
        lyrics: lyrics.trim(),
        confirmed: true,
        terms_accepted: true,
        terms_accepted_at: new Date().toISOString(),
        // status queda en "pending" (valor por defecto): no suena hasta aprobarse.
      });
      setSent(true);
    } catch {
      setError('No se pudo enviar la canción. Inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  if (view === 'loading') {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Sin sesión: el formulario completo se rellena libremente y el registro se pide al final.
  if (view === 'anon') return <Navigate to="/envia-tu-cancion" replace />;

  if (view === 'error') {
    return (
      <section className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="font-heading text-3xl font-extrabold">Sube tu canción</h1>
        <p className="mt-3 text-muted-foreground">No pudimos cargar tu perfil de artista. Recarga la página e inténtalo de nuevo.</p>
        <Button className="mt-6 rounded-full" onClick={() => window.location.reload()}>Recargar</Button>
      </section>
    );
  }

  if (view === 'noprofile') {
    return (
      <section className="mx-auto max-w-2xl px-4 py-20 text-center">
        <UserRound className="mx-auto h-12 w-12 text-primary" />
        <h1 className="mt-4 font-heading text-3xl font-extrabold">Primero, tu primera canción</h1>
        <p className="mt-3 text-muted-foreground">
          Todavía no tenemos tu ficha de artista. Envía tu primera canción con el formulario completo (nombre artístico, foto y
          descripción) y, a partir de ahí, podrás subir más con solo título, portada y canción.
        </p>
        <Link to="/envia-tu-cancion" className="mt-8 inline-block">
          <Button className="rounded-full">Enviar mi primera canción</Button>
        </Link>
      </section>
    );
  }

  if (sent) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-20 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
        <h1 className="mt-4 font-heading text-3xl font-extrabold">¡Canción recibida!</h1>
        <p className="mt-3 text-muted-foreground">
          Tu canción está pendiente de aprobación. En cuanto el equipo de SONORIA FM la revise y la apruebe, empezará a sonar en la radio.
          Te avisaremos por email.
        </p>
        <Button className="mt-8 rounded-full" onClick={reset}>
          <Upload className="h-4 w-4" /> Subir otra canción
        </Button>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">Sube tu canción</h1>
      <p className="mt-2 text-muted-foreground">
        Subes como <strong className="text-foreground">{profile.artist_name}</strong>. Tu canción quedará pendiente de aprobación y
        solo sonará en la radio cuando el equipo la apruebe.
      </p>

      <form key={formKey} onSubmit={handleSubmit} className="mt-8 space-y-5 rounded-3xl border border-border bg-card p-6 sm:p-8">
        <div className="space-y-2">
          <Label htmlFor="title">Título de la canción <Req /></Label>
          <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" />
        </div>

        <div className="space-y-2">
          <Label>Tipo de música <Req /></Label>
          <Select value={genre} onValueChange={setGenre}>
            <SelectTrigger><SelectValue placeholder="Elige el tipo de música" /></SelectTrigger>
            <SelectContent>
              {genreOptions.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
          {genre === 'Otros' && (
            <Input
              required
              value={genreOther}
              onChange={(e) => setGenreOther(e.target.value)}
              maxLength={60}
              placeholder="Escribe el género o tipo de música"
            />
          )}
        </div>

        <div className="space-y-2">
          <Label>Idioma de la canción <Req /></Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger><SelectValue placeholder="Elige el idioma" /></SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Herramienta de IA usada <Req /></Label>
          <Select value={tool} onValueChange={setTool}>
            <SelectTrigger><SelectValue placeholder="Elige la herramienta" /></SelectTrigger>
            <SelectContent>
              {SUBMISSION_TOOLS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="lyrics">Letra <Req /></Label>
          <Textarea id="lyrics" rows={4} required value={lyrics} onChange={(e) => setLyrics(e.target.value)} placeholder="Letra de la canción…" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cover">Imagen de portada <Req /></Label>
          <Input id="cover" type="file" required accept="image/*" onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)} />
          {coverFile && (
            <img src={URL.createObjectURL(coverFile)} alt="Portada" className="h-24 w-24 rounded-xl object-cover" />
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="audio">Canción (MP3 o WAV, máx. {MAX_AUDIO_MB} MB) <Req /></Label>
          <Input
            id="audio"
            type="file"
            required
            accept=".mp3,.wav,audio/mpeg,audio/wav"
            onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
          />
          {audioFile && <p className="text-xs text-muted-foreground">Archivo: {audioFile.name}</p>}
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border p-4 text-sm">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
          />
          <span>
            Declaro que soy el artista o titular de los derechos de esta música, generada con IA bajo mi dirección creativa, y
            acepto los{' '}
            <Link to="/terminos" target="_blank" className="font-medium text-primary hover:underline">
              Términos para Artistas
            </Link>
            : concedo a SONORIA FM una licencia no exclusiva para emitirla, almacenarla y promocionarla.
          </span>
        </label>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={submitting} className="w-full rounded-full">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {submitting ? 'Subiendo…' : 'Subir canción'}
        </Button>
      </form>
    </section>
  );
}
