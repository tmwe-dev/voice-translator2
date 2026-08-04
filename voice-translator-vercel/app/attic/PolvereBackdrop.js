'use client';
import { useEffect, useRef } from 'react';
import { useApp } from '../contexts/AppContext.js';

// ═══════════════════════════════════════════════
// PolvereBackdrop — lo sciame in modalità quieta.
// 700 granelli in deriva sferica lentissima, tinti col tema.
// È un VELO: presenza, mai protagonismo (opacità 0.4).
// Si ferma da solo se l'app è in background o se l'utente
// preferisce ridurre il movimento.
// ═══════════════════════════════════════════════

// Tinte polvere per tema: [granello base], [seconda tinta], [accento], alfa
const POLVERI = {
  deep:      { base:[151,183,235], base2:[110,150,220], acc:[91,140,255],  alfa:0.28 },
  ember:     { base:[217,193,168], base2:[166,124,92],  acc:[255,138,61],  alfa:0.27 },
  avorio:    { base:[242,239,232], base2:[210,214,225], acc:[255,180,84],  alfa:0.26 },
  lilla:     { base:[201,184,245], base2:[165,150,220], acc:[167,139,250], alfa:0.27 },
  blubianco: { base:[244,247,252], base2:[52,92,170],   acc:[130,175,255], alfa:0.23, alfa2:0.48 },
  dawn:      { base:[60,80,140],   base2:[120,140,190], acc:[61,99,232],   alfa:0.10 }, // sul chiaro: appena visibile
};

export default function PolvereBackdrop() {
  const { theme } = useApp();
  const cvRef = useRef(null);
  const temaRef = useRef(theme);
  temaRef.current = theme;

  useEffect(() => {
    const riduci = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const cv = cvRef.current;
    if (!cv || riduci) return;
    const g = cv.getContext('2d');
    let W, H, t = 0, vivo = true, raf;

    const misura = () => {
      W = cv.width = window.innerWidth * devicePixelRatio;
      H = cv.height = window.innerHeight * devicePixelRatio;
    };
    misura();
    window.addEventListener('resize', misura);

    // Sfera di Fibonacci: 1400 granelli, distribuzione uniforme
    const NP = 1400, FOV = 380;
    const pts = Array.from({ length: NP }, (_, i) => {
      const k = 2 * (i / NP) - 1, r = Math.sqrt(1 - k * k), phi = i * 2.39996;
      return { x: Math.cos(phi) * r, y: k, z: Math.sin(phi) * r,
        fase: Math.random() * 6.28,
        tipo: Math.random() < 0.02 ? 2 : Math.random() < 0.47 ? 1 : 0 };
    });

    const vita = () => {
      if (!vivo) return;
      if (document.hidden) { raf = requestAnimationFrame(vita); return; } // pausa: zero CPU sprecata
      t++;
      const pol = POLVERI[temaRef.current] || POLVERI.deep;
      g.clearRect(0, 0, W, H);
      const R = Math.min(W, H) * 0.68, ry = t * 0.0004, rx = 0.4;
      for (const p of pts) {
        const resp = 0.92 + Math.sin(p.fase + t * 0.002) * 0.035;   // respiro impercettibile
        const x = p.x * resp, y = p.y * resp, z = p.z * resp;
        const X0 = x * Math.cos(ry) + z * Math.sin(ry);
        let Z = -x * Math.sin(ry) + z * Math.cos(ry);
        const Y0 = y * Math.cos(rx) - Z * Math.sin(rx);
        Z = y * Math.sin(rx) + Z * Math.cos(rx);
        const s = FOV / (FOV + Z * 260);
        const px = W / 2 + X0 * R * s, py = H / 2 + Y0 * R * s;
        if (p.tipo === 2) {
          g.beginPath(); g.arc(px, py, (0.4 + s * 0.55) * devicePixelRatio, 0, 7);
          g.fillStyle = `rgba(${pol.acc},${0.28 + s * 0.35})`; g.fill();
        } else {
          const dim = (0.35 + s * 0.55) * devicePixelRatio;
          const col = p.tipo === 1 ? pol.base2 : pol.base;
          const a = p.tipo === 1 ? (pol.alfa2 ?? pol.alfa) : pol.alfa;
          g.fillStyle = `rgba(${col},${0.05 + s * a})`;
          g.fillRect(px - dim / 2, py - dim / 2, dim, dim);
        }
      }
      raf = requestAnimationFrame(vita);
    };
    raf = requestAnimationFrame(vita);

    return () => { vivo = false; cancelAnimationFrame(raf); window.removeEventListener('resize', misura); };
  }, []);

  return (
    <canvas ref={cvRef} aria-hidden="true" style={{
      position: 'fixed', inset: 0, zIndex: 0, opacity: 0.75, pointerEvents: 'none',
    }} />
  );
}
