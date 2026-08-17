'use client';
import { useState, useEffect, useCallback } from 'react';
import { leggiConsumo } from '../lib/consumo.js';

// useConsumo — legge il consumo (caratteri) e si aggiorna DAL VIVO quando
// arriva un nuovo addebito (evento 'vt:consumo'). Cosi il numero "si vede
// crescere" mentre usi l'app, come chiesto.
export default function useConsumo() {
  const [stato, setStato] = useState(() => leggiConsumo());
  const aggiorna = useCallback(() => setStato(leggiConsumo()), []);
  useEffect(() => {
    aggiorna();
    if (typeof window === 'undefined') return;
    window.addEventListener('vt:consumo', aggiorna);
    return () => window.removeEventListener('vt:consumo', aggiorna);
  }, [aggiorna]);
  return stato; // { sessione, oggi, totale, perChat, storico }
}
