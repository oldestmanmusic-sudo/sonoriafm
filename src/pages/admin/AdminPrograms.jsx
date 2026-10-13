import EntityManager from '@/components/admin/EntityManager';

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const FIELDS = [
  { name: 'title', label: 'Programa', type: 'text', required: true, fullWidth: true },
  { name: 'host', label: 'Presentador/a', type: 'text' },
  { name: 'day', label: 'Día', type: 'select', options: DAYS, required: true },
  { name: 'start_time', label: 'Hora de inicio', type: 'text', required: true, placeholder: '10:00' },
  { name: 'end_time', label: 'Hora de fin', type: 'text', required: true, placeholder: '12:00' },
  { name: 'genre', label: 'Estilo', type: 'text', placeholder: 'Indie, Soul…' },
  { name: 'description', label: 'Descripción', type: 'textarea', rows: 4, fullWidth: true },
];

export default function AdminPrograms() {
  return (
    <EntityManager
      entity="Program"
      title="Programación"
      description="Organiza la parrilla semanal de la emisora."
      fields={FIELDS}
      primaryField="title"
      secondaryFields={['day', 'start_time', 'end_time', 'host']}
      sort="start_time"
      defaults={{ day: 'Lun' }}
      emptyText="Aún no hay programas en la parrilla."
    />
  );
}