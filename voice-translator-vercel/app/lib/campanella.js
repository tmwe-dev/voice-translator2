// ═══════════════════════════════════════════════════════════════
// LA CAMPANELLA DEGLI AVVISI — la parte che pensa.
//
// b.545, ordine di Luca: «dobbiamo avvisare l'utente in alto nelle
// pagine di commenti come instagram o facebook, nella sua stanza potra
// quindi aprire il commento/lista direttamente dal pulsante».
//
// Chi ha commentato un articolo, o ci ha messo il cuore, quel contenuto
// lo SEGUE: se poi qualcuno risponde, deve saperlo senza tornare a
// controllare a mano. E' esattamente il mestiere della campanella dei
// social — e i social hanno gia risolto, a loro spese, i tre problemi
// che questa roba porta con se:
//
//   · il numero sul pallino non cresce all'infinito. Oltre nove si
//     scrive «9+»: un numero grande spaventa e non aggiunge niente, chi
//     lo legge deve solo capire che c'e' parecchio da guardare;
//   · tre commenti sullo stesso articolo sono UNA riga con scritto tre,
//     non tre righe uguali che riempiono l'elenco (raggruppaPerContenuto);
//   · «letto» e' un momento, non una casella per avviso: quando apro la
//     campanella segno l'ora, e nuovo e' tutto cio che e' successo dopo.
//     Una riga sola nel telefono invece di una lista di stati da tenere
//     allineata con il server.
//
// Qui dentro non c'e' rete e non c'e' schermo: solo conti, cosi si
// possono provare per davvero (__tests__/avvisi-b545.test.js). La rete
// sta in /api/mondo/avvisi, lo schermo in components/ui/Campanella.js.
//
// Sul nome del file: `lib/avvisi.js` era gia preso, e da tutt'altro —
// la coda dei messaggini che appaiono in basso (b.111). Sono due cose
// diverse e devono restare due file diversi: quello avvisa DURANTE
// un'azione ("salvato", "rete assente") e sparisce da solo dopo quattro
// secondi; questo raccoglie quel che e' successo MENTRE non c'ero e
// aspetta che lo guardi. Percio qui si chiama come il pulsante che lo
// mostra: la campanella.
// ═══════════════════════════════════════════════════════════════
import { memGet, memSet } from './memoria.js';

// il momento in cui ho aperto la campanella l'ultima volta. Vive nel
// telefono e non sul server: e' una cosa mia, e come per il cuore gia
// messo (lib/gradimento.js) non c'e' motivo di raccontarla a nessuno.
const CHIAVE_LETTI = 'vt-avvisi-letti';

/** I tre motivi per cui vale la pena disturbare qualcuno. Fuori da
 *  questi tre un avviso non esiste: meglio nessuna riga che una riga
 *  che nessuno sa leggere. */
export const TIPI_AVVISO = ['commento', 'stanza', 'reazione'];

/** Il tetto del pallino: oltre nove si scrive «9+», come fanno i social. */
export const TETTO_PALLINO = 9;

/** Quanti avvisi si tengono da parte. Cinquanta sono gia piu di quanti
 *  se ne leggano in una volta: oltre e' zavorra. */
export const QUANTI_RICORDO = 50;

/** Un avviso vero: ha un'identita, un contenuto a cui punta e un motivo
 *  riconoscibile. Quel che non lo e' viene scartato in silenzio — una
 *  riga malformata non deve far sparire tutta la campanella. */
function valido(a) {
  return !!a && typeof a === 'object' && !Array.isArray(a)
    && typeof a.id === 'string' && a.id.trim() !== ''
    && typeof a.chiave === 'string' && a.chiave.trim() !== ''
    && TIPI_AVVISO.includes(a.tipo);
}

/** L'ora di un avviso, sempre un numero: se manca o e' storta vale zero,
 *  cioe «vecchissimo» — non nuovo. Nel dubbio non si disturba nessuno. */
function conQuando(a) {
  const n = Number(a.quando);
  return { ...a, quando: Number.isFinite(n) && n > 0 ? n : 0 };
}

/** La soglia di lettura, sempre un numero: senza memoria (o con memoria
 *  illeggibile) vale zero, cioe e' tutto da leggere. */
function soglia(lettiFinoA) {
  const n = Number(lettiFinoA);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Quelli arrivati DOPO l'ultima volta che ho aperto la campanella, dal
 * piu recente. E' tutta la definizione di «non letto» che serve.
 */
export function avvisiNonLetti(avvisi, lettiFinoA) {
  if (!Array.isArray(avvisi)) return [];
  const dopo = soglia(lettiFinoA);
  return avvisi
    .filter(valido)
    .map(conQuando)
    .filter((a) => a.quando > dopo)
    .sort((a, b) => b.quando - a.quando);
}

/**
 * Il numero da scrivere dentro il pallino rosso. Si ferma a nove: oltre,
 * la cifra esatta non cambia niente per chi guarda (vedi etichettaPallino
 * per il «9+» che si legge sullo schermo).
 */
export function quantiNuovi(avvisi, lettiFinoA) {
  const quanti = avvisiNonLetti(avvisi, lettiFinoA).length;
  return quanti > TETTO_PALLINO ? TETTO_PALLINO : quanti;
}

/**
 * Il pallino come si legge: '' quando non c'e' niente di nuovo (e allora
 * il pallino non si disegna proprio), '3' quando sono tre, '9+' quando
 * sono tanti.
 */
export function etichettaPallino(avvisi, lettiFinoA) {
  const quanti = avvisiNonLetti(avvisi, lettiFinoA).length;
  if (quanti <= 0) return '';
  return quanti > TETTO_PALLINO ? `${TETTO_PALLINO}+` : String(quanti);
}

/** L'ora dell'ultima apertura della campanella. Zero se non l'ho mai
 *  aperta, o se il browser vieta la memoria (WhatsApp, cookie bloccati):
 *  in quel caso ogni giro riparte da capo, ma la campanella funziona. */
export function ultimaLettura() {
  const n = Number(memGet(CHIAVE_LETTI, '0'));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * «Ho guardato»: si chiama aprendo la campanella. Torna il momento
 * segnato, cosi chi la chiama puo spegnere subito il pallino senza
 * rileggere la memoria.
 */
export function segnaLetti(quando) {
  const n = Number(quando) > 0 ? Number(quando) : Date.now();
  try { memSet(CHIAVE_LETTI, String(n)); }
  catch { /* memoria vietata: il pallino si spegne comunque per questa volta */ }
  return n;
}

/**
 * Fonde quel che avevo con quel che arriva ora: niente doppioni (a
 * comandare e' l'id), i cinquanta piu recenti, dal piu nuovo.
 *
 * Lo stesso avviso puo arrivare due volte — la campanella richiede la
 * lista ogni minuto e la finestra di richiesta si sovrappone apposta.
 * Senza questa fusione l'elenco si riempirebbe di copie.
 */
export function unisciAvvisi(vecchi, nuovi) {
  const dentro = new Map();
  const tutti = [
    ...(Array.isArray(nuovi) ? nuovi : []),
    ...(Array.isArray(vecchi) ? vecchi : []),
  ];
  for (const grezzo of tutti) {
    if (!valido(grezzo)) continue;
    const a = conQuando(grezzo);
    const gia = dentro.get(a.id);
    // a parita di id vince la copia con l'ora piu alta: se una delle due
    // e' arrivata monca (quando a zero) non deve retrodatare l'avviso.
    if (!gia || a.quando > gia.quando) dentro.set(a.id, a);
  }
  return [...dentro.values()]
    .sort((a, b) => b.quando - a.quando)
    .slice(0, QUANTI_RICORDO);
}

/**
 * Le righe da mostrare: tre commenti sullo stesso articolo diventano una
 * riga sola con scritto tre, datata all'ultimo arrivato — «come
 * instagram» (Luca). Tipi diversi sullo stesso contenuto restano righe
 * diverse: «tre commenti» e «due reazioni» sono due notizie, non una.
 *
 * Lo stesso avviso ripetuto (stesso id) conta una volta sola: il
 * conteggio deve dire quante cose sono successe, non quante volte le
 * abbiamo lette.
 */
export function raggruppaPerContenuto(avvisi) {
  if (!Array.isArray(avvisi)) return [];
  const visti = new Set();
  const righe = new Map();
  for (const grezzo of avvisi) {
    if (!valido(grezzo)) continue;
    const a = conQuando(grezzo);
    if (visti.has(a.id)) continue;
    visti.add(a.id);
    const posto = `${a.tipo}|${a.chiave}`;
    const riga = righe.get(posto);
    const titolo = typeof a.titolo === 'string' ? a.titolo : '';
    if (!riga) {
      righe.set(posto, { id: a.id, tipo: a.tipo, chiave: a.chiave, titolo, quando: a.quando, quanti: 1 });
      continue;
    }
    riga.quanti += 1;
    // la riga porta la faccia dell'ultimo arrivato: il titolo che si
    // legge e l'ora che la ordina sono quelli della cosa piu recente.
    if (a.quando > riga.quando) {
      riga.quando = a.quando;
      riga.id = a.id;
      if (titolo) riga.titolo = titolo;
    }
  }
  return [...righe.values()].sort((a, b) => b.quando - a.quando);
}
