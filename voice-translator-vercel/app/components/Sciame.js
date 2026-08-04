'use client';
import { useEffect, useRef } from 'react';
import { useApp } from '../contexts/AppContext.js';

// ═══════════════════════════════════════════════════════════════
// SCIAME — l'UNICO sistema di particelle dell'app.
//
// Sostituisce SciameOnboarding e PolvereBackdrop, che facevano la
// stessa cosa con parametri leggermente diversi e tinte scritte due
// volte. Un file solo, due modi:
//
//   modo="vivo"  → il benvenuto: 4.500 granelli, morfosi tra le forme
//                  (sfera → elica → anello), bolla sotto il dito, scia
//   modo="velo"  → dentro l'app: 1.400 granelli, deriva lentissima,
//                  presenza e mai protagonismo
//
// I parametri del modo "vivo" sono quelli approvati e NON vanno
// cambiati: morfosi ~1,5s easeInOutCubic, bolla di 78px, 4% di accento,
// 47% di seconda tinta. Le tinte arrivano dal TEMA, mai dal caso.
// ═══════════════════════════════════════════════════════════════

// Tinte per tema: [granello base], [seconda tinta], [accento], alfa.
// Una sola tabella: prima ne esistevano due, e quella dello sciame
// pieno era fissa sul blu, quindi ignorava il tema scelto.
const TINTE = {
  deep:      { base: [151,183,235], base2: [110,150,220], acc: [91,140,255],  accCss: '#5b8cff', alfa: 0.28, fondo: [5,7,15] },
  ember:     { base: [217,193,168], base2: [166,124,92],  acc: [255,138,61],  accCss: '#ff8a3d', alfa: 0.27, fondo: [13,8,5] },
  avorio:    { base: [242,239,232], base2: [210,214,225], acc: [255,180,84],  accCss: '#ffb454', alfa: 0.26, fondo: [7,7,6] },
  lilla:     { base: [201,184,245], base2: [165,150,220], acc: [167,139,250], accCss: '#a78bfa', alfa: 0.27, fondo: [7,5,16] },
  blubianco: { base: [244,247,252], base2: [52,92,170],   acc: [130,175,255], accCss: '#82afff', alfa: 0.23, alfa2: 0.48, fondo: [5,7,13] },
  // Sul chiaro i granelli sono scuri e appena accennati, e la scia è bianca.
  dawn:      { base: [60,80,140],   base2: [120,140,190], acc: [61,99,232],   accCss: '#3d63e8', alfa: 0.10, fondo: [247,248,252] },
};

// Le due personalità, una accanto all'altra: si leggono in un colpo d'occhio.
const MODI = {
  vivo: {
    granelli: 4500, granelliRidotti: 900,
    raggio: 0.5, rotazione: 0.0011, opacita: 1,
    alfaExtra: 0.05,        // lo sciame pieno è un filo più presente del velo
    scia: 0.32,             // velo di fondo per lasciare la scia vellutata
    bolla: 78,              // raggio in px della repulsione sotto il dito
    quotaAccento: 0.04,
  },
  velo: {
    granelli: 1400, granelliRidotti: 0,   // con "riduci movimento" il velo sparisce
    raggio: 0.68, rotazione: 0.0004, opacita: 0.75,
    alfaExtra: 0,
    scia: 0,                // nessuna scia: pulisce e ridisegna
    bolla: 0,               // nessuna reazione al dito: è uno sfondo
    quotaAccento: 0.02,
  },
};

