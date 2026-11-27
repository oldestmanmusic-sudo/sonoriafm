// Franja superior en todas las páginas anunciando LoveType, el test de SONORIA FM.
export default function LoveTypeTopBar() {
  return (
    <a
      href="https://love-type.base44.app/?utm_source=sonoriafm&utm_medium=topbar"
      target="_blank"
      rel="noopener"
      className="lt-topbar group relative block overflow-hidden text-white"
      aria-label="Nuevo: haz gratis el test LoveType"
    >
      <style>{`
        .lt-topbar{background:linear-gradient(90deg,#4c1d95,#be185d,#7c3aed,#4c1d95);background-size:300% 100%;animation:ltMove 8s linear infinite}
        @keyframes ltMove{from{background-position:0% 0}to{background-position:300% 0}}
        @keyframes ltBeat{0%,100%{transform:scale(1)}50%{transform:scale(1.25)}}
        .lt-beat{display:inline-block;animation:ltBeat 1.2s ease-in-out infinite}
      `}</style>
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-3 py-2.5 text-center text-sm font-semibold sm:gap-3 sm:text-base">
        <span className="lt-beat" aria-hidden="true">💘</span>
        <span className="hidden rounded-full bg-amber-300 px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-[#1a1033] sm:inline">Nuevo</span>
        <span className="truncate">
          ¿Cuánto de tu forma de amar es <span className="text-amber-200">miedo</span>? Haz el test LoveType gratis
        </span>
        <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-black text-[#4c1d95] transition group-hover:scale-105 sm:text-sm">
          Hacer test →
        </span>
      </div>
    </a>
  );
}
