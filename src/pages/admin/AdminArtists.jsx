import EntityManager from '@/components/admin/EntityManager';

const FIELDS = [
  { name: 'name', label: 'Nombre', type: 'text', required: true, fullWidth: true },
  { name: 'genre', label: 'Género', type: 'text', placeholder: 'Pop Rock' },
  { name: 'country', label: 'País', type: 'text', placeholder: 'España' },
  { name: 'likes', label: 'Me gusta', type: 'number' },
  { name: 'image_url', label: 'URL de la imagen', type: 'text', fullWidth: true, placeholder: 'https://…' },
  { name: 'social_url', label: 'Enlace a redes (Spotify, Instagram…)', type: 'text', fullWidth: true, placeholder: 'https://…' },
  { name: 'bio', label: 'Biografía', type: 'textarea', rows: 5, fullWidth: true },
];

export default function AdminArtists() {
  return (
    <EntityManager
      entity="Artist"
      title="Artistas"
      description="Perfiles de los artistas destacados en la web."
      fields={FIELDS}
      primaryField="name"
      secondaryFields={['genre', 'country']}
      thumbnailField="image_url"
      searchField="name"
      sort="-likes"
      defaults={{ likes: 0 }}
      emptyText="Aún no hay artistas. Añade el primero."
    />
  );
}