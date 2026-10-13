import { Link } from 'react-router-dom';
import { Image } from '@/components/ui/image';
import { CalendarDays } from 'lucide-react';

export function formatDate(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
}

export default function ArticleCard({ article }) {
  return (
    <Link
      to={`/noticias/${article.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary/50"
    >
      <div className="aspect-[16/10] overflow-hidden bg-secondary">
        {article.cover_url ? (
          <Image
            src={article.cover_url}
            alt={article.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary/30 to-accent/20" />
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-3 text-xs">
          {article.category && (
            <span className="rounded-full bg-primary/15 px-2.5 py-1 font-semibold uppercase tracking-wider text-primary">
              {article.category}
            </span>
          )}
          {article.published_date && (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatDate(article.published_date)}
            </span>
          )}
        </div>
        <h3 className="mt-3 font-heading text-lg font-bold leading-snug group-hover:text-primary">
          {article.title}
        </h3>
        {article.excerpt && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{article.excerpt}</p>}
      </div>
    </Link>
  );
}