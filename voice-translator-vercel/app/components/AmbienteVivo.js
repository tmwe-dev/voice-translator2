'use client';
import { useEffect, useRef } from 'react';
import { useApp } from '../contexts/AppContext.js';

// ═══════════════════════════════════════════════
// AmbienteVivo — UN SOLO ambiente, per tutta l'app.
//
// Prima c'erano due canvas: lo sciame denso dell'onboarding e il
// velo di polvere delle pagine. Passando dall'uno all'altro il
// primo MORIVA e il secondo NASCEVA: taglio netto, animazione
// azzerata. Ora è un unico organismo che non si spegne mai e
// cambia carattere in modo continuo:
//
//   intensità 1 → sciame vivo (benvenuto, tutorial)
//   intensità 0 → velo quieto (tutte le altre pagine)
//
// Anche i COLORI del tema si sciolgono l'uno nell'altro (lerp),
// invece di saltare. Nessun rimontaggio: il tempo non riparte mai.
// ═══════════════════════════════════════════════

const TINTE = {
  deep:      { base:[151,183,235], base2:[110,150,220], acc:[91,140,255],  bg:[5,7,15],    alfa:0.30 },
  ember:     { base:[217,193,168], base2:[166,124,92],  acc:[255,138,61],  bg:[13,8,5],    alfa:0.29 },
  avorio:    { base:[242,239,232], base2:[210,214,225], acc:[255,180,84],  bg:[7,7,6],     alfa:0.28 },
  lilla:     { base:[201,184,245], base2:[165,150,220], acc:[167,139,250], bg:[7,5,16],    alfa:0.29 },
  blubianco: { base:[244,247,252], base2:[52,92,170],   acc:[130,175,255], bg:[5,7,13],    alfa:0.26 },
  dawn:      { base:[70,95,160],   base2:[120,140,190], acc:[61,99,232],   bg:[247,248,252], alfa:0.13 },
};

// Le pagine in cui l'ambiente è VIVO (sciame pieno)
const PAGINE_VIVE = new Set(['welcome', 'loading']);

