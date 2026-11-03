import EntityManager from '@/components/admin/EntityManager';
import { useGenreOptions } from '@/lib/useGenres';

const makeFields = (GENRES) => [
  { name: 'title', label: 'Tema', type: 'text', required: true, fullWidth: true },
  { name: 'artist', label: 'Artista', type: 'text', required: true },
  { name: 'genre', label: 'Canal', type: 'select', options: GENRES, help: 'Sin género asignado, entra en «Otros».' },
  { name: 'duration', label: 'Duración', type: 'text', placeholder: '3:45' },
  { name: 'year', label: 'Año', type: 'number' },
  { name: 'album', label: 'Álbum', type: 'text' },
  { name: 'audio_url', label: 'URL del audio', type: 'text', fullWidth: true, placeholder: 'https://…' },
  { name: 'played_at', label: 'Emitido el', type: 'datetime' },
  { name: 'cover_url', label: 'URL de la carátula', type: 'text', fullWidth: true, placeholder: 'https://…' },
];

export default function AdminTracks() {
  const { options } = useGenreOptions();
  const FIELDS = makeFields(options);
  return (
    <EntityManager
      entity="Track"
      title="Historial"
      description="Temas publicados en la emisora y su ficha."
      fields={FIELDS}
      primaryField="title"
      secondaryFields={['artist', 'genre', 'played_at']}
      thumbnailField="cover_url"
      searchField="title"
      sort="-played_at"
      defaults={{ genre: 'Otros' }}
      emptyText="Aún no hay temas en el catálogo."
    />
  );
}