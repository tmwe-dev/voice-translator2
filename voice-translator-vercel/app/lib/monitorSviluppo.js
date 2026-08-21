// ═══════════════════════════════════════════════════════════════
// b.363 — memDel non serve piu: era usato solo dallo svuota-monitor, tolto
// perche non lo chiamava nessuno.
import { memGet, memSet } from './memoria.js';
// b.275 — IL MONITOR: dove passa la voce, e quanto ci mette
//
// La scatola nera (diagnosticaChiamata.js) racconta la CHIAMATA. Questo
// racconta la CATENA: la voce entra dal microfono, viene spedita, torna
// come testo, viene tradotta, e infine compare a schermo. Cinque
// passaggi, e finora quando qualcosa "andava lento" o "non arrivava" non
// c'era modo di dire QUALE dei cinque.
//
// Ogni passaggio lascia una riga con il tempo che ha impiegato e quanto
// ha prodotto. Le righe restano sul telefono e si copiano dal menu ...
// della stanza, insieme al rapporto della chiamata.
//
// Regola, la stessa della scatola nera: se qui va storto qualcosa, il
// prodotto non se ne accorge. Mai un errore che risale.
// ═══════════════════════════════════════════════════════════════

const CHIAVE = 'vt-monitor';
const QUANTE = 60;
const righe = [];

/** Registra un passaggio. `dati` sono numeri e parole brevi, mai testo dell'utente. */
export function traccia(fase, dati = {}) {
  try {
    const r = { t: Date.now(), fase, ...dati };
    righe.push(r);
    if (righe.length > QUANTE) righe.splice(0, righe.length - QUANTE);
    try { memSet(CHIAVE, JSON.stringify(righe.slice(-QUANTE))); } catch { /* memoria piena o navigazione privata: le righe restano solo in memoria, va bene lo stesso */ }
    try { if (typeof window !== 'undefined') window.__bartalkMonitor = righe; } catch { /* fuori dal browser: la copia comoda in window salta, le righe restano in memoria */ }
  } catch { /* il monitor non deve mai disturbare cio che sta misurando: si perde la riga e si prosegue */ }
}

/** Comodo per misurare un passaggio: restituisce la funzione che lo chiude. */
export function cronometro(fase, datiIniziali = {}) {
  const inizio = Date.now();
  return (dati = {}) => traccia(fase, { ms: Date.now() - inizio, ...datiIniziali, ...dati });
}

// b.363 — non piu esportata: la usa solo questo file. Era offerta a tutto
// il progetto senza che nessuno la chiedesse.
function leggiMonitor() {
  if (righe.length) return righe;
  try { const v = JSON.parse(memGet(CHIAVE) || '[]'); return Array.isArray(v) ? v : []; }
  catch { return []; }
}

// b.363 — qui c'era svuotaMonitor, il pulsante per azzerare il registro
// di sviluppo. Non lo premeva nessuno: ne una schermata ne un collaudo.

/** Le righe in una forma leggibile, la piu recente in fondo. */
export function rapportoMonitorTesto(quante = 25) {
  const r = leggiMonitor().slice(-quante);
  if (!r.length) return 'Monitor vuoto: nessun passaggio registrato su questo telefono.';
  const t0 = r[0].t;
  return r.map(x => {
    const dettagli = Object.entries(x)
      .filter(([k]) => k !== 't' && k !== 'fase')
      .map(([k, v]) => `${k}=${v}`)
      .join(' ');
    const sec = ((x.t - t0) / 1000).toFixed(1).padStart(6);
    return `${sec}s  ${String(x.fase).padEnd(22)} ${dettagli}`;
  }).join('\n');
}
