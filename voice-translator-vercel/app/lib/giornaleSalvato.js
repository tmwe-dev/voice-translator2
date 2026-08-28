// ═══════════════════════════════════════════════════════════════
// IL GIORNALE DI IERI, PRONTO SUBITO (b.564)
//
// Misurato in produzione: una ricerca impiega fra otto e quindici
// secondi. Nessuna regola di regia compensa un'attesa cosi: un feed
// lento e' un feed che non si apre.
//
// L'IDEA, che e' vecchia come i giornali: quando entri, il giornale
// dell'ultima volta e' gia in mano. Lo leggi mentre quello nuovo si
// stampa, e quando e' pronto si aggiunge — senza farti saltare niente,
// perche' cio che stai guardando non si tocca mai (regola di b.552).
//
// NON E' UNA CACHE DELLA RETE: e' l'ULTIMA PAGINA CHE HAI VISTO, con
// dentro anche i «perche'» e l'ordine deciso dalla regia. Riaprire deve
// essere come non essere mai usciti.
//
// DURA POCO — sei ore. Oltre, un giornale vecchio e' peggio di
// un'attesa: si preferisce l'anello che gira alla notizia di ieri
// spacciata per quella di adesso.
//
// Vive sul telefono, come `visti.js`: e' un fatto di questo apparecchio.
// File PURO: nessun import (lezione di b.559).
// ═══════════════════════════════════════════════════════════════

const CASSETTO = 'vt-giornale';
export const VITA_GIORNALE = 6 * 3600 * 1000;
export const QUANTE = 24;          // due schermate abbondanti, non tutto

/** Cosa serve davvero per ridisegnare una scheda. Il resto si butta. */
function magra(v) {
  if (!v) return null;
  return {
    id: v.id, url: v.url, titolo: v.titolo, sintesi: v.sintesi,
    immagine: v.immagine, miniatura: v.miniatura, canale: v.canale,
    // b.570 — un ARRAY VUOTO, non `undefined`. Una scheda senza `fonti`
    // ha fatto esplodere il Mondo intero («Cannot read properties of
    // undefined»): chi legge si aspetta un elenco, e trovare il nulla al
    // posto di un elenco vuoto e' la differenza fra «non ha fonti» e
    // «non esiste il concetto di fonte». Si consegna sempre la forma
    // giusta, anche quando e' vuota.
    fonti: Array.isArray(v.fonti) ? v.fonti.slice(0, 3) : [],
    dominio: v.dominio, pubblicato: v.pubblicato, quandoTesto: v.quandoTesto,
    lingua: v.lingua, seme: v.seme, motivo: v.motivo, tipo: v.tipo,
  };
}

/** Mette da parte il giornale che si sta guardando. */
export function salvaGiornale(argomenti, video, adesso = Date.now()) {
  try {
    const dentro = {
      quando: adesso,
      argomenti: (Array.isArray(argomenti) ? argomenti : []).slice(0, QUANTE).map(magra).filter(Boolean),
      video: (Array.isArray(video) ? video : []).slice(0, QUANTE).map(magra).filter(Boolean),
    };
    if (!dentro.argomenti.length && !dentro.video.length) return;
    localStorage.setItem(CASSETTO, JSON.stringify(dentro));
  } catch { /* memoria piena o negata: si riparte dall'anello, come prima */ }
}

/** Il giornale di ieri, se e' ancora buono. Altrimenti niente. */
export function giornaleSalvato(adesso = Date.now()) {
  try {
    const grezzo = localStorage.getItem(CASSETTO);
    if (!grezzo) return null;
    const dentro = JSON.parse(grezzo);
    if (!dentro || adesso - (dentro.quando || 0) > VITA_GIORNALE) return null;
    // ═══ b.572 — SI RIMETTE IN FORMA ANCHE QUELLO GIA SCRITTO ═══
    // b.570 ha aggiustato la forma di cio che si SCRIVE. Ma nei telefoni
    // era gia posato il giornale di prima, scritto con la forma vecchia:
    // JSON.stringify non salva le chiavi `undefined`, quindi quelle
    // schede tornano su senza `fonti` del tutto. Il Mondo e' esploso di
    // nuovo, sulla stessa riga di prima, con lo stesso errore.
    // La lezione: aggiustare chi scrive non guarisce cio che e' gia
    // scritto. Chi legge da un deposito legge sempre roba di ieri, e
    // deve rimetterla in forma lui, all'ingresso — una volta sola, per
    // tutti quelli che vengono dopo.
    const argomenti = (Array.isArray(dentro.argomenti) ? dentro.argomenti : []).map(magra).filter(Boolean);
    const video = (Array.isArray(dentro.video) ? dentro.video : []).map(magra).filter(Boolean);
    if (!argomenti.length && !video.length) return null;
    return { argomenti, video, quando: dentro.quando };
  } catch { return null; }
}

/** Quanto e' vecchio, in minuti: serve a decidere se dirlo a schermo. */
export function etaGiornale(salvato, adesso = Date.now()) {
  if (!salvato?.quando) return Infinity;
  return Math.round((adesso - salvato.quando) / 60000);
}
