import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import ArticleCard from '@/components/news/ArticleCard';
import { Loader2, Newspaper } from 'lucide-react';

export default function Noticias() {
  const [articles, setArticles] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { items } = await base44.entities.Article.filter({}, { sort: '-published_date', limit: 30 });
        if (active) setArticles(items);
      } catch {
        if (active) setArticles([]);
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
      <div className="max-w-2xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
          <Newspaper className="h-3.5 w-3.5" /> Blog
        </span>
        <h1 className="mt-4 font-heading text-4xl font-extrabold tracking-tight sm:text-5xl">Noticias</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Artistas destacados, novedades musicales y todo lo que pasa en la radio.
        </p>
      </div>

      {articles === null ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : articles.length === 0 ? (
        <p className="mt-10 text-muted-foreground">Todavía no hay artículos publicados. Vuelve pronto.</p>
      ) : (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a) => (
            <ArticleCard key={a.id} article={a} />
          ))}
        </div>
      )}
    </div>
  );
}