import EntityManager from '@/components/admin/EntityManager';

const CATEGORIES = ['Artistas', 'Novedades', 'Eventos', 'Radio'];

const FIELDS = [
  { name: 'title', label: 'Título', type: 'text', required: true, fullWidth: true },
  { name: 'category', label: 'Categoría', type: 'select', options: CATEGORIES },
  { name: 'author', label: 'Autor', type: 'text', placeholder: 'Redacción SONORIA FM' },
  { name: 'published_date', label: 'Fecha de publicación', type: 'date' },
  { name: 'cover_url', label: 'URL de la imagen', type: 'text', fullWidth: true, placeholder: 'https://…' },
  { name: 'excerpt', label: 'Entradilla', type: 'textarea', rows: 3, fullWidth: true, help: 'Resumen corto que aparece en el listado de Noticias.' },
  { name: 'content', label: 'Contenido', type: 'textarea', rows: 12, required: true, fullWidth: true, help: 'Separa los párrafos con una línea en blanco.' },
];

export default function AdminArticles() {
  return (
    <EntityManager
      entity="Article"
      title="Artículos"
      description="Publica noticias y novedades de SONORIA FM."
      fields={FIELDS}
      primaryField="title"
      secondaryFields={['category', 'author', 'published_date']}
      thumbnailField="cover_url"
      searchField="title"
      sort="-published_date"
      defaults={{ category: 'Novedades', author: 'Redacción SONORIA FM' }}
      emptyText="Todavía no hay artículos. Crea el primero."
    />
  );
}