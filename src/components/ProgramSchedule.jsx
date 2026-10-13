import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function isOnAir(start, end) {
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  return cur >= s && cur <= e;
}

export default function ProgramSchedule() {
  const [programs, setPrograms] = useState(null);
  const [day, setDay] = useState('Lun');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { items } = await base44.entities.Program.filter({}, { sort: 'start_time', limit: 100 });
        if (active) setPrograms(items);
      } catch {
        if (active) setPrograms([]);
      }
    })();
    return () => { active = false; };
  }, []);

  const today = new Date().getDay(); // 0 Sun .. 6 Sat
  const todayKey = DAYS[(today + 6) % 7];
  const filtered = (programs ?? []).filter((p) => p.day === day).sort((a, b) => a.start_time.localeCompare(b.start_time));

  return (
    <section className="mx-auto max-w-4xl px-4 py-12">
      <h2 className="font-heading text-2xl font-bold mb-6">Programación</h2>

      {programs === null ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-6">
            {DAYS.map((d) => (
              <button
                key={d}
                onClick={() => setDay(d)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${day === d ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
              >
                {d}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <p className="text-muted-foreground">No hay programas para este día.</p>
          ) : (
            <div className="space-y-3">
              {filtered.map((p) => {
                const onAir = day === todayKey && isOnAir(p.start_time, p.end_time);
                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-4 rounded-2xl border p-4 ${onAir ? 'border-accent/50 bg-accent/5' : 'border-border bg-card'}`}
                  >
                    <div className="text-center shrink-0 w-20">
                      <p className="text-sm font-bold">{p.start_time}</p>
                      <p className="text-xs text-muted-foreground">{p.end_time}</p>
                    </div>
                    <div className="h-10 w-px bg-border" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">{p.title}</h3>
                        {onAir && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-accent">
                            <span className="h-1.5 w-1.5 rounded-full bg-accent pulse-live" /> On Air
                          </span>
                        )}
                      </div>
                      {p.host && <p className="text-sm text-muted-foreground">con {p.host}</p>}
                      {p.genre && <span className="mt-1 inline-block text-xs text-primary">{p.genre}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}