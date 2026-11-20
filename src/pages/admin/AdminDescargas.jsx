import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Download, Loader2, FileArchive, AlertCircle, CheckCircle2 } from 'lucide-react';

function formatBytes(n) {
  if (!n && n !== 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function AdminDescargas() {
  const [status, setStatus] = useState('idle'); // idle | working | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const triggerDownload = (url, filename) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'sonoria-canciones.zip';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleDownload = async () => {
    setStatus('working');
    setError(null);
    setResult(null);
    try {
      const res = await base44.functions.invoke('descargarCancionesZip', {});
      const data = res.data;
      if (data?.error) throw new Error(data.error);
      setResult(data);
      triggerDownload(data.url, data.filename);
      setStatus('done');
    } catch (e) {
      setError(e?.message || 'No se pudo generar el ZIP.');
      setStatus('error');
    }
  };

  return (
    <div>
      <div>
        <h1 className="font-heading text-2xl font-bold">Descargar canciones</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Genera un archivo ZIP con todas las canciones del catálogo y lo descarga a tu dispositivo.
        </p>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-6 sm:p-8">
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <FileArchive className="h-7 w-7" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Todas las canciones</p>
            <p className="text-sm text-muted-foreground">
              Se recopilan los audios del catálogo, se empaquetan en un ZIP y se descargan.
              Puede tardar unos minutos según cuántas canciones haya.
            </p>
          </div>
          <Button
            onClick={handleDownload}
            disabled={status === 'working'}
            className="rounded-full shrink-0"
          >
            {status === 'working' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generando…
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" /> Descargar ZIP
              </>
            )}
          </Button>
        </div>

        {status === 'done' && result && (
          <div className="mt-5 flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">ZIP listo con {result.count} canciones{result.sizeBytes ? ` · ${formatBytes(result.sizeBytes)}` : ''}.</p>
              <p className="mt-0.5">Si no empezó la descarga, usa el botón para repetirla (el enlace caduca en 10 minutos).</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 rounded-full"
                onClick={() => triggerDownload(result.url, result.filename)}
              >
                <Download className="mr-2 h-4 w-4" /> Descargar de nuevo
              </Button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="mt-5 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}