// ═══════════════════════════════════════════════════════════════
// LE TUE STANZE — la continuità che non c'era.
//
// b.537, dal ragionamento con Luca sulla logica di Stanze: «non esiste
// "le mie stanze". Esci e la conversazione sparisce dalla tua vista».
// Aveva ragione: l'elenco mostrava solo le stanze APERTE DA ALTRI, e
// quella dove stavi parlando cinque minuti fa non era da nessuna parte —
// né in cima, né in fondo. Ogni volta si ripartiva da capo.
//
// Qui c'è la memoria minima che serve: dove sei stato, con che nome, con
// quale gettone, quando. Vive nel telefono (nessun dato in più sul
// server) e serve a UNA cosa sola: rimettere in cima cio a cui stavi
// partecipando, e permettere di rientrare con un tocco.
// ═══════════════════════════════════════════════════════════════
import { memGet, memSet } from './memoria.js';

const CHIAVE = 'vt-mie-stanze';
const QUANTE = 12;
// Una stanza dove non torni da un giorno non e' piu' «tua»: sparisce da
// sola, senza che nessuno debba cancellarla a mano.
const VITA_MS = 24 * 60 * 60 * 1000;

function pulisci(elenco) {
  const ora = Date.now();
  return (Array.isArray(elenco) ? elenco : [])
    .filter((v) => v && typeof v.roomId === 'string' && v.roomId)
    .filter((v) => ora - (v.quando || 0) < VITA_MS)
    .sort((a, b) => (b.quando || 0) - (a.quando || 0))
    .slice(0, QUANTE);
}

// memGet/memSet parlano solo di STRINGHE (memSet fa String(valore)): qui
// si serializza a mano, e una memoria illeggibile vale come vuota.
function leggi() {
  try { return pulisci(JSON.parse(memGet(CHIAVE, '[]'))); } catch { return []; }
}
function scrivi(elenco) {
  try { memSet(CHIAVE, JSON.stringify(elenco)); } catch { /* senza memoria si vive: si ricomincia dall'elenco aperto */ }
}

/** Le stanze dove sei stato di recente, la piu fresca in testa. */
export function mieStanze() { return leggi(); }

/** Sei entrato: la stanza sale in cima. Chiamata all'ingresso, non all'uscita. */
export function segnaVisita({ roomId, nome, host, lingua }) {
  const codice = String(roomId || '').toUpperCase();
  if (!codice) return mieStanze();
  const senza = mieStanze().filter((v) => v.roomId !== codice);
  const voce = {
    roomId: codice,
    nome: (nome || '').slice(0, 60),
    host: (host || '').slice(0, 40),
    lingua: lingua || '',
    quando: Date.now(),
  };
  const nuove = pulisci([voce, ...senza]);
  scrivi(nuove);
  return nuove;
}

/** Non voglio piu vederla fra le mie. */
export function dimenticaStanza(roomId) {
  const codice = String(roomId || '').toUpperCase();
  const nuove = mieStanze().filter((v) => v.roomId !== codice);
  scrivi(nuove);
  return nuove;
}
