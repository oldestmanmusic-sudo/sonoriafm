import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Loader2, Inbox, Check, X, ExternalLink, Sparkles } from 'lucide-react';

const TABS = [
  { key: 'pending', label: 'Pendientes' },
  { key: 'approved', label: 'Aprobadas' },
  { key: 'rejected', label: 'Rechazadas' },
];

export default function AdminSubmissions() {
  const [status, setStatus] = useState('pending');
  const [items, setItems] = useState(null);
  const [notes, setNotes] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [audioUrls, setAudioUrls] = useState({});
  const [aiOpinions, setAiOpinions] = useState({});
  const [aiBusyId, setAiBusyId] = useState(null);

  const getOpinion = async (item) => {
    if (aiBusyId) return;
    setAiBusyId(item.id);
    try {
      const res = await base44.functions.invoke('aiSubmissionOpinion', { submission_id: item.id });
      if (res.data?.opinion) setAiOpinions((prev) => ({ ...prev, [item.id]: res.data.opinion }));
    } finally {
      setAiBusyId(null);
    }
  };

  const load = useCallback(async () => {
    setItems(null);
    try {
      const { items: rows } = await base44.entities.Submission.filter({ status }, { sort: '-created_date', limit: 100 });
      setItems(rows);
      const signed = {};
      for (const r of rows) {
        if (r.audio_file_uri) {
          try {
            const res = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: r.audio_file_uri, expires_in: 3600 });
            signed[r.id] = res.signed_url;
          } catch { /* ignore */ }
        }
      }
      setAudioUrls(signed);
    } catch {
      setItems([]);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const decide = async (item, decision) => {
    setBusyId(item.id);
    try {
      if (decision === 'approve') {
        const { items: existing } = await base44.entities.Artist.filter({ name: item.artist_name }, { limit: 1 });
        let artistId = existing.length ? existing[0].id : null;
        if (!artistId) {
          const created = await base44.entities.Artist.create({
            name: item.artist_name,
            genre: item.genre,
            bio: item.artist_bio || '',
            image_url: item.artist_image_url || '',
            likes: 0,
          });
          artistId = created.id;
        } else if (item.artist_bio || item.artist_image_url) {
          // Si el artista ya tenia ficha, completamos solo lo que le falte.
          const patch = {};
          if (item.artist_bio && !existing[0].bio) patch.bio = item.artist_bio;
          if (item.artist_image_url && !existing[0].image_url) patch.image_url = item.artist_image_url;
          if (Object.keys(patch).length) await base44.entities.Artist.update(artistId, patch);
        }
        const { items: exTrack } = await base44.entities.Track.filter({ title: item.song_title, artist: item.artist_name }, { limit: 1 });
        if (!exTrack.length) {
          await base44.entities.Track.create({
            title: item.song_title,
            artist: item.artist_name,
            artist_id: artistId,
            genre: item.genre || 'Otros',
            cover_url: item.cover_url || '',
            description: item.description || '',
            audio_url: item.audio_link || '',
            played_at: new Date().toISOString(),
          });
        }
        await base44.entities.Submission.update(item.id, {
          status: 'approved',
          admin_note: notes[item.id] ?? item.admin_note ?? '',
        });
        await base44.functions.invoke('notifySubmissionDecision', { submission_id: item.id, decision: 'approved' });
      } else if (decision === 'reject') {
        await base44.entities.Submission.update(item.id, {
          status: 'rejected',
          admin_note: notes[item.id] ?? item.admin_note ?? '',
        });
        await base44.functions.invoke('notifySubmissionDecision', { submission_id: item.id, decision: 'rejected' });
      }
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/40">
          <Inbox className="h-5 w-5 text-primary" />
        </span>
        <div>
          <h1 className="font-heading text-2xl font-bold">Envíos</h1>
          <p className="text-sm text-muted-foreground">Canciones enviadas por los artistas. Aprueba las que quieras emitir.</p>
        </div>
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setStatus(t.key)}
            className={cn(
              'shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
              status === t.key
                ? 'border-primary bg-primary/15 text-primary'
                : 'border-border text-muted-foreground hover:bg-secondary hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {items === null ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
            No hay envíos en esta bandeja.
          </p>
        ) : (
          items.map((s) => {
            const audioSrc = audioUrls[s.id] || s.audio_link || null;
            return (
              <article key={s.id} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-heading text-lg font-bold">{s.song_title}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {s.artist_name} · {s.email}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[s.genre, s.tool && `Herramienta: ${s.tool}`].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      size="sm"
                      className="rounded-full"
                      disabled={busyId === s.id}
                      onClick={() => decide(s, 'approve')}
                    >
                      {busyId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Aprobar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full text-destructive hover:text-destructive"
                      disabled={busyId === s.id}
                      onClick={() => decide(s, 'reject')}
                    >
                      <X className="h-4 w-4" /> Rechazar
                    </Button>
                  </div>
                </div>

                {s.audio_link && (
                  <a
                    href={s.audio_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> Abrir enlace del audio
                  </a>
                )}
                {audioSrc && (
                  <audio controls src={audioSrc} className="mt-3 w-full max-w-xl">
                    Tu navegador no soporta audio.
                  </audio>
                )}
                {!audioSrc && !s.audio_link && (
                  <p className="mt-3 text-xs text-muted-foreground">Sin audio adjunto.</p>
                )}

                {s.lyrics && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Ver letra</summary>
                    <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{s.lyrics}</p>
                  </details>
                )}

                <div className="mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    disabled={aiBusyId === s.id}
                    onClick={() => getOpinion(s)}
                  >
                    {aiBusyId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-primary" />}
                    {(s.ai_opinion || aiOpinions[s.id]) ? 'Renovar consejo de IA' : 'Consejo de IA'}
                  </Button>
                  {(aiOpinions[s.id] || s.ai_opinion) && (
                    <p className="mt-2 rounded-2xl border border-primary/30 bg-primary/5 p-3 text-sm leading-relaxed">
                      <span className="font-semibold text-primary">Consejo de IA: </span>
                      {aiOpinions[s.id] || s.ai_opinion}
                    </p>
                  )}
                </div>

                <div className="mt-3">
                  <Textarea
                    rows={2}
                    placeholder="Nota para el artista: se envía como motivo en el correo de rechazo…"
                    value={notes[s.id] ?? s.admin_note ?? ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [s.id]: e.target.value }))}
                    onBlur={() => {
                      const value = notes[s.id];
                      if (value !== undefined && value !== (s.admin_note ?? '')) {
                        base44.entities.Submission.update(s.id, { admin_note: value }).catch(() => {});
                      }
                    }}
                  />
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}