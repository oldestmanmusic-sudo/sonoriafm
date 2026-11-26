// Genera una tarjeta PNG (1080x1350) para compartir una canción en redes.
const W = 1080;
const H = 1350;

const loadImage = (src) =>
  new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

function fitText(ctx, text, maxWidth, startSize, weight = '800') {
  let size = startSize;
  while (size > 28) {
    ctx.font = `${weight} ${size}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// La carátula tiene que poder dibujarse en la imagen: si el servidor de origen no lo permite,
// se pide la misma ruta desde la propia web.
async function loadCover(src) {
  const direct = await loadImage(src);
  if (direct) return direct;
  const local = src.replace(/^https:\/\/base44\.app(?=\/api\/)/, '');
  return local !== src ? loadImage(local) : null;
}

export const cardFileName = (title) =>
  `${(title || 'cancion').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').toLowerCase()}-sonoria-fm.png`;

export async function buildShareCard({ title, artist, coverUrl, url = 'sonoriafm.com', headline = 'VOTA ESTA CANCIÓN' }) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Fondo
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0A0C1C');
  bg.addColorStop(0.6, '#1a1040');
  bg.addColorStop(1, '#3b1260');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Carátula
  const size = 730;
  const x = (W - size) / 2;
  const y = 150;
  const cover = coverUrl ? await loadCover(coverUrl) : null;
  ctx.save();
  roundRect(ctx, x, y, size, size, 48);
  ctx.clip();
  if (cover) {
    const s = Math.max(size / cover.width, size / cover.height);
    const w = cover.width * s;
    const h = cover.height * s;
    ctx.drawImage(cover, x + (size - w) / 2, y + (size - h) / 2, w, h);
  } else {
    const g = ctx.createLinearGradient(x, y, x + size, y + size);
    g.addColorStop(0, '#4f7cff');
    g.addColorStop(1, '#ff4d8d');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  fitText(ctx, headline, W - 140, 68);
  ctx.fillText(headline, W / 2, 105);

  // Título y artista
  ctx.fillStyle = '#FFFFFF';
  const t = title || '';
  fitText(ctx, t, W - 140, 68);
  ctx.fillText(t, W / 2, y + size + 90);

  ctx.fillStyle = '#D8D8E8';
  const a = artist || '';
  fitText(ctx, a, W - 140, 46, '600');
  ctx.fillText(a, W / 2, y + size + 155);

  // Botón de voto
  ctx.fillStyle = '#FF4D8D';
  roundRect(ctx, (W - 720) / 2, 1085, 720, 104, 52);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 44px system-ui, sans-serif';
  ctx.fillText('♥ VOTA SIN REGISTRARTE', W / 2, 1153);

  // Pie
  ctx.fillStyle = '#B9A4FF';
  ctx.font = '700 40px system-ui, sans-serif';
  ctx.fillText(`SONORIA FM · ${url}`, W / 2, H - 70);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  return blob;
}

export async function shareOrDownloadCard(opts) {
  const blob = await buildShareCard(opts);
  if (!blob) throw new Error('no se pudo crear la imagen');
  const name = cardFileName(opts.title);
  const file = new File([blob], name, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `${opts.title} — ${opts.artist}`, text: opts.text || '' });
      return 'shared';
    } catch { /* cancelado: se descarga */ }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return 'downloaded';
}
