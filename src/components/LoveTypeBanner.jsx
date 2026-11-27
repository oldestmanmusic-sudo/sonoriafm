// Banner de LoveType, el test viral de SONORIA FM. Enlaza a love-type.base44.app.
export default function LoveTypeBanner() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-8 pt-2">
      <style>{`@keyframes ltGlow{0%,100%{box-shadow:0 0 0 0 rgba(236,72,153,.55),0 10px 40px rgba(124,58,237,.35)}50%{box-shadow:0 0 0 8px rgba(236,72,153,0),0 10px 60px rgba(236,72,153,.5)}}.lt-glow{animation:ltGlow 2.4s ease-in-out infinite}`}</style>
      <a
        href="https://love-type.base44.app/?utm_source=sonoriafm&utm_medium=banner"
        target="_blank"
        rel="noopener"
        className="lt-glow group relative block overflow-hidden rounded-3xl border-2 border-pink-400/60 p-6 text-white transition hover:scale-[1.01] sm:p-10"
        style={{ background: 'radial-gradient(circle at 15% 20%, rgba(124,58,237,0.55), transparent 55%), radial-gradient(circle at 90% 90%, rgba(219,39,119,0.35), transparent 50%), #0b0820' }}
      >
        <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
          <svg viewBox="0 0 100 100" className="h-24 w-24 shrink-0 sm:h-28 sm:w-28 drop-shadow-[0_0_20px_rgba(251,191,36,0.7)] transition group-hover:-translate-y-1" aria-hidden="true">
            <defs>
              <radialGradient id="ltLumi" cx="45%" cy="38%" r="65%">
                <stop offset="0%" stopColor="#fff7d6" />
                <stop offset="55%" stopColor="#fcd34d" />
                <stop offset="100%" stopColor="#f59e0b" />
              </radialGradient>
            </defs>
            <path d="M50 88 C20 66 8 50 8 33 C8 19 19 9 32 9 C40 9 46 13 50 20 C54 13 60 9 68 9 C81 9 92 19 92 33 C92 50 80 66 50 88 Z" fill="url(#ltLumi)" />
            <ellipse cx="38" cy="40" rx="5" ry="7" fill="#2a1a4a" />
            <ellipse cx="62" cy="40" rx="5" ry="7" fill="#2a1a4a" />
            <path d="M42 54 Q50 60 58 54" stroke="#2a1a4a" strokeWidth="3" fill="none" strokeLinecap="round" />
          </svg>
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">Nuevo · Una empresa de SONORIA FM</p>
            <p className="mt-1 font-serif text-3xl leading-tight sm:text-4xl">
              ¿Cuánto de tu forma de amar es <span className="text-rose-400">miedo</span>?
            </p>
            <p className="mt-1 text-sm text-white/70">El test viral LoveType: 20 preguntas, 3 minutos. Descubre tu tipo gratis.</p>
          </div>
          <span className="inline-block shrink-0 rounded-full bg-gradient-to-b from-amber-200 to-amber-400 px-6 py-3 font-semibold text-[#1a1033] shadow-[0_0_30px_rgba(251,191,36,0.35)]">
            Hacer el test →
          </span>
        </div>
      </a>
    </section>
  );
}
