import { useEffect, useRef, useState } from 'react';
import { Loader2, ArrowDown } from 'lucide-react';

const THRESHOLD = 55;

// Tira hacia abajo para recargar (móvil). Requiere overscroll-behavior: none
// en el documento para no competir con el refresco nativo del navegador.
export default function PullToRefresh({ onRefresh, children }) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const dist = useRef(0);

  useEffect(() => {
    const atTop = () => (window.scrollY || document.documentElement.scrollTop || 0) <= 0;

    const onTouchStart = (e) => {
      if (atTop()) startY.current = e.touches[0].clientY;
    };
    const onTouchMove = (e) => {
      if (startY.current === null || refreshing) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0 && atTop()) {
        dist.current = Math.min(dy * 0.45, 90);
        setPull(dist.current);
      } else {
        dist.current = 0;
        setPull(0);
      }
    };
    const onTouchEnd = async () => {
      startY.current = null;
      const shouldRefresh = dist.current >= THRESHOLD && !refreshing;
      dist.current = 0;
      setPull(0);
      if (shouldRefresh) {
        setRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
        }
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [onRefresh, refreshing]);

  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute inset-x-0 -top-12 z-20 flex justify-center"
        style={{
          transform: `translateY(${refreshing ? 48 : pull}px)`,
          opacity: refreshing ? 1 : pull / THRESHOLD,
          transition: refreshing || pull === 0 ? 'transform 0.2s ease' : 'none',
        }}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card shadow-md">
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <ArrowDown className="h-4 w-4 text-muted-foreground" />}
        </span>
      </div>
      {children}
    </div>
  );
}