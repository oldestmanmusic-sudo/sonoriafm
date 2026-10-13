import EntityManager from '@/components/admin/EntityManager';

const FIELDS = [
  { name: 'title', label: 'Tema', type: 'text', required: true, fullWidth: true },
  { name: 'artist', label: 'Artista', type: 'text', required: true },
  { name: 'artist_id', label: 'ID del artista', type: 'text', help: 'Opcional. Enlaza el tema con su perfil.' },
  { name: 'played_at', label: 'Emitido el', type: 'datetime' },
  { name: 'cover_url', label: 'URL de la carátula', type: 'text', fullWidth: true, placeholder: 'https://…' },
];

export default function AdminTracks() {
  return (
    <EntityManager
      entity="Track"
      title="Historial"
      description="Temas que aparecen en el historial musical de la web."
      fields={FIELDS}
      primaryField="title"
      secondaryFields={['artist', 'played_at']}
      thumbnailField="cover_url"
      searchField="title"
      sort="-played_at"
      emptyText="Aún no hay temas en el historial."
    />
  );
}