// ═══════════════════════════════════════════════════════════════
// L'INTERPRETE DEL VIDEO — la logica pura (b.551)
//
// Quattro ordini di Luca, tutti nella stessa frase di lavoro:
//
//   · «possiamo trovare il modo di silenziare l'audio e tradurre
//     direttamente con elevenlabs?»
//   · «rallentiamo la partenza del video di 5 secondi e diamo modo al
//     sistema di elaborare frasi compiute? sincronizzando poi
//     l'audio??»
//   · «potremmo darla dove disponibile no??»
//   · ordine permanente: «ricordati l'uso differenziato asia mondo
//     della traduzione con i sistemi alibaba etc».
//
// QUI DENTRO NON SI PARLA CON NESSUNO. Niente rete, niente audio,
// niente finestra: solo decisioni. Cosi le si puo provare davvero — e
// la parte difficile e proprio decidere, non chiamare un fornitore.
//
// LA COSA CHE CONTA DAVVERO E' LA FRASE COMPIUTA. I sottotitoli di
// YouTube non sono frasi: sono RIGHE, tagliate dove finisce lo spazio
// sullo schermo. «il presidente ha detto che» / «domani si vota».
// Tradurre riga per riga vuol dire tradurre mezze frasi, e una mezza
// frase tradotta e' quasi sempre sbagliata — la lingua di arrivo non ha
// lo stesso ordine delle parole. Per questo si RICUCE: una riga che
// finisce senza punteggiatura non e' finita, e aspetta la prossima.
//
// E LA RINCORSA. Ricucire costa tempo (si aspetta la riga dopo), e poi
// bisogna tradurre e far parlare una voce: se si comincia quando la
// frase e' gia sullo schermo, si arriva sempre tardi. Quindi si guarda
// AVANTI di cinque secondi — sono i cinque secondi che Luca ha chiesto
// di «rallentare la partenza»: non si rallenta il video, si anticipa
// l'interprete. Il risultato per chi guarda e' lo stesso, ma il video
// resta quello vero dell'editore e non lo tocchiamo.
//
// I TEMPI QUI SONO IN SECONDI (come `currentTime` di un player), con i
// decimali. Le costanti in millisecondi finiscono in `_MS` e vengono
// divise dove servono: cosi non ci si sbaglia leggendo.
// ═══════════════════════════════════════════════════════════════

/** I cinque secondi di vantaggio chiesti da Luca: l'interprete prepara
 *  la frase che comincera' fra poco, non quella che e' gia' passata. */
export const RINCORSA_MS = 5000;

/** Il tetto della ricucitura: oltre queste misure una frase si chiude
 *  comunque, anche se la punteggiatura non e' mai arrivata. Senza tetto
 *  un video senza punti (i sottotitoli automatici spesso non ne hanno)
 *  diventerebbe UNA frase sola lunga un'ora. */
export const TETTO_CARATTERI = 200;
export const TETTO_SECONDI = 12;

// Quanto indietro si accetta di essere: se una frase e' finita da piu' di
// due secondi il treno e' perso e non si dice piu' (succede quando si
// salta avanti col dito). Dirla adesso vorrebbe dire parlare sopra a
// un'altra scena.
const TOLLERANZA_INDIETRO = 2;

// ── ORDINE PERMANENTE DI LUCA: ASIA E MONDO NON SONO LA STESSA COSA ──
// Per queste lingue la voce la fa DashScope/CosyVoice (Alibaba), per
// tutte le altre ElevenLabs. Non e' una preferenza estetica: e' la
// stessa divisione che il progetto usa gia' altrove (asiaConstants.js,
// ttsAsia.js), e va tenuta in UN posto solo anche qui.
const LINGUE_ASIA = new Set(['zh', 'ja', 'ko', 'th', 'vi']);

// Un sottotitolo piu' lungo di mille caratteri non esiste: se arriva,
// e' spazzatura o un attacco. Si taglia invece di portarselo dietro.
const MAX_TESTO = 1000;

const ENTITA = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", nbsp: ' ' };

