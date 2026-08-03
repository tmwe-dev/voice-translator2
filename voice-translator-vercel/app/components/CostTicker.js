'use client';
import { useState, useEffect, useRef } from 'react';
import { euroDaSecondi } from '../wallet/tariffe.js';

// ═══════════════════════════════════════════════
// CostTicker — il costo della call in EURO, in tempo reale.
// Conta i secondi da quando è montato (= inizio call) e mostra
// il totale in valuta, mai in token o minuti tecnici.
// attivo=false mette in pausa (es. call in attesa di risposta).
// ═══════════════════════════════════════════════

export default function CostTicker({ attivo = true, vocePremium = false, style = {} }) {
  const [secondi, setSecondi] = useState(0);
  const attivoRef = useRef(attivo);
  attivoRef.current = attivo;

  useEffect(() => {
    const t = setInterval(() => {
      if (attivoRef.current) setSecondi(s => s + 1);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <span aria-label={`Costo della chiamata: ${euroDaSecondi(secondi, vocePremium)}`} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '5px 11px', borderRadius: 999, fontSize: 11, fontWeight: 800,
      background: 'rgba(5,7,15,0.7)', border: '1px solid rgba(160,190,255,0.16)',
      color: '#ffc44d', backdropFilter: 'blur(12px)', ...style,
    }}>
      {euroDaSecondi(secondi, vocePremium)}
      <span style={{ fontWeight: 650, color: 'rgba(238,242,255,0.5)', fontSize: 10 }}>
        {vocePremium ? 'premium' : 'standard'}
      </span>
    </span>
  );
}
