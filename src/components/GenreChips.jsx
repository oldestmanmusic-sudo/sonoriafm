import { GENRES } from '@/lib/brand';
import { cn } from '@/lib/utils';

export const CHANNELS = ['Todo SONORIA', ...GENRES];

export default function GenreChips({ value, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar" role="tablist" aria-label="Canales por estilo">
      {CHANNELS.map((g) => (
        <button
          key={g}
          type="button"
          role="tab"
          aria-selected={value === g}
          onClick={() => onChange(g)}
          className={cn(
            'shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
            value === g
              ? 'border-primary bg-primary/15 text-primary'
              : 'border-border text-muted-foreground hover:bg-secondary hover:text-foreground'
          )}
        >
          {g}
        </button>
      ))}
    </div>
  );
}