/**
 * Da testo di sottotitolo a testo da leggere: via i tag (YouTube manda
 * <br>, <i>, <font>...), via le entita', via gli a-capo e gli spazi
 * doppi. Quello che resta e' quello che si puo' dare a una voce.
 */
function testoPulito(grezzo) {
  if (typeof grezzo !== 'string') return '';
  return grezzo
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(amp|lt|gt|quot|apos|#39|nbsp);/g, (_, e) => ENTITA[e] || ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TESTO);
}

// Una frase e' finita quando lo dice la punteggiatura — compresa quella
// che non e' la nostra: il punto ideografico cinese e giapponese, il
// danda dell'hindi, il punto interrogativo arabo. Un interprete che
// riconosce solo il punto latino ricuce male meta' del mondo.
const CHIUSURA = /[.!?…。！？؟।]+["'»)\]”’]*$/;

/** La riga dice tutto quello che doveva dire? */
function fraseChiusa(testo) {
  return CHIUSURA.test(String(testo || '').trim());
}

/**
 * PULIZIA — quello che entra qui e' roba di rete, e la roba di rete e'
 * sempre storta. Si buttano: le righe che non sono oggetti, quelle senza
 * testo, quelle con tempi che non sono numeri, e quelle che finiscono
 * prima di cominciare. Quello che resta e' ordinato per tempo, perche'
 * nessuno garantisce che arrivi in ordine.
 *
 * @param {Array} grezzi righe come arrivano dal fornitore
 * @returns {Array<{inizio:number, fine:number, testo:string}>}
 */
export function sanaSottotitoli(grezzi) {
  if (!Array.isArray(grezzi)) return [];
  const buone = [];
  for (const r of grezzi) {
    if (!r || typeof r !== 'object') continue;
    const testo = testoPulito(r.testo);
    if (!testo) continue;
    const inizio = Number(r.inizio);
    const fine = Number(r.fine);
    if (!Number.isFinite(inizio) || inizio < 0) continue;
    if (!Number.isFinite(fine) || fine <= inizio) continue;
    buone.push({ inizio, fine, testo });
  }
  return buone.sort((a, b) => a.inizio - b.inizio);
}

/**
 * LA RICUCITURA — il cuore dell'ordine di Luca «diamo modo al sistema di
 * elaborare frasi compiute».
 *
 * Una riga che finisce senza punteggiatura non e' finita: si attacca la
 * successiva. Si smette di attaccare quando la punteggiatura arriva,
 * oppure quando si sfonda uno dei due tetti (caratteri o secondi) —
 * perche' una frase infinita non e' piu' una frase, e' un ritardo.
 *
 * @param {Array} righe sottotitoli grezzi {inizio, fine, testo}
 * @returns {Array<{inizio:number, fine:number, testo:string}>} frasi compiute
 */
export function frasiCompiute(righe) {
  const pulite = sanaSottotitoli(righe);
  const frasi = [];
  let corrente = null;

  const chiudi = () => {
    if (corrente) frasi.push(corrente);
    corrente = null;
  };

  for (const r of pulite) {
    if (!corrente) {
      corrente = { inizio: r.inizio, fine: r.fine, testo: r.testo };
    } else {
      const unito = `${corrente.testo} ${r.testo}`;
      const troppoLunga = unito.length > TETTO_CARATTERI;
      const troppoLenta = (r.fine - corrente.inizio) > TETTO_SECONDI;
      if (troppoLunga || troppoLenta) {
        // il tetto vince sulla grammatica: meglio una frase spezzata
        // detta in tempo che una perfetta detta a scena finita
        chiudi();
        corrente = { inizio: r.inizio, fine: r.fine, testo: r.testo };
      } else {
        corrente = {
          inizio: corrente.inizio,
          fine: Math.max(corrente.fine, r.fine),
          testo: unito,
        };
      }
    }
    if (fraseChiusa(corrente.testo)) chiudi();
  }
  chiudi();
  return frasi;
}

/**
 * La targhetta di una frase: serve a ricordarsi cosa si e' gia' detto
 * senza tenere in mano gli oggetti veri (che a ogni ridisegno sono
 * copie nuove). Tempo di inizio piu' l'inizio del testo: due frasi
 * diverse non possono avere la stessa targhetta.
 */
export function chiaveFrase(frase) {
  const inizio = Number(frase?.inizio);
  const quando = Number.isFinite(inizio) ? Math.round(inizio * 100) : 'x';
  return `${quando}|${String(frase?.testo || '').slice(0, 60)}`;
}

function insiemeDette(giaDette) {
  if (giaDette instanceof Set) return giaDette;
  if (Array.isArray(giaDette)) return new Set(giaDette);
  return new Set();
}

/**
 * QUALE FRASE VA DETTA ADESSO — e la risposta e' spesso «nessuna», che
 * e' una risposta buona: vuol dire che si sta zitti al momento giusto.
 *
 * Si guarda avanti di RINCORSA_MS: si prende la prima frase non ancora
 * detta che comincia entro quella finestra. Se comincia dopo, si torna
 * null e si riprova fra un attimo — non si accumula lavoro in anticipo,
 * perche' la traduzione di cinque frasi avanti la pagherebbe l'utente
 * anche se poi cambia video.
 *
 * @param {Array} frasi frasi compiute, in ordine
 * @param {number} secondiVideo dove siamo nel video
 * @param {Set|Array} giaDette targhette (o indici) di cio' che e' gia' passato
 * @returns {{inizio:number, fine:number, testo:string, indice:number, chiave:string}|null}
 */
export function prossimaDaDire(frasi, secondiVideo, giaDette) {
  const elenco = Array.isArray(frasi) ? frasi : [];
  const ora = Number(secondiVideo);
  if (!elenco.length || !Number.isFinite(ora)) return null;

  const dette = insiemeDette(giaDette);
  const finestra = ora + RINCORSA_MS / 1000;

  for (let i = 0; i < elenco.length; i++) {
    const f = elenco[i];
    const inizio = Number(f?.inizio);
    const fine = Number(f?.fine);
    if (!f || !Number.isFinite(inizio)) continue;
    const chiave = chiaveFrase(f);
    if (dette.has(chiave) || dette.has(i)) continue;
    // treno perso: si e' saltati avanti, questa frase appartiene a una
    // scena che non c'e' piu'
    if (Number.isFinite(fine) && fine < ora - TOLLERANZA_INDIETRO) continue;
    // troppo presto: le frasi sono in ordine, quindi tutte le prossime
    // sono ancora piu' lontane. Si smette di cercare.
    if (inizio > finestra) return null;
    return { inizio, fine, testo: String(f.testo || ''), indice: i, chiave };
  }
  return null;
}

/**
 * ORDINE PERMANENTE DI LUCA — la voce di questa lingua la fa Alibaba
 * (DashScope/CosyVoice) o ElevenLabs? Vero per cinese, giapponese,
 * coreano, thai e vietnamita; falso per tutto il resto.
 * Regge 'zh-TW', 'JA', 'ko_KR' e anche niente.
 */
export function viaAsiatica(lingua) {
  const base = String(lingua || '').trim().toLowerCase().split(/[-_]/)[0];
  return LINGUE_ASIA.has(base);
}

/**
 * «potremmo darla dove disponibile no??» (Luca) — e la risposta e' si',
 * ma SOLO dove i sottotitoli esistono davvero. Un elenco vuoto, un
 * elenco di righe vuote o un elenco di tempi storti non e' disponibilita':
 * e' un tasto che promette e non mantiene, e quelli non si mettono.
 *
 * Accetta sia l'elenco di righe sia la risposta intera della rotta.
 */
export function disponibile(sottotitoli) {
  if (!sottotitoli) return false;
  if (Array.isArray(sottotitoli)) return sanaSottotitoli(sottotitoli).length > 0;
  if (typeof sottotitoli !== 'object') return false;
  if (sottotitoli.disponibili === false) return false;
  return sanaSottotitoli(sottotitoli.righe).length > 0;
}
