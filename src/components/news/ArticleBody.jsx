import { createElement } from 'react';

// Cuerpo de una noticia. Las del panel de administración son texto plano (párrafos
// separados por una línea en blanco); algunas llegan con HTML sencillo. En ese caso
// se convierte a elementos de React con una lista cerrada de etiquetas, sin insertar
// HTML directamente: ni scripts, ni estilos, ni atributos salvo el destino del enlace.
const CLASSES = {
  p: '',
  h2: 'pt-3 font-heading text-2xl font-bold',
  h3: 'pt-2 font-heading text-xl font-bold',
  ul: 'list-disc space-y-2 pl-6',
  ol: 'list-decimal space-y-2 pl-6',
  li: '',
  strong: 'font-semibold',
  b: 'font-semibold',
  em: '',
  i: '',
  br: '',
  blockquote: 'border-l-2 border-primary pl-4 italic',
};
const DROP = ['script', 'style', 'iframe', 'object', 'embed', 'template', 'noscript'];
const HTML_RE = /<\/?(p|h[1-6]|ul|ol|li|br|strong|em|a|blockquote|div)\b[^>]*>/i;

function toReact(node, key) {
  if (node.nodeType === 3) {
    // Los saltos de línea entre bloques de una lista no son contenido.
    const inList = ['UL', 'OL'].includes(node.parentNode?.nodeName);
    return inList && !node.textContent.trim() ? null : node.textContent;
  }
  if (node.nodeType !== 1) return null;
  const tag = node.nodeName.toLowerCase();
  if (DROP.includes(tag)) return null;
  const children = Array.from(node.childNodes).map(toReact);
  if (tag === 'a') {
    const href = (node.getAttribute('href') || '').trim();
    if (!/^(https?:\/\/|mailto:|\/(?!\/))/i.test(href)) return <span key={key}>{children}</span>;
    const external = /^https?:\/\//i.test(href) && !/^https?:\/\/(www\.)?sonoriafm\.com/i.test(href);
    return (
      <a
        key={key}
        href={href}
        className="text-primary hover:underline"
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {children}
      </a>
    );
  }
  if (!(tag in CLASSES)) return <span key={key}>{children}</span>;
  if (tag === 'br') return <br key={key} />;
  return createElement(tag, { key, className: CLASSES[tag] || undefined }, ...children);
}

export default function ArticleBody({ content = '' }) {
  if (HTML_RE.test(content)) {
    const doc = new DOMParser().parseFromString(content, 'text/html');
    const blocks = Array.from(doc.body.childNodes).filter((n) => n.nodeType !== 3 || n.textContent.trim());
    return <div className="mt-8 space-y-5 leading-relaxed text-foreground/90">{blocks.map(toReact)}</div>;
  }
  return (
    <div className="mt-8 space-y-5 leading-relaxed text-foreground/90">
      {content.split(/\n\s*\n/).filter(Boolean).map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}
