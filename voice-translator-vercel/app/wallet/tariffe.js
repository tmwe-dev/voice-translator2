// ═══════════════════════════════════════════════════════════════
// TARIFFE — L'UNICO FILE CON I NUMERI DEI SOLDI.
//
// Regola: se devi cambiare un prezzo o un costo, lo cambi QUI.
// Nessun altro file del wallet contiene numeri economici.
//
// Unità: il credito interno è il SECONDO di conversazione.
// All'utente mostriamo sempre minuti e ore, mai "token".
// ═══════════════════════════════════════════════════════════════

// ── Quanto ci costa UN MINUTO di conversazione (in centesimi di euro) ──
// Serve solo per calcolare margine e ore incluse. Aggiorna se i provider cambiano prezzi.
export const COSTO_PROVIDER_CENT_MIN = {
  voceStandard: 0.7,   // Deepgram STT (~0.6¢) + LLM mini (~0.1¢) + Edge TTS (gratis)
  vocePremium: 3.5,    // come sopra + ElevenLabs (~2.8¢/min di parlato)
};

// ── Moltiplicatore consumo: la voce premium consuma di più ──
// 1 minuto con ElevenLabs scala 3 minuti di credito. Scritto anche in UI.
export const MOLTIPLICATORE_PREMIUM = 3;

// ── Pacchetti in vendita (Stripe) ──
// secondi = credito che l'utente riceve. Le ore mostrate si calcolano da qui.
export const PACCHETTI = [
  { id: 'pack_s', euro: 4.99, secondi: 3 * 3600, nome: 'Start' },     // 3 ore standard
  { id: 'pack_m', euro: 11.99, secondi: 8 * 3600, nome: 'Viaggio', consigliato: true }, // 8 ore
  { id: 'pack_l', euro: 24.99, secondi: 20 * 3600, nome: 'Mondo' },   // 20 ore
];

// ── Bonus di benvenuto per i nuovi utenti (secondi) ──
export const BONUS_BENVENUTO_SECONDI = 30 * 60; // 30 minuti gratis

// ── Soglie della batteria (frazione del pacchetto medio) ──
export const BATTERIA = {
  pienaSotto: 1.0,    // 100%
  gialloSotto: 0.5,   // sotto il 50% → giallo
  rossoSotto: 0.15,   // sotto il 15% → rosso
  riferimentoSecondi: 8 * 3600, // il "pieno" di riferimento è il pacchetto medio
};

// ── Funzioni di lettura (nessun calcolo strano, solo divisioni) ──

/** Da secondi a testo leggibile: 9000 → "2h 30m" */
export function formattaDurata(secondi) {
  if (!secondi || secondi <= 0) return '0m';
  const ore = Math.floor(secondi / 3600);
  const minuti = Math.floor((secondi % 3600) / 60);
  if (ore === 0) return `${minuti}m`;
  return `${ore}h ${minuti}m`;
}

/** Ore teoriche incluse in un pacchetto, per la scheda prezzo. */
export function oreIncluse(pacchetto) {
  return {
    standard: formattaDurata(pacchetto.secondi),
    premium: formattaDurata(Math.floor(pacchetto.secondi / MOLTIPLICATORE_PREMIUM)),
  };
}

/** Colore batteria: 'verde' | 'giallo' | 'rosso' in base al saldo. */
export function coloreBatteria(saldoSecondi) {
  const frazione = saldoSecondi / BATTERIA.riferimentoSecondi;
  if (frazione < BATTERIA.rossoSotto) return 'rosso';
  if (frazione < BATTERIA.gialloSotto) return 'giallo';
  return 'verde';
}