export default function AmbienteVivo() {
  const { theme, view } = useApp();
  const rif = useRef({ theme, view, tutorial: false });
  rif.current.theme = theme;
  rif.current.view = view;

  // Il tutorial alza l'intensità anche se sta sopra la Home
  useEffect(() => {
    const su = (e) => { rif.current.tutorial = !!e.detail?.vivo; };
    window.addEventListener('bartalk:ambiente', su);
    return () => window.removeEventListener('bartalk:ambiente', su);
  }, []);

  const cvRef = useRef(null);

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

    const NP = riduci ? 700 : 2600, FOV = 380;
    const punti = Array.from({ length: NP }, (_, i) => ({
      i, x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2, z: (Math.random() - 0.5) * 2,
      fase: Math.random() * 6.28,
      largo: { x: (Math.random() - 0.5) * 2.6, y: (Math.random() - 0.5) * 2.6, z: (Math.random() - 0.5) * 2.6 },
      tipo: Math.random() < 0.035 ? 2 : Math.random() < 0.47 ? 1 : 0,
    }));

    // ── Stato continuo: si muove sempre verso il bersaglio, mai a scatti ──
    let intensita = PAGINE_VIVE.has(rif.current.view) ? 1 : 0;
    const col = {
      base: [...TINTE.deep.base], base2: [...TINTE.deep.base2],
      acc: [...TINTE.deep.acc], bg: [...TINTE.deep.bg], alfa: TINTE.deep.alfa,
    };
    const versoColore = (attuale, bersaglio, k) => {
      for (let i = 0; i < 3; i++) attuale[i] += (bersaglio[i] - attuale[i]) * k;
    };

    const sbuffi = new Map();
    const vita = () => {
      if (!vivo) return;
      if (document.hidden) { raf = requestAnimationFrame(vita); return; }
      t++;

      // 1) Il tema si scioglie nell'altro (nessun salto di colore)
      const T = TINTE[rif.current.theme] || TINTE.deep;
      versoColore(col.base, T.base, 0.04);
      versoColore(col.base2, T.base2, 0.04);
      versoColore(col.acc, T.acc, 0.04);
      versoColore(col.bg, T.bg, 0.04);
      col.alfa += (T.alfa - col.alfa) * 0.04;

      // 2) L'intensità scivola tra sciame e velo (≈1,2s, mai un taglio)
      const bersaglio = (PAGINE_VIVE.has(rif.current.view) || rif.current.tutorial) ? 1 : 0;
      intensita += (bersaglio - intensita) * 0.018;

      // 3) Scia: più lunga quando l'ambiente è vivo
      const scia = 0.5 - intensita * 0.18;
      g.fillStyle = `rgba(${col.bg.map(Math.round)},${scia})`;
      g.fillRect(0, 0, W, H);

      const R = Math.min(W, H) * (0.62 - intensita * 0.12);
      const RAG = 78 * devicePixelRatio;
      const ry = t * (0.0004 + intensita * 0.0007);
      const rx = 0.4 - intensita * 0.05 + Math.sin(t * 0.0005) * 0.08 * intensita;

      for (const p of punti) {
        // Casa: sfera compatta (vivo) ⇄ nube larga e sparsa (velo)
        const k = 2 * (p.i / NP) - 1, r = Math.sqrt(Math.max(0, 1 - k * k)), phi = p.i * 2.39996;
        const resp = 0.92 + Math.sin(p.fase + t * (0.002 + intensita * 0.003)) * (0.035 + intensita * 0.02);
        const sfx = Math.cos(phi) * r * resp, sfy = k * resp, sfz = Math.sin(phi) * r * resp;
        const cx = sfx + (p.largo.x - sfx) * (1 - intensita) * 0.55;
        const cy = sfy + (p.largo.y - sfy) * (1 - intensita) * 0.55;
        const cz = sfz + (p.largo.z - sfz) * (1 - intensita) * 0.55;
        p.x += (cx - p.x) * 0.05; p.y += (cy - p.y) * 0.05; p.z += (cz - p.z) * 0.05;

        let x = p.x * Math.cos(ry) + p.z * Math.sin(ry);
        let z = -p.x * Math.sin(ry) + p.z * Math.cos(ry);
        const Y0 = p.y * Math.cos(rx) - z * Math.sin(rx);
        z = p.y * Math.sin(rx) + z * Math.cos(rx);
        const s = FOV / (FOV + z * 260);
        let X = W / 2 + x * R * s, Y = H / 2 + Y0 * R * s;

        // La bolla sotto al dito: viva solo quando l'ambiente lo è
        if (intensita > 0.05) {
          const dx = X - mx, dy = Y - my, d2 = dx * dx + dy * dy;
          let sb = sbuffi.get(p.i) || 0;
          if (d2 < RAG * RAG) {
            const d = Math.sqrt(d2) || 1;
            sb += (Math.pow(1 - d / RAG, 2) * 22 * devicePixelRatio * intensita - sb) * 0.16;
          } else sb *= 0.93;
          if (sb > 0.05) { const d = Math.sqrt(d2) || 1; X += dx / d * sb; Y += dy / d * sb; sbuffi.set(p.i, sb); }
          else sbuffi.delete(p.i);
        }

        const forza = 0.55 + intensita * 0.45;   // il velo è più tenue
        if (p.tipo === 2) {
          g.beginPath(); g.arc(X, Y, (0.35 + s * 0.5) * devicePixelRatio, 0, 7);
          g.fillStyle = `rgba(${col.acc.map(Math.round)},${(0.25 + s * 0.35) * forza})`; g.fill();
        } else {
          const dim = (0.3 + s * 0.5) * devicePixelRatio;
          const c = p.tipo === 1 ? col.base2 : col.base;
          g.fillStyle = `rgba(${c.map(Math.round)},${(0.05 + s * col.alfa) * forza})`;
          g.fillRect(X - dim / 2, Y - dim / 2, dim, dim);
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
  }, []);   // ← mai rimontato: il tempo dell'ambiente non riparte mai

  return (
    <canvas ref={cvRef} aria-hidden="true" style={{
      position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.85,
    }} />
  );
}