const FOV = 380;
const DURATA_MORFOSI = 88;               // ~1,5s a 60fps
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export default function Sciame({ modo = 'velo', fase = 0 }) {
  const { theme } = useApp();
  const cvRef = useRef(null);
  const temaRef = useRef(theme);
  temaRef.current = theme;

  const faseRef = useRef(fase);
  const morfRef = useRef({ da: 0, a: 0, m: DURATA_MORFOSI });

  useEffect(() => {
    if (fase !== faseRef.current) {
      morfRef.current = { da: faseRef.current, a: fase, m: 0 };
      faseRef.current = fase;
    }
  }, [fase]);

  useEffect(() => {
    const M = MODI[modo] || MODI.velo;
    const riduci = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const quanti = riduci ? M.granelliRidotti : M.granelli;
    const cv = cvRef.current;
    if (!cv || quanti === 0) return;

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
    if (M.bolla > 0) {
      window.addEventListener('pointermove', suMossa);
      window.addEventListener('pointerleave', suVia);
    }

    // Sfera di Fibonacci: distribuzione uniforme, nessun grumo.
    const punti = Array.from({ length: quanti }, (_, i) => {
      const k = 2 * (i / quanti) - 1, r = Math.sqrt(1 - k * k), phi = i * 2.39996;
      return {
        i, x: Math.cos(phi) * r, y: k, z: Math.sin(phi) * r,
        fase: Math.random() * 6.28, ritardo: Math.random() * 0.12,
        tipo: Math.random() < M.quotaAccento ? 2 : Math.random() < 0.47 ? 1 : 0,
      };
    });

    // Le tre forme del benvenuto. Nel velo si usa sempre la prima.
    const forma = (p, quale) => {
      const u = p.i / quanti, a = u * 6.28 * 8;
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
      if (document.hidden) { raf = requestAnimationFrame(vita); return; } // in background: zero CPU
      t++;
      const T = TINTE[temaRef.current] || TINTE.deep;

      if (M.scia > 0) { g.fillStyle = `rgba(${T.fondo},${M.scia})`; g.fillRect(0, 0, W, H); }
      else g.clearRect(0, 0, W, H);

      const mor = morfRef.current;
      if (mor.m < DURATA_MORFOSI) mor.m++;

      const R = Math.min(W, H) * M.raggio;
      const RAG = M.bolla * devicePixelRatio;
      const ry = t * M.rotazione;
      const rx = M.bolla > 0 ? 0.35 + Math.sin(t * 0.0005) * 0.10 : 0.4;

      for (const p of punti) {
        let cx, cy, cz;
        if (M.bolla > 0) {
          // Modo vivo: morfosi con onda di ritardo, ogni granello parte
          // un attimo dopo il precedente.
          const mLoc = Math.min(1, Math.max(0, (mor.m / DURATA_MORFOSI - p.ritardo) / (1 - p.ritardo)));
          const e = ease(mLoc);
          const A = forma(p, mor.da), B = forma(p, mor.a);
          cx = A.x + (B.x - A.x) * e; cy = A.y + (B.y - A.y) * e; cz = A.z + (B.z - A.z) * e;
          p.x += (cx - p.x) * 0.11; p.y += (cy - p.y) * 0.11; p.z += (cz - p.z) * 0.11;
        } else {
          // Modo velo: nessuna morfosi, solo un respiro impercettibile.
          const resp = 0.92 + Math.sin(p.fase + t * 0.002) * 0.035;
          p.x = Math.cos(p.i * 2.39996) * Math.sqrt(1 - Math.pow(2 * (p.i / quanti) - 1, 2)) * resp;
          p.y = (2 * (p.i / quanti) - 1) * resp;
          p.z = Math.sin(p.i * 2.39996) * Math.sqrt(1 - Math.pow(2 * (p.i / quanti) - 1, 2)) * resp;
        }

        let x = p.x * Math.cos(ry) + p.z * Math.sin(ry);
        let z = -p.x * Math.sin(ry) + p.z * Math.cos(ry);
        const Y = p.y * Math.cos(rx) - z * Math.sin(rx);
        z = p.y * Math.sin(rx) + z * Math.cos(rx);
        const s = FOV / (FOV + z * 260);
        let X = W / 2 + x * R * s, Y2 = H / 2 + Y * R * s;

        // La bolla sotto il dito: solo nel modo vivo.
        if (RAG > 0) {
          const dx = X - mx, dy = Y2 - my, d2 = dx * dx + dy * dy;
          let sb = sbuffi.get(p.i) || 0;
          if (d2 < RAG * RAG) {
            const d = Math.sqrt(d2) || 1;
            const spinta = Math.pow(1 - d / RAG, 2) * 22 * devicePixelRatio;
            sb += (spinta - sb) * 0.16;
          } else sb *= 0.93;
          if (sb > 0.05) { const d = Math.sqrt(d2) || 1; X += dx / d * sb; Y2 += dy / d * sb; sbuffi.set(p.i, sb); }
          else sbuffi.delete(p.i);
        }

        if (p.tipo === 2) {
          if (M.scia > 0) { g.shadowColor = T.accCss; g.shadowBlur = 6 * devicePixelRatio; }
          g.beginPath(); g.arc(X, Y2, (0.35 + s * 0.55) * devicePixelRatio, 0, 7);
          g.fillStyle = `rgba(${T.acc},${0.28 + s * 0.42})`; g.fill();
          if (M.scia > 0) g.shadowBlur = 0;
        } else {
          const dim = (0.3 + s * 0.48) * devicePixelRatio;
          const col = p.tipo === 1 ? T.base2 : T.base;
          const a = (p.tipo === 1 ? (T.alfa2 ?? T.alfa) : T.alfa) + M.alfaExtra;
          g.fillStyle = `rgba(${col},${0.055 + s * a})`;
          g.fillRect(X - dim / 2, Y2 - dim / 2, dim, dim);
        }
      }
      raf = requestAnimationFrame(vita);
    };
    raf = requestAnimationFrame(vita);

    return () => {
      vivo = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', misura);
      window.removeEventListener('pointermove', suMossa);
      window.removeEventListener('pointerleave', suVia);
    };
  }, [modo]);

  return (
    <canvas ref={cvRef} aria-hidden="true" style={{
      position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
      opacity: (MODI[modo] || MODI.velo).opacita,
    }} />
  );
}
