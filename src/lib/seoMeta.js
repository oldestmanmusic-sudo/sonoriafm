// Etiquetas para compartir (WhatsApp, Facebook, X...). La captura que Base44 sirve a los
// buscadores y a las redes recoge lo que la página escribe aquí, así que cada canción, artista
// o noticia sale con su propio título, texto e imagen al compartir el enlace.
function setTag(attr, key, value) {
  if (!value) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

export function setShareMeta({ title, description, image }) {
  try {
    const url = window.location.href.split('#')[0];
    if (title) {
      setTag('property', 'og:title', title);
      setTag('name', 'twitter:title', title);
    }
    if (description) {
      setTag('name', 'description', description);
      setTag('property', 'og:description', description);
      setTag('name', 'twitter:description', description);
    }
    if (image && /^https:\/\//.test(image)) {
      setTag('property', 'og:image', image);
      setTag('name', 'twitter:image', image);
    }
    setTag('property', 'og:url', url);
    setTag('name', 'twitter:url', url);
  } catch {
    /* sin DOM */
  }
}
