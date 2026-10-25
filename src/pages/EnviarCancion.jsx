import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { FORM_GENRES, LANGUAGES, SUBMISSION_TOOLS } from '@/lib/brand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Mail, Loader2, Send, CheckCircle2, LogIn } from 'lucide-react';

const Req = () => <span className="text-primary">*</span>;

export default function EnviarCancion() {
  const [authed, setAuthed] = useState(null);

  useEffect(() => {
    let active = true;
    base44.auth.isAuthenticated().then((ok) => { if (active) setAuthed(ok); });
    return () => { active = false; };
  }, []);

  const [form, setForm] = useState({
    artist_name: '',
    email: '',
    song_title: '',
    genre: '',
    language: '',
    artist_bio: '',
    description: '',
    tool: '',
    lyrics: '',
  });
  const [file, setFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [artistImageFile, setArtistImageFile] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const set = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  const normalizeTitle = (s) =>
    (s || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Todos los campos son obligatorios.
    const missing = [];
    if (!form.artist_name.trim()) missing.push('nombre artístico');
    if (!form.email.trim()) missing.push('email');
    if (!artistImageFile) missing.push('imagen del artista');
    if (!form.artist_bio.trim()) missing.push('descripción del artista');
    if (!form.song_title.trim()) missing.push('título de la canción');
    if (!form.genre) missing.push('género');
    if (!form.language) missing.push('idioma');
    if (!file) missing.push('archivo de audio');
    if (!coverFile) missing.push('carátula de la canción');
    if (!form.tool) missing.push('herramienta usada');
    if (!form.description.trim()) missing.push('descripción de la canción');
    if (!form.lyrics.trim()) missing.push('letra');
    if (missing.length) {
      setError(`Todos los campos son obligatorios. Falta: ${missing.join(', ')}.`);
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError('Introduce un email válido para que podamos contactarte.');
      return;
    }
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['mp3', 'wav'].includes(ext)) {
      setError('El archivo de audio debe ser MP3 o WAV.');
      return;
    }
    if (!artistImageFile.type.startsWith('image/') || !coverFile.type.startsWith('image/')) {
      setError('La imagen del artista y la carátula deben ser archivos de imagen.');
      return;
    }
    if (!confirmed) {
      setError('Debes confirmar las declaraciones sobre la titularidad y el origen de la música.');
      return;
    }
    if (!termsAccepted) {
      setError('Debes aceptar los Términos para Artistas para enviar la canción.');
      return;
    }

    // Anti-duplicados: mismo artista y título equivalente (mayúsculas y
    // paréntesis como "(Remastered)" no cuentan).
    try {
      const esc = form.artist_name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const { items: candidates } = await base44.entities.Track.filter(
        { artist: { $regex: `^${esc}$`, $options: 'i' } },
        { limit: 500, fields: ['title'] }
      );
      const wanted = normalizeTitle(form.song_title);
      if (candidates.some((t) => normalizeTitle(t.title) === wanted)) {
        setError('Esa canción ya está en SONORIA FM');
        return;
      }
    } catch { /* si la comprobación falla, seguimos con el envío normal */ }

    setSubmitting(true);
    setError('');
    try {
      // El audio, la carátula y la imagen del artista se suben a almacenamiento
      // público: la radio y las fichas de la web necesitan una URL permanente.
      const audioRes = await base44.integrations.Core.UploadPublicFile({ file });
      const coverRes = await base44.integrations.Core.UploadPublicFile({ file: coverFile });
      const imageRes = await base44.integrations.Core.UploadPublicFile({ file: artistImageFile });

      await base44.entities.Submission.create({
        artist_name: form.artist_name.trim(),
        email: form.email.trim(),
        song_title: form.song_title.trim(),
        genre: form.genre,
        language: form.language,
        audio_link: audioRes.file_url,
        cover_url: coverRes.file_url,
        artist_image_url: imageRes.file_url,
        artist_bio: form.artist_bio.trim(),
        tool: form.tool,
        lyrics: form.lyrics.trim(),
        description: form.description.trim(),
        confirmed: true,
        terms_accepted: true,
        terms_accepted_at: new Date().toISOString(),
      });
      setSent(true);
    } catch {
      setError('No se pudo enviar la canción. Inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  if (authed === null) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!authed) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-20 text-center">
        <LogIn className="mx-auto h-12 w-12 text-primary" />
        <h1 className="mt-4 font-heading text-3xl font-extrabold">Envía tu canción</h1>
        <p className="mt-3 text-muted-foreground">
          Necesitas una cuenta en SONORIA FM para enviarnos tu canción. Regístrate o inicia sesión y continúa donde estabas.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/login?returnTo=/subir-cancion">
            <Button className="rounded-full">Iniciar sesión</Button>
          </Link>
          <Link to="/register?returnTo=/envia-tu-cancion">
            <Button variant="outline" className="rounded-full">Crear cuenta</Button>
          </Link>
        </div>
      </section>
    );
  }

  if (sent) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-20 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
        <h1 className="mt-4 font-heading text-3xl font-extrabold">¡Canción recibida!</h1>
        <p className="mt-3 text-muted-foreground">
          Tu canción está pendiente de revisión. Si la aprobamos, sonará pronto en SONORIA FM.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">Envía tu canción</h1>
      <p className="mt-2 text-muted-foreground">
        ¿Haces música con IA? Envíanos tu tema: entrará como pendiente y el equipo de SONORIA FM la revisará antes de publicarla.
        Las canciones solo se aceptan a través de este formulario y <strong>todos los campos son obligatorios</strong>.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5 rounded-3xl border border-border bg-card p-6 sm:p-8">
        <div className="space-y-2">
          <Label htmlFor="artist_name">Nombre artístico <Req /></Label>
          <Input id="artist_name" required value={form.artist_name} onChange={(e) => set('artist_name', e.target.value)} placeholder="Tu nombre de artista" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email <Req /></Label>
          <Input id="email" type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="tu@email.com" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="artist_image">Imagen del artista <Req /></Label>
          <Input id="artist_image" type="file" accept="image/*" required onChange={(e) => setArtistImageFile(e.target.files?.[0] ?? null)} />
          {artistImageFile && (
            <img src={URL.createObjectURL(artistImageFile)} alt="Imagen del artista" className="h-24 w-24 rounded-xl object-cover" />
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="artist_bio">Descripción del artista <Req /></Label>
          <Textarea
            id="artist_bio"
            rows={3}
            required
            value={form.artist_bio}
            onChange={(e) => set('artist_bio', e.target.value)}
            placeholder="Cuéntanos quién eres: tu estilo, tus referencias, de dónde eres… Aparecerá en tu ficha de artista."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="song_title">Título de la canción <Req /></Label>
            <Input id="song_title" required value={form.song_title} onChange={(e) => set('song_title', e.target.value)} placeholder="Título" />
          </div>
          <div className="space-y-2">
            <Label>Tipo de música <Req /></Label>
            <Select value={form.genre} onValueChange={(v) => set('genre', v)}>
              <SelectTrigger><SelectValue placeholder="Elige el tipo de música" /></SelectTrigger>
              <SelectContent>
                {FORM_GENRES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Idioma de la canción <Req /></Label>
          <Select value={form.language} onValueChange={(v) => set('language', v)}>
            <SelectTrigger><SelectValue placeholder="Elige el idioma" /></SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="audio_file">Archivo de audio (MP3 o WAV, máx. 25 MB) <Req /></Label>
          <Input id="audio_file" type="file" required accept=".mp3,.wav,audio/mpeg,audio/wav" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {file && <p className="text-xs text-muted-foreground">Archivo: {file.name}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="cover">Carátula de la canción <Req /></Label>
          <Input id="cover" type="file" accept="image/*" required onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)} />
          {coverFile && (
            <img src={URL.createObjectURL(coverFile)} alt="Carátula" className="h-24 w-24 rounded-xl object-cover" />
          )}
        </div>

        <div className="space-y-2">
          <Label>Herramienta de IA usada <Req /></Label>
          <Select value={form.tool} onValueChange={(v) => set('tool', v)}>
            <SelectTrigger><SelectValue placeholder="Elige la herramienta" /></SelectTrigger>
            <SelectContent>
              {SUBMISSION_TOOLS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Descripción de la canción <Req /></Label>
          <Textarea
            id="description"
            rows={3}
            required
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Describe esta canción: de qué va, cómo la creaste… Aparecerá en su página."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="lyrics">Letra <Req /></Label>
          <Textarea id="lyrics" rows={4} required value={form.lyrics} onChange={(e) => set('lyrics', e.target.value)} placeholder="Letra de la canción…" />
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border p-4 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
          />
          <span>
            Declaro que soy el artista o titular legítimo de los derechos de esta música, que ha sido generada total o
            parcialmente con IA bajo mi dirección creativa, que cumplo las políticas de uso de la herramienta de IA
            utilizada y que la obra es original y no infringe derechos de terceros.
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border p-4 text-sm">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
          />
          <span>
            He leído y acepto los{' '}
            <Link to="/terminos" target="_blank" className="font-medium text-primary hover:underline">
              Términos para Artistas
            </Link>
            : concedo a Sonoria FM una licencia no exclusiva, mundial y gratuita para emitir, almacenar y promocionar mi
            música y asociar publicidad a su emisión, conservo la titularidad de mis derechos y asumo las
            responsabilidades e indemnización que se indican en ellos.
          </span>
        </label>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={submitting} className="w-full rounded-full">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {submitting ? 'Enviando…' : 'Enviar canción'}
        </Button>
      </form>

      <p className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
        <Mail className="h-4 w-4" />
        ¿Dudas sobre tu envío o tus derechos? Escríbenos a
        <a href="mailto:Oldestmanmusic@gmail.com" className="font-medium text-primary hover:underline">Oldestmanmusic@gmail.com</a>
      </p>
    </section>
  );
}
