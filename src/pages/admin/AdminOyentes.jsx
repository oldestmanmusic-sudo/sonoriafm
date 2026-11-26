import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';

const PAGE = 1000;
const MAX_PAGES = 30;

const madridDay = (ms) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(ms));

const label = (day) => {
  const [y, m, d] = day.split('-');
  return `${d}/${m}/${y}`;
};

// Cada registro es un minuto de escucha; cada "sid" distinto, una conexión.
function summary(rows) {
  return { minutes: rows.length, listeners: new Set(rows.map((r) => r.sid)).size };
}

function Card({ title, data }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <p className="mt-2 font-heading text-3xl font-extrabold">{data.listeners}</p>
      <p className="text-sm text-muted-foreground">conexiones · {data.minutes} minutos escuchados</p>
    </div>
  );
}

export default function AdminOyentes() {
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const since = madridDay(Date.now() - 29 * 86400000);
      const all = [];
      for (let page = 0; page < MAX_PAGES; page++) {
        const res = await base44.entities.ListenStat.filter(
          { date: { $gte: since } },
          { sort: '-created_date', limit: PAGE, skip: page * PAGE }
        );
        const items = Array.isArray(res) ? res : res?.items || [];
        all.push(...items);
        if (items.length < PAGE) break;
      }
      setRows(all.filter((r) => !r.own));
    } catch {
      setError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const today = madridDay(Date.now());
  const weekStart = madridDay(Date.now() - 6 * 86400000);
  const list = rows || [];
  const now = Date.now();
  const live = list.filter((r) => {
    const s = String(r.created_date || '');
    const ms = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`);
    return Number.isFinite(ms) && now - ms < 150000;
  });
  const days = [...new Set(list.map((r) => r.date))].sort().reverse();
  const songs = Object.values(
    list
      .filter((r) => r.date >= weekStart && r.track_id)
      .reduce((acc, r) => {
        acc[r.track_id] = acc[r.track_id] || { id: r.track_id, title: r.title, artist: r.artist, minutes: 0 };
        acc[r.track_id].minutes += 1;
        return acc;
      }, {})
  )
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 10);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Oyentes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Escucha real en la web, sin contar tus propias escuchas con la sesión iniciada. Cada conexión es una visita que
            ha escuchado al menos un minuto. La app de Android todavía no se cuenta.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading} className="rounded-full">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Actualizar
        </Button>
      </div>

      {error && <p className="mt-6 text-sm text-destructive">No se han podido cargar las cifras. Prueba a actualizar.</p>}

      {rows && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card title="Ahora mismo" data={summary(live)} />
            <Card title="Hoy" data={summary(list.filter((r) => r.date === today))} />
            <Card title="Últimos 7 días" data={summary(list.filter((r) => r.date >= weekStart))} />
            <Card title="Últimos 30 días" data={summary(list)} />
          </div>

          {list.length === 0 ? (
            <p className="mt-8 text-muted-foreground">
              Todavía no hay escuchas registradas. El contador empezó el 26/11/2026.
            </p>
          ) : (
            <div className="mt-8 grid gap-8 lg:grid-cols-2">
              <div>
                <h2 className="font-heading text-lg font-bold">Por día</h2>
                <table className="mt-3 w-full text-sm">
                  <thead className="text-left text-muted-foreground">
                    <tr><th className="py-2">Día</th><th>Conexiones</th><th>Minutos</th></tr>
                  </thead>
                  <tbody>
                    {days.map((d) => {
                      const s = summary(list.filter((r) => r.date === d));
                      return (
                        <tr key={d} className="border-t border-border">
                          <td className="py-2">{label(d)}</td><td>{s.listeners}</td><td>{s.minutes}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div>
                <h2 className="font-heading text-lg font-bold">Canciones más escuchadas (7 días)</h2>
                <table className="mt-3 w-full text-sm">
                  <thead className="text-left text-muted-foreground">
                    <tr><th className="py-2">Canción</th><th>Minutos</th></tr>
                  </thead>
                  <tbody>
                    {songs.map((s) => (
                      <tr key={s.id} className="border-t border-border">
                        <td className="py-2">{s.title} · {s.artist}</td><td>{s.minutes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
