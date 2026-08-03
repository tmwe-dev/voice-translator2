'use client';
import { useEffect, useRef } from 'react';

// ═══════════════════════════════════════════════
// SciameOnboarding — lo sciame PIENO, solo per il benvenuto.
// 4.500 granelli finissimi in 3D con morfosi tra le forme:
//   fase 0 → sfera (il mondo) · fase 1 → doppia elica (il nome)
//   fase 2 → anello (la scelta) — parametri approvati:
//   morfosi ~1,5s easeInOutCubic, onda di ritardo breve,
//   repulsione del dito con memoria, scia vellutata.
// Il dettaglio costoso vive SOLO qui: dentro l'app c'è il velo.
// ═══════════════════════════════════════════════

const TINTE = {
  base: [151, 183, 235], base2: [110, 150, 220], acc: [91, 140, 255],
  accCss: '#5b8cff', bg: [5, 7, 15], alfa: 0.33,
};

export default function SciameOnboarding({ fase = 0 }) {
  const cvRef = useRef(null);
  const faseRef = useRef(fase);

  // Cambio fase → parte la morfosi
  const morfRef = useRef({ da: 0, a: 0, m: 1 });
  useEffect(() => {
    if (fase !== faseRef.current) {
      morfRef.current = { da: faseRef.current, a: fase, m: 0 };
      faseRef.current = fase;
    }
  }, [fase]);

  useEffect(() => {
    const riduci = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const cv = cvRef.current; if (!cv) return;
    const g = cv.getContext('2d');
    let W, H, t = 0, vivo = true, raf, mx = -1e4, my = -1e4;

    const misura = () => {
      W = cv.width = window.innerWidth * devicePixelRatio;
      H = cv.height = window.innerHeight * devicePixelRatio;
    };
    misura();
    window.addEventListener('resize', misura);
    const suMossa = (e) => { mx = e.clientX * devicePixelRatio; my = e.clientY * devicePixelRatio; };
    const suVia = () => { mx = my = -1e4; };
    window.addEventListener('pointermove', suMossa);
    window.addEventListener('pointerleave', suVia);

    const NP = riduci ? 900 : 4500, FOV = 380, DURATA = 88;
    const punti = Array.from({ length: NP }, (_, i) => ({
      i, x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2, z: (Math.random() - 0.5) * 2,
      fase: Math.random() * 6.28, ritardo: Math.random() * 0.12,
      tipo: Math.random() < 0.04 ? 2 : Math.random() < 0.47 ? 1 : 0,
    }));
    const ease = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

    const forma = (p, quale) => {
      const u = p.i / NP, a = u * 6.28 * 8;
      if (quale === 0) {
        const k = 2 * u - 1, r = Math.sqrt(1 - k * k), phi = p.i * 2.39996;
        return { x: Math.cos(phi) * r * 0.74, y: k * 0.74, z: Math.sin(phi) * r * 0.74 };
      }
      if (quale === 1) {
        const s = p.i % 2 ? 1 : -1, y = (u - 0.5) * 1.5;
        return { x: Math.cos(a + (s > 0 ? 0 : 3.14)) * 0.34, y, z: Math.sin(a + (s > 0 ? 0 : 3.14)) * 0.34 };
      }
      const r = 0.76 + Math.sin(p.fase + t * 0.005) * 0.04;
      return { x: Math.cos(u * 6.28) * r, y: Math.sin(p.fase * 3 + t * 0.004) * 0.07, z: Math.sin(u * 6.28) * r };
    };

    const sbuffi = new Map();
    const vita = () => {
      if (!vivo) return;
      if (document.hidden) { raf = requestAnimationFrame(vita); return; }
      t++;
      const M = morfRef.current; if (M.m < DURATA) M.m++;
      g.fillStyle = `rgba(${TINTE.bg},0.32)`; g.fillRect(0, 0, W, H);
      const R = Math.min(W, H) * 0.5, RAG = 150 * devicePixelRatio;
      const ry = t * 0.0011, rx = 0.35 + Math.sin(t * 0.0005) * 0.10;

      for (const p of punti) {
        const mLoc = Math.min(1, Math.max(0, (M.m / DURATA - p.ritardo) / (1 - p.ritardo)));
        const e = ease(mLoc);
        const A = forma(p, M.da), B = forma(p, M.a);
        const cx = A.x + (B.x - A.x) * e, cy = A.y + (B.y - A.y) * e, cz = A.z + (B.z - A.z) * e;
        p.x += (cx - p.x) * 0.11; p.y += (cy - p.y) * 0.11; p.z += (cz - p.z) * 0.11;

        let x = p.x * Math.cos(ry) + p.z * Math.sin(ry), z = -p.x * Math.sin(ry) + p.z * Math.cos(ry);
        let Y = p.y * Math.cos(rx) - z * Math.sin(rx); z = p.y * Math.sin(rx) + z * Math.cos(rx);
        const s = FOV / (FOV + z * 260);
        let X = W / 2 + x * R * s, Y2 = H / 2 + Y * R * s;

        const dx = X - mx, dy = Y2 - my, d2 = dx * dx + dy * dy;
        let sb = sbuffi.get(p.i) || 0;
        if (d2 < RAG * RAG) {
          const d = Math.sqrt(d2) || 1, spinta = Math.pow(1 - d / RAG, 2) * 20 * devicePixelRatio;
          sb += (spinta - sb) * 0.10;
        } else sb *= 0.93;
        if (sb > 0.05) { const d = Math.sqrt(d2) || 1; X += dx / d * sb; Y2 += dy / d * sb; sbuffi.set(p.i, sb); }
        else sbuffi.delete(p.i);

        if (p.tipo === 2) {
          g.shadowColor = TINTE.accCss; g.shadowBlur = 6 * devicePixelRatio;
          g.beginPath(); g.arc(X, Y2, (0.35 + s * 0.55) * devicePixelRatio, 0, 7);
          g.fillStyle = `rgba(${TINTE.acc},${0.35 + s * 0.5})`; g.fill(); g.shadowBlur = 0;
        } else {
          const dim = (0.25 + s * 0.42) * devicePixelRatio;
          const col = p.tipo === 1 ? TINTE.base2 : TINTE.base;
          g.fillStyle = `rgba(${col},${0.06 + s * TINTE.alfa})`;
          g.fillRect(X - dim / 2, Y2 - dim / 2, dim, dim);
        }
      }
      raf = requestAnimationFrame(vita);
    };
    raf = requestAnimationFrame(vita);

    return () => {
      vivo = false; cancelAnimationFrame(raf);
      window.removeEventListener('resize', misura);
      window.removeEventListener('pointermove', suMossa);
      window.removeEventListener('pointerleave', suVia);
    };
  }, []);

  return (
    <canvas ref={cvRef} aria-hidden="true" style={{
      position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
    }} />
  );
}
