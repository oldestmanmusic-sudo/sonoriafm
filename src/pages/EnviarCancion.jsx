import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { GENRES, SUBMISSION_TOOLS } from '@/lib/brand';
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
    genre: 'Pop latino',
    audio_link: '',
    tool: 'Suno',
    lyrics: '',
  });
  const [file, setFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [artistImageFile, setArtistImageFile] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const set = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.artist_name.trim() || !form.email.trim() || !form.song_title.trim()) {
      setError('Completa tu nombre artístico, email y título de la canción.');
      return;
    }
    if (!form.audio_link.trim() && !file) {
      setError('Añade un enlace al audio o sube el archivo de tu canción.');
      return;
    }
    if (!confirmed) {
      setError('Confirma que la música es tuya y que aceptas que se publique.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      let audio_file_uri = null;
      if (file) {
        const res = await base44.integrations.Core.UploadPrivateFile({ file });
        audio_file_uri = res.file_uri;
      }
      let cover_file_uri = null;
      if (coverFile) {
        const res = await base44.integrations.Core.UploadPrivateFile({ file: coverFile });
        cover_file_uri = res.file_uri;
      }
      let artist_image_uri = null;
      if (artistImageFile) {
        const res = await base44.integrations.Core.UploadPrivateFile({ file: artistImageFile });
        artist_image_uri = res.file_uri;
      }
      await base44.entities.Submission.create({
        artist_name: form.artist_name.trim(),
        email: form.email.trim(),
        song_title: form.song_title.trim(),
        genre: form.genre,
        audio_link: form.audio_link.trim(),
        audio_file_uri,
        cover_file_uri,
        artist_image_uri,
        tool: form.tool,
        lyrics: form.lyrics.trim(),
        confirmed: true,
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
          Necesitas una cuenta en SONORIA para enviarnos tu canción. Regístrate o inicia sesión y continúa donde estabas.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/login?returnTo=/envia-tu-cancion">
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
          Tu canción está pendiente de revisión. Si la aprobamos, sonará pronto en SONORIA.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">Envía tu canción</h1>
      <p className="mt-2 text-muted-foreground">
        ¿Haces música con IA? Envíanos tu tema: entrará como pendiente y el equipo de SONORIA la revisará antes de publicarla.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5 rounded-3xl border border-border bg-card p-6 sm:p-8">
        <div className="space-y-2">
          <Label htmlFor="artist_name">Nombre artístico <span className="text-primary">*</span></Label>
          <Input id="artist_name" value={form.artist_name} onChange={(e) => set('artist_name', e.target.value)} placeholder="Tu nombre de artista" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email <span className="text-primary">*</span></Label>
          <Input id="email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="tu@email.com" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="artist_image">Imagen del artista (opcional)</Label>
          <Input id="artist_image" type="file" accept="image/*" onChange={(e) => setArtistImageFile(e.target.files?.[0] ?? null)} />
          {artistImageFile && (
            <img src={URL.createObjectURL(artistImageFile)} alt="Imagen del artista" className="h-24 w-24 rounded-xl object-cover" />
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="song_title">Título de la canción <span className="text-primary">*</span></Label>
            <Input id="song_title" value={form.song_title} onChange={(e) => set('song_title', e.target.value)} placeholder="Título" />
          </div>
          <div className="space-y-2">
            <Label>Género</Label>
            <Select value={form.genre} onValueChange={(v) => set('genre', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {GENRES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="audio_link">Enlace al audio</Label>
          <Input id="audio_link" value={form.audio_link} onChange={(e) => set('audio_link', e.target.value)} placeholder="https://…" />
          <p className="text-xs text-muted-foreground">O sube el archivo de audio (máx. 25 MB).</p>
          <Input type="file" accept="audio/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {file && <p className="text-xs text-muted-foreground">Archivo: {file.name}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="cover">Carátula de la canción (opcional)</Label>
          <Input id="cover" type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)} />
          {coverFile && (
            <img src={URL.createObjectURL(coverFile)} alt="Carátula" className="h-24 w-24 rounded-xl object-cover" />
          )}
        </div>

        <div className="space-y-2">
          <Label>Herramienta usada</Label>
          <Select value={form.tool} onValueChange={(v) => set('tool', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SUBMISSION_TOOLS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="lyrics">Letra (opcional)</Label>
          <Textarea id="lyrics" rows={4} value={form.lyrics} onChange={(e) => set('lyrics', e.target.value)} placeholder="Letra de la canción…" />
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border p-4 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
          />
          <span>
            Confirmo que la música es mía (o tengo permiso para publicarla) y acepto que SONORIA la emita en la radio.
          </span>
        </label>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={submitting} className="w-full rounded-full">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {submitting ? 'Enviando…' : 'Enviar canción'}
        </Button>
      </form>

      <p className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Mail className="h-4 w-4" />
        ¿Prefieres el correo? Escríbenos a
        <a href="mailto:Oldestmanmusic@gmail.com" className="font-medium text-primary hover:underline">Oldestmanmusic@gmail.com</a>
      </p>
    </section>
  );
}