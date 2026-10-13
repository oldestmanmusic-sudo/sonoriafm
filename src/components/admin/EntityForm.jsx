import { useState } from 'react';
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
import { Loader2 } from 'lucide-react';

function toInputValue(field, value) {
  if (value === null || value === undefined) return '';
  if (field.type === 'datetime') {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return String(value);
}

export default function EntityForm({ fields, initialValues = {}, onSubmit, onCancel }) {
  const [values, setValues] = useState(() => {
    const initial = {};
    fields.forEach((f) => { initial[f.name] = toInputValue(f, initialValues[f.name]); });
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (name, value) => setValues((prev) => ({ ...prev, [name]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const missing = fields.filter((f) => f.required && !String(values[f.name] ?? '').trim());
    if (missing.length) {
      setError('Completa los campos obligatorios: ' + missing.map((m) => m.label).join(', '));
      return;
    }

    const payload = {};
    fields.forEach((f) => {
      const raw = values[f.name];
      if (f.type === 'number') {
        if (raw === '' || raw === null || raw === undefined) return;
        payload[f.name] = Number(raw);
      } else if (f.type === 'datetime') {
        if (!raw) return;
        payload[f.name] = new Date(raw).toISOString();
      } else {
        payload[f.name] = typeof raw === 'string' ? raw.trim() : raw;
      }
    });

    setSaving(true);
    setError('');
    try {
      await onSubmit(payload);
    } catch {
      setError('No se pudo guardar. Inténtalo de nuevo.');
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.name} className={f.fullWidth ? 'sm:col-span-2 space-y-2' : 'space-y-2'}>
            <Label htmlFor={`field-${f.name}`}>
              {f.label}
              {f.required && <span className="text-primary"> *</span>}
            </Label>

            {f.type === 'textarea' ? (
              <Textarea
                id={`field-${f.name}`}
                rows={f.rows || 4}
                value={values[f.name]}
                onChange={(e) => set(f.name, e.target.value)}
                placeholder={f.placeholder}
              />
            ) : f.type === 'select' ? (
              <Select value={values[f.name]} onValueChange={(v) => set(f.name, v)}>
                <SelectTrigger id={`field-${f.name}`}>
                  <SelectValue placeholder={f.placeholder || 'Selecciona…'} />
                </SelectTrigger>
                <SelectContent>
                  {f.options.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id={`field-${f.name}`}
                type={f.type === 'number' ? 'number' : f.type === 'datetime' ? 'datetime-local' : f.type || 'text'}
                value={values[f.name]}
                onChange={(e) => set(f.name, e.target.value)}
                placeholder={f.placeholder}
              />
            )}

            {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </form>
  );
}