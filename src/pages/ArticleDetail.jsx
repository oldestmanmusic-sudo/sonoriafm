import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Image } from '@/components/ui/image';
import { formatDate } from '@/components/news/ArticleCard';
import ArticleBody from '@/components/news/ArticleBody';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CalendarDays, Loader2, Share2, User } from 'lucide-react';

// Enlace para compartir: muestra el título y la foto de la noticia y lleva a ella.
const shareUrl = (id) => `https://sonoriafm.com/functions/compartirNoticia?id=${id}`;

export default function ArticleDetail() {
  const { id } = useParams();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = shareUrl(article.id);
    if (navigator.share) {
      try {
        await navigator.share({ title: article.title, url });
        return;
      } catch { /* cancelado */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await base44.entities.Article.get(id);
        if (active) {
          setArticle(data);
          // Título y descripción propios de cada noticia (pestaña, compartir y buscadores).
          if (data?.title) document.title = `${data.title} · SONORIA FM`;
          const desc = data?.excerpt || '';
          let meta = document.querySelector('meta[name="description"]');
          if (meta && desc) meta.setAttribute('content', desc);
        }
      } catch {
        if (active) setArticle(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="font-heading text-2xl font-bold">Artículo no encontrado</h1>
        <p className="mt-2 text-muted-foreground">Puede que se haya movido o ya no esté disponible.</p>
        <Link to="/noticias" className="mt-6 inline-flex items-center gap-2 text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Volver a Noticias
        </Link>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <Link to="/noticias" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Noticias
      </Link>

      <div className="mt-6 flex flex-wrap items-center gap-3 text-xs">
        {article.category && (
          <span className="rounded-full bg-primary/15 px-2.5 py-1 font-semibold uppercase tracking-wider text-primary">
            {article.category}
          </span>
        )}
        {article.published_date && (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" /> {formatDate(article.published_date)}
          </span>
        )}
        {article.author && (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <User className="h-3.5 w-3.5" /> {article.author}
          </span>
        )}
      </div>

      <h1 className="mt-4 font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">{article.title}</h1>

      <Button onClick={share} variant="outline" size="sm" className="mt-4 rounded-full">
        <Share2 className="h-4 w-4" /> {copied ? 'Enlace copiado' : 'Compartir'}
      </Button>

      {article.excerpt && <p className="mt-4 text-lg text-muted-foreground">{article.excerpt}</p>}

      {article.cover_url && (
        <div className="mt-8 aspect-[16/9] overflow-hidden rounded-2xl border border-border bg-secondary">
          <Image src={article.cover_url} alt={article.title} className="h-full w-full object-cover" />
        </div>
      )}

      <ArticleBody content={article.content || ''} />

      <div className="mt-10 flex justify-center">
        <Button onClick={share} variant="outline" className="rounded-full">
          <Share2 className="h-4 w-4" /> {copied ? 'Enlace copiado' : 'Compartir noticia'}
        </Button>
      </div>
    </article>
  );
}