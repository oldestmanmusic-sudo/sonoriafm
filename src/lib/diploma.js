// Diploma PNG (1080x1350) para los premiados del TOP semanal.
const W = 1080;
const H = 1350;
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const ACCENTS = { 1: '#FFC846', 2: '#D5DBEA', 3: '#E39A5F' };
const FONT = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';

export const positionLabel = (p) => ({ 1: '1.er PUESTO', 2: '2.º PUESTO', 3: '3.er PUESTO' }[p] || '');

// El cierre se guarda con la fecha del domingo; la semana empieza seis días antes.
export function weekLabel(sunday) {
  const end = new Date(`${sunday}T12:00:00Z`);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  const d = (x) => x.getUTCDate();
  const m = (x) => MONTHS[x.getUTCMonth()];
  const y = (x) => x.getUTCFullYear();
  if (m(start) === m(end)) return `del ${d(start)} al ${d(end)} de ${m(end)} de ${y(end)}`;
  const startYear = y(start) !== y(end) ? ` de ${y(start)}` : '';
  return `del ${d(start)} de ${m(start)}${startYear} al ${d(end)} de ${m(end)} de ${y(end)}`;
}

const loadImage = (src) =>
  new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

// Si el servidor de la carátula no permite dibujarla, se pide la misma ruta desde la propia web.
async function loadCover(src) {
  const direct = await loadImage(src);
  if (direct) return direct;
  const local = src.replace(/^https:\/\/base44\.app(?=\/api\/)/, '');
  return local !== src ? loadImage(local) : null;
}

function fitFont(ctx, text, maxWidth, startSize, weight = '800') {
  let size = startSize;
  while (size > 24) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
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

export async function buildDiploma({ title, artist, coverUrl, position, likes, tie, week }) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const accent = ACCENTS[position] || ACCENTS[3];

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0A0C1C');
  bg.addColorStop(0.6, '#1a1040');
  bg.addColorStop(1, '#3b1260');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Marco doble
  ctx.strokeStyle = accent;
  ctx.lineWidth = 8;
  roundRect(ctx, 30, 30, W - 60, H - 60, 36);
  ctx.stroke();
  ctx.lineWidth = 2;
  roundRect(ctx, 50, 50, W - 100, H - 100, 24);
  ctx.stroke();

  const text = (value, y, size, color, weight = '800') => {
    ctx.fillStyle = color;
    fitFont(ctx, value, W - 180, size, weight);
    ctx.fillText(value, W / 2, y);
  };
  ctx.textAlign = 'center';
  text('SONORIA FM', 130, 40, '#B9A4FF', '700');
  text('DIPLOMA', 232, 104, '#FFFFFF');
  text(`${positionLabel(position)}${tie ? ' (EMPATE)' : ''}`, 310, 58, accent);

  const size = 520;
  const x = (W - size) / 2;
  const y = 355;
  const cover = coverUrl ? await loadCover(coverUrl) : null;
  ctx.save();
  roundRect(ctx, x, y, size, size, 40);
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

  text(artist || '', 960, 68, '#FFFFFF');
  text(`«${title || ''}»`, 1030, 44, '#D8D8E8', '600');
  text(`${likes} votos de los oyentes`, 1125, 54, accent);
  text(`TOP semanal ${week}`, 1190, 34, '#D8D8E8', '600');
  text('¡Enhorabuena! · sonoriafm.com', 1260, 36, '#B9A4FF', '700');

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
