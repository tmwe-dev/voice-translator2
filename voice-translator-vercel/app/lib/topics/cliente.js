// ═══════════════════════════════════════════════════════════════
// TOPICS — IL LETTORE, uno solo per tutta l'applicazione (b.409)
//
// `/api/topics/search` non risponde con un JSON: risponde a righe, una
// per stadio del lavoro, cosi chi guarda vede la ricerca mentre succede
// («cerco», «ho tre fonti», «fine»). E' la scelta giusta — solo che
// bisogna saperla leggere.
//
// Mondo la sapeva leggere: dentro MondoNews c'era il lettore, scritto a
// mano dentro la funzione di ricerca. Life no. `arricchisciLezione`
// faceva `await r.json()` su un corpo di piu righe, che non e JSON
// valido: la lettura lanciava, il `catch` restituiva `null`, e la
// schermata degradava in silenzio.
//
// Conseguenza vera, e non piccola: in Impara i CONTENUTI «link» e
// «foto» non hanno MAI prodotto niente. Non ogni tanto: mai. Il codice
// c'era, la rotta rispondeva, e il risultato era sempre nessuno.
//
// Adesso il lettore e uno e sta qui. L'audit lo chiede a parole:
// «Creare un solo client Topics condiviso che sappia leggere NDJSON.
// Usarlo sia in Mondo sia in Life. NON duplicare un parser differente
// in ogni componente.» Il secondo parser non e stato scritto: e stato
// tolto quello che c'era e messo in comune.
// ═══════════════════════════════════════════════════════════════

import { consumaQueryAutomatica, segnaQueryAutomatica } from './rami.js';

/**
 * Legge una risposta a righe e restituisce lo stadio «fine».
 *
 * @param {Response} risposta  la risposta con corpo in streaming
 * @param {Function} [suStadio] richiamata a ogni stadio intermedio, per
 *        raccontare il lavoro mentre succede. Non riceve «fine».
 * @returns {Promise<object|null>} l'oggetto dello stadio «fine», o null
 *          se il flusso e finito senza arrivarci.
 * @throws se il servizio dichiara «errore» e non c'e nessun «fine»
 */
export async function leggiARighe(risposta, suStadio) {
  const lettore = risposta.body.getReader();
  const decodifica = new TextDecoder();
  let resto = '';
  let fine = null;
  let errore = '';

  const consuma = (riga) => {
    if (!riga.trim()) return;
    let r;
    try { r = JSON.parse(riga); } catch { return; }   // riga monca: si salta, non si butta tutto
    if (r.stadio === 'fine') fine = r;
    else if (r.stadio === 'errore') errore = r.motivo || 'guasto';
    else if (suStadio) { try { suStadio(r); } catch { /* chi racconta non deve poter fermare chi legge */ } }
  };

  for (;;) {
    const { done, value } = await lettore.read();
    if (done) break;
    resto += decodifica.decode(value, { stream: true });
    const righe = resto.split('\n');
    resto = righe.pop();
    for (const riga of righe) consuma(riga);
  }
  // L'ULTIMA RIGA SENZA A-CAPO. Oggi la rotta chiude sempre con «\n» e
  // quindi non capita mai: e una difesa, non un difetto trovato. Ma un
  // lettore che perde l'ultima riga perde proprio quella che conta.
  consuma(resto);

  if (!fine && errore) throw new Error(errore);
  return fine;
}

/**
 * b.543 — IL FONTIERE. `leggi` guarda la lista che c'e gia (gratis, per
 * sapere se l'icona va accesa); senza `leggi` fa il deep search vero.
 * Non lancia mai: senza fonti si cerca come si e sempre cercato.
 */
export async function chiediFonti({ paese = '', settore = '', nomePaese = '', lingua = 'it', userToken = null, rifai = false, leggi = false }) {
  try {
    if (leggi) {
      const p = new URLSearchParams();
      if (paese) p.set('paese', paese);
      if (settore) p.set('settore', settore);
      const r = await fetch(`/api/topics/fonti?${p.toString()}`, { signal: AbortSignal.timeout(10000) });
      if (!r.ok) return { fonti: [], quando: 0 };
      return (await r.json().catch(() => null)) || { fonti: [], quando: 0 };
    }
    const r = await fetch('/api/topics/fonti', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paese, settore, nomePaese, lingua, userToken, rifai }),
      // il deep search bussa a una ventina di siti: gli si da tempo
      signal: AbortSignal.timeout(60000),
    });
    if (!r.ok) return { fonti: [] };
    return (await r.json().catch(() => null)) || { fonti: [] };
  } catch { return { fonti: [] }; }
}

/**
 * b.541 — I RAMI di un seme: dove puo crescere questa ricerca.
 * Non lancia mai: un giardino che non cresce non deve fermare il
 * giornale — si torna un elenco vuoto e chi guarda continua coi semi.
 */
export async function chiediRami({ seme, lingua = 'it', paese = '', livello = 1, userToken = null }) {
  try {
    const r = await fetch('/api/topics/rami', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seme, lingua, paese, livello, userToken }),
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) return [];
    const d = await r.json().catch(() => null);
    const rami = Array.isArray(d?.rami) ? d.rami : [];
    // b.585 — questi rami non sono una domanda digitata dalla persona:
    // sono stati chiesti dal Giardino per crescere. Il marchio e monouso
    // e verra consumato dalla prima ricerca corrispondente.
    for (const ramo of rami) segnaQueryAutomatica(ramo?.query);
    return rami;
  } catch { return []; }
}

/**
 * Cerca su Topics e restituisce lo stadio «fine».
 * `automatico=true` non significa «non cercare mai»: dice al server che
 * il giro e nato dal feed e che puo evitare i motori quando il registro
 * delle fonti e gia maturo. Se il chiamante non specifica nulla, il
 * Giardino riconosce soltanto le query che ha generato lui; il marchio
 * e monouso, quindi una ricerca manuale successiva resta esplicita.
 */
export async function cercaTopics({
  q, lingua = 'it', cat = 'notizie',
  fresca = false, profonda = false, fonti = 0, segnale = null,
  paeseFonti = '', settoreFonti = '', automatico = null,
} = {}, suStadio) {
  const pulita = String(q || '').trim();
  if (!pulita) return null;
  const giroAutomatico = automatico === null ? consumaQueryAutomatica(pulita) : !!automatico;
  const parametri = new URLSearchParams({ q: pulita, lang: lingua, cat });
  if (fresca) parametri.set('fresh', '1');
  if (profonda) parametri.set('deep', '1');
  if (profonda || fonti) parametri.set('fonti', String(fonti || 6));
  if (paeseFonti) parametri.set('paeseFonti', paeseFonti);
  if (settoreFonti) parametri.set('settoreFonti', settoreFonti);
  if (giroAutomatico) parametri.set('auto', '1');
  const risposta = await fetch(`/api/topics/search?${parametri.toString()}`, segnale ? { signal: segnale } : undefined);
  if (!risposta.ok || !risposta.body) throw new Error(`HTTP ${risposta.status}`);
  return leggiARighe(risposta, suStadio);
}
