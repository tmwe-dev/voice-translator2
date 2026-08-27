import { PAESI } from './paesi.js';
import { paeseDaLingua } from './schedaMondo.js';

// ═══════════════════════════════════════════════════════════════
// CASA E VIAGGIO — il mondo segue il viaggiatore (b.523)
//
// Ordine di Luca: «le preferenze non sono obbligatorie, il default
// deve legare alla posizione geografica e la lingua. il mondo deve
// seguire il "viaggiatore" e deve tenerlo informato anche su cosa
// accade nel suo paese. immaginati un italiano in ferie che vuole
// leggere la gazzetta dello sport al mattino ma si trova in cina.
// avra sicuramente interesse nell'avere notizie del suo paese e area
// in cui si trova. poi se ha altre preferenze puo configurare la
// sidebar».
//
// Quindi due poli, non uno:
//   CASA — da dove viene. Lo dice il Paese sul profilo; se non c'e,
//          lo dice la sua lingua (un italiano legge in italiano).
//   QUI  — dove si trova adesso. Lo dice il FUSO ORARIO del
//          dispositivo, che ogni telefono conosce gia.
//
// Perche il fuso e non la geolocalizzazione: il fuso non chiede
// permessi, non apre finestre, non costa batteria e non e un dato
// sensibile — e non sbaglia mai il Paese di un viaggiatore, perche
// il telefono lo aggiorna da solo appena atterra. La posizione GPS
// darebbe la citta invece del Paese, in cambio di un permesso che
// molti negano e che qui non serve a niente.
//
// Il fuso non basta da solo a distinguere Paesi che lo condividono
// (Europe/Rome vale per tre Paesi): quando capita si prende il primo
// che lo dichiara come fuso PRINCIPALE, ed e giusto cosi — sono
// Paesi confinanti, e le notizie «dell'area in cui si trova» sono le
// stesse. Se non si riconosce niente si torna `null` e non si
// inventa: meglio nessun secondo polo che uno sbagliato.
// ═══════════════════════════════════════════════════════════════

/** Il Paese in cui il dispositivo dice di trovarsi, dal fuso orario. */
export function paeseDalFuso(fusoDato) {
  let fuso = fusoDato;
  if (!fuso) {
    try { fuso = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return null; }
  }
  if (!fuso) return null;
  const f = String(fuso).trim();
  for (const p of PAESI) {
    if (Array.isArray(p.fusi) && p.fusi.includes(f)) return p.codice;
  }
  return null;
}

/** Il Paese di casa: prima il profilo, poi la lingua. */
export function paeseDiCasa(prefs) {
  const dalProfilo = prefs?.country || prefs?.mondoPaese;
  if (dalProfilo) return String(dalProfilo).toUpperCase();
  const lingua = prefs?.lang || prefs?.uiLang;
  return lingua ? (paeseDaLingua(lingua) || null) : null;
}

/**
 * I due poli del viaggiatore.
 * @returns {{casa: string|null, qui: string|null, inViaggio: boolean}}
 */
export function poliDelViaggiatore(prefs, fusoDato) {
  const casa = paeseDiCasa(prefs);
  const qui = paeseDalFuso(fusoDato);
  return { casa, qui, inViaggio: !!(casa && qui && casa !== qui) };
}

/**
 * Le ricerche da fare quando l'utente NON ha configurato niente.
 * Ordine di Luca: prima il suo Paese (la Gazzetta del mattino), poi
 * dove si trova. Se non e in viaggio resta un polo solo, e non si
 * cerca due volte la stessa cosa.
 *
 * @param nomeDi funzione codice -> nome del Paese nella lingua di chi guarda
 * @returns [{codice, query}] — mai vuoto: nel dubbio, «breaking news»
 */
export function ricerchePredefinite(prefs, nomeDi, fusoDato) {
  const { casa, qui } = poliDelViaggiatore(prefs, fusoDato);
  const fatti = new Set();
  const out = [];
  for (const codice of [casa, qui]) {
    if (!codice || fatti.has(codice)) continue;
    fatti.add(codice);
    const nome = typeof nomeDi === 'function' ? nomeDi(codice) : null;
    out.push({ codice, query: nome ? `${nome} breaking news` : 'breaking news' });
  }
  if (!out.length) out.push({ codice: null, query: 'breaking news' });
  return out;
}
