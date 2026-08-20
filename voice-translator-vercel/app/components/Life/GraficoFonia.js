'use client';
import { useEffect, useRef } from 'react';
import { FONT } from '../../lib/constants.js';

// ═══════════════════════════════════════════════════════════════
// GRAFICO FONIA (b.322) — l'analisi grafica della registrazione.
//
// Sopra: la MELODIA — la fascia grigio-verde è la pronuncia ATTESA
// (riferimento ± tolleranza); la linea sopra è la TUA voce, colorata a
// tratti: verde dentro la fascia, arancione vicino, rosso fuori.
// Sotto: l'ENERGIA/RITMO — la sagoma chiara è l'attesa, le barre sono
// le tue, con gli stessi colori. Il tentativo precedente resta come
// linea tratteggiata: dalla seconda registrazione vedi dove correggi.
// ═══════════════════════════════════════════════════════════════

const COLORI = { verde: '#34d399', arancio: '#f59e0b', rosso: '#f87171' };

export default function GraficoFonia({ confronto, precedente, muto, card }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !confronto?.punti?.length) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const punti = confronto.punti;
    const n = punti.length;
    const x = (i) => (i / (n - 1)) * (W - 8) + 4;

    // ── pannello MELODIA (meta alta) ──
    const hTono = H * 0.58;
    const TONO_SCALA = 8; // semitoni visibili sopra/sotto lo zero
    const yTono = (st) => hTono / 2 - (Math.max(-TONO_SCALA, Math.min(TONO_SCALA, st)) / TONO_SCALA) * (hTono / 2 - 8);

    // fascia attesa (riferimento ± 2 semitoni), solo dove il riferimento ha voce
    ctx.beginPath();
    let dentro = false;
    for (let i = 0; i < n; i++) {
      const t = punti[i].tonoRif;
      if (t === null) { dentro = false; continue; }
      const yA = yTono(t + 2), yB = yTono(t - 2);
      if (!dentro) { ctx.moveTo(x(i), yA); dentro = true; } else ctx.lineTo(x(i), yA);
      // il ritorno (bordo basso) lo disegniamo dopo, per semplicita: fascia a colonne
      ctx.rect(x(i) - (W - 8) / n / 2, yA, (W - 8) / n + 1, Math.max(2, yB - yA));
    }
    ctx.fillStyle = 'rgba(52,211,153,0.14)';
    ctx.fill();

    // linea del riferimento (attesa)
    ctx.beginPath(); dentro = false;
    for (let i = 0; i < n; i++) {
      const t = punti[i].tonoRif;
      if (t === null) { dentro = false; continue; }
      if (!dentro) { ctx.moveTo(x(i), yTono(t)); dentro = true; } else ctx.lineTo(x(i), yTono(t));
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();

    // tentativo PRECEDENTE (tratteggiato, per vedere il progresso)
    if (precedente?.punti?.length === n) {
      ctx.beginPath(); ctx.setLineDash([4, 4]); dentro = false;
      for (let i = 0; i < n; i++) {
        const t = precedente.punti[i].tonoUte;
        if (t === null) { dentro = false; continue; }
        if (!dentro) { ctx.moveTo(x(i), yTono(t)); dentro = true; } else ctx.lineTo(x(i), yTono(t));
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.setLineDash([]);
    }

    // la TUA onda, colorata a tratti secondo la fascia
    for (let i = 1; i < n; i++) {
      const a = punti[i - 1].tonoUte, b = punti[i].tonoUte;
      if (a === null || b === null) continue;
      ctx.beginPath();
      ctx.moveTo(x(i - 1), yTono(a)); ctx.lineTo(x(i), yTono(b));
      ctx.strokeStyle = COLORI[punti[i].colore] || COLORI.verde;
      ctx.lineWidth = 2.5; ctx.stroke();
    }

    // ── pannello ENERGIA/RITMO (meta bassa) ──
    const y0 = hTono + 6, hEn = H - y0 - 4;
    for (let i = 0; i < n; i++) {
      const w = (W - 8) / n;
      // attesa: sagoma chiara
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x(i) - w / 2, y0 + hEn * (1 - punti[i].energiaRif), w * 0.9, hEn * punti[i].energiaRif);
      // tua: barra colorata
      ctx.fillStyle = COLORI[punti[i].colore] || COLORI.verde;
      ctx.globalAlpha = 0.8;
      ctx.fillRect(x(i) - w / 2, y0 + hEn * (1 - punti[i].energiaUte), w * 0.55, hEn * punti[i].energiaUte);
      ctx.globalAlpha = 1;
    }
  }, [confronto, precedente]);

  if (!confronto?.punti?.length) return null;
  return (
    <div style={{ marginTop: 10 }}>
      <canvas ref={ref} style={{ width: '100%', height: 150, display: 'block', borderRadius: 12, background: card || 'rgba(255,255,255,0.03)' }} />
      <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 10, color: muto, fontFamily: FONT, flexWrap: 'wrap' }}>
        <span><span style={{ color: COLORI.verde }}>▬</span> nella fascia attesa</span>
        <span><span style={{ color: COLORI.arancio }}>▬</span> vicino</span>
        <span><span style={{ color: COLORI.rosso }}>▬</span> fuori</span>
        <span style={{ opacity: 0.7 }}>▬ attesa · ┄ tentativo precedente</span>
      </div>
    </div>
  );
}
