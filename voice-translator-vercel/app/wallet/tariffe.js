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

// ── Conversazione DAL VIVO col Compagno (agente ElevenLabs) ──
//
// b.407, decisione della Via B (docs/PIANO-LIFE-COMPAGNI.md §5-ter).
// Il dal-vivo e una conversazione vocale premium: dentro un minuto ci
// stanno l'ascolto, il cervello e la voce, tutti dallo stesso fornitore.
// Consuma quindi come la voce premium — un minuto parlato scala tre
// minuti di credito. NON e un numero nuovo: e lo stesso moltiplicatore
// gia scritto sopra, riusato di proposito perche l'utente ha una
// regola sola da ricordare.
//
// ATTENZIONE, e un fermo su Luca: il listino VERO degli agenti
// conversazionali ElevenLabs (che comprende anche il loro STT e il loro
// modello) si legge solo dal pannello del suo piano, e potrebbe stare
// sopra i 3,5 cent/min della sola voce. Finche non lo verifica, questo
// numero e la stima piu prudente che possiamo giustificare — e sta qui,
// in una riga sola, apposta per essere cambiato senza cercarlo.
export const MOLTIPLICATORE_DAL_VIVO = MOLTIPLICATORE_PREMIUM;

// Quanto si BLOCCA all'apertura della linea (credito, non parlato).
// E' un tetto dichiarato, non un prezzo: alla chiusura si addebita la
// durata vera e il resto torna indietro. Quindici minuti di telefonata
// e la misura oltre la quale, se cade il collegamento, non vogliamo
// tenere bloccato altro credito.
export const LIVE_TETTO_MINUTI = 15;
export const LIVE_TETTO_SECONDI = LIVE_TETTO_MINUTI * 60 * MOLTIPLICATORE_DAL_VIVO;

/** Da secondi di telefonata a secondi di credito. Una riga, un posto solo. */
export function creditoDalVivo(secondiParlati) {
  const s = Number.isFinite(secondiParlati) ? Math.max(0, secondiParlati) : 0;
  return Math.min(LIVE_TETTO_SECONDI, Math.ceil(s * MOLTIPLICATORE_DAL_VIVO));
}

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
  if (!Number.isFinite(secondi) || secondi === 0) return '0m';
  // b.364 — da quando c'e la tolleranza il credito puo andare SOTTO
  // ZERO, e un debito scritto "0m" e la trappola peggiore che possiamo
  // tendere: la persona ricarica tre ore, ne vede due e quaranta, e
  // pensa di essere stata derubata. Il meno si scrive.
  const segno = secondi < 0 ? '-' : '';
  const quanti = Math.abs(secondi);
  const ore = Math.floor(quanti / 3600);
  const minuti = Math.floor((quanti % 3600) / 60);
  // e un debito sotto il minuto non e "-0m": se devi qualcosa, si vede.
  if (ore === 0) return `${segno}${segno ? Math.max(1, minuti) : minuti}m`;
  return `${segno}${ore}h ${minuti}m`;
}

/** Ore teoriche incluse in un pacchetto, per la scheda prezzo. */
export function oreIncluse(pacchetto) {
  return {
    standard: formattaDurata(pacchetto.secondi),
    premium: formattaDurata(Math.floor(pacchetto.secondi / MOLTIPLICATORE_PREMIUM)),
  };
}

// ── Prezzo di VENDITA all'utente (per mostrare i costi in euro) ──
// Derivato dal pacchetto medio: €11,99 / 480 min ≈ 2,5 cent/min standard.
export const PREZZO_VENDITA_CENT_MIN = { standard: 2.5, premium: 7.5 };

// ── Clonazione voce (ElevenLabs, una tantum) ──
// b.157 — prima il prezzo (500 "crediti" = €5,00) viveva SOLO nel
// vecchio sistema Redis (CLONE_COST_CREDITS in api/voice-clone), un
// campo che per chi paga col wallet resta sempre a zero: la clonazione
// risultava "credito insufficiente" per chiunque avesse pagato con la
// ricarica vera, anche con il saldo pieno. Stesso prezzo di sempre
// (€5,00), convertito nei secondi del wallet alla tariffa standard.
export const COSTO_CLONAZIONE_SECONDI = Math.round((500 / PREZZO_VENDITA_CENT_MIN.standard) * 60);

// ── Avatar generato (OpenAI gpt-image-1, una tantum per immagine) ──
// b.221 — la generazione dell'immagine dell'avatar costa (gpt-image-1, qualità
// 'low' ≈ 3-4 cent a immagine). La si fattura dal wallet come tutto il resto,
// così il "numero limitato" chiesto è naturale: quando il credito finisce, 402.
// Stessa formula della clonazione: cent → secondi alla tariffa standard.
export const COSTO_AVATAR_CENT = 4;
export const COSTO_AVATAR_SECONDI = Math.round((COSTO_AVATAR_CENT / PREZZO_VENDITA_CENT_MIN.standard) * 60);

/** Da secondi consumati a euro (per il contatore live nelle call). */
export function euroDaSecondi(secondi, vocePremium = false) {
  const centMin = vocePremium ? PREZZO_VENDITA_CENT_MIN.premium : PREZZO_VENDITA_CENT_MIN.standard;
  const euro = (secondi / 60) * centMin / 100;
  return '\u20AC' + euro.toFixed(2).replace('.', ',');
}

/** Colore batteria: 'verde' | 'giallo' | 'rosso' in base al saldo. */
export function coloreBatteria(saldoSecondi) {
  const frazione = saldoSecondi / BATTERIA.riferimentoSecondi;
  if (frazione < BATTERIA.rossoSotto) return 'rosso';
  if (frazione < BATTERIA.gialloSotto) return 'giallo';
  return 'verde';
}
