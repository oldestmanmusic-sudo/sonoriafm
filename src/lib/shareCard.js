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

export async function buildShareCard({ title, artist, coverUrl, url = 'sonoriafm.com' }) {
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
  const size = 760;
  const x = (W - size) / 2;
  const y = 150;
  const cover = coverUrl ? await loadImage(coverUrl) : null;
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
  ctx.fillStyle = '#B9A4FF';
  ctx.font = '700 36px system-ui, sans-serif';
  ctx.fillText('SUENA EN SONORIA FM', W / 2, 100);

  // Título y artista
  ctx.fillStyle = '#FFFFFF';
  const t = title || '';
  fitText(ctx, t, W - 140, 72);
  ctx.fillText(t, W / 2, y + size + 100);

  ctx.fillStyle = '#D8D8E8';
  const a = artist || '';
  fitText(ctx, a, W - 140, 48, '600');
  ctx.fillText(a, W / 2, y + size + 170);

  // Pie
  ctx.fillStyle = '#FF4D8D';
  ctx.font = '700 44px system-ui, sans-serif';
  ctx.fillText(`📻 ${url}`, W / 2, H - 70);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  return blob;
}

export async function shareOrDownloadCard(opts) {
  const blob = await buildShareCard(opts);
  if (!blob) throw new Error('no se pudo crear la imagen');
  const name = `${(opts.title || 'cancion').replace(/[^\w]+/g, '-').toLowerCase()}-sonoria-fm.png`;
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
