'use client';
import { useState } from 'react';
import { FONT, vibrate } from '../lib/constants.js';

// ═══════════════════════════════════════════════════════════════
// VELO — la tendina grigia.
//
// Copre il testo, non lo toglie. Un tocco e si apre; un tocco e si
// richiude, perche chi si pente deve poter tornare indietro.
//
// La tendina dice PERCHE e li ("linguaggio pesante", "sta urlando"):
// una macchia grigia muta sembra un guasto dell'applicazione.
//
// Il testo sotto resta nel documento, solo sfocato e non selezionabile,
// cosi chi legge con la sintesi vocale non se lo trova letto per sbaglio
// (aria-hidden) ma trova il pulsante per scoprirlo.
// ═══════════════════════════════════════════════════════════════

export default function Velo({ motivo, C, children }) {
  const [scoperto, setScoperto] = useState(false);

  if (scoperto) {
    return (
      <div style={{ position: 'relative' }}>
        {children}
        <button
          onClick={() => { vibrate(10); setScoperto(false); }}
          style={{
            marginTop: 4, padding: '2px 8px', borderRadius: 8, cursor: 'pointer',
            background: 'transparent', border: `1px solid ${C.dividerColor || 'rgba(255,255,255,0.1)'}`,
            color: C.textMuted, fontSize: 10.5, fontFamily: FONT, fontWeight: 600,
          }}>
          Copri di nuovo
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <div aria-hidden="true" style={{
        filter: 'blur(7px)', opacity: 0.5, userSelect: 'none', pointerEvents: 'none',
      }}>
        {children}
      </div>

      <button
        onClick={() => { vibrate(10); setScoperto(true); }}
        aria-label={`Contenuto coperto: ${motivo}. Tocca per vedere.`}
        style={{
          position: 'absolute', inset: 0, width: '100%',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 2, cursor: 'pointer', fontFamily: FONT,
          background: C.veloBg || 'rgba(120,120,128,0.30)',
          border: `1px solid ${C.dividerColor || 'rgba(255,255,255,0.12)'}`,
          borderRadius: 12,
          backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
        }}>
        <span style={{ fontSize: 11.5, fontWeight: 800, color: C.textSecondary }}>
          {motivo === 'sta urlando' ? 'Sta urlando' : 'Linguaggio pesante'}
        </span>
        <span style={{ fontSize: 10.5, color: C.textMuted }}>Tocca per leggere</span>
      </button>
    </div>
  );
}
