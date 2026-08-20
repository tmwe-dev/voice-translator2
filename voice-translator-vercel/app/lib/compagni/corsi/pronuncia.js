// ═══════════════════════════════════════════════════════════════
// PRONUNCIA — dire la frase ad alta voce e sapere com'è andata
// (Luca, b.244 — ripreso da RadioChat: PronunciationPanel + analyzer)
//
// È il pezzo che rende Impara un gioco invece di una lettura: il Maestro
// propone una frase, tu la dici, e in due secondi sai quanto ci sei andato
// vicino. In RadioChat era la funzione che teneva la gente lì.
//
// COME SI MISURA, e perché così:
// non esiste un "punteggio di pronuncia" onesto senza un modello fonetico.
// Quello che possiamo misurare davvero è: la trascrizione di ciò che hai
// detto (Whisper, che BarTalk ha già) quanto somiglia alla frase proposta.
// Se Whisper ti capisce, un madrelingua ti capisce. È una misura indiretta
// ma VERA — e non un numero inventato.
//
// Si confronta parola per parola, non lettera per lettera: sbagliare una
// vocale in mezzo a una frase giusta non deve affossare il punteggio, e
// saltare una parola intera sì.
//
// PURO e testabile: nessuna rete, nessuno stato.
// ═══════════════════════════════════════════════════════════════

/** Toglie punteggiatura, accenti e maiuscole: restano le parole. */
export function normalizza(testo) {
  return String(testo || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Le parole di una frase, già normalizzate. */
export function parole(testo) {
  const n = normalizza(testo);
  return n ? n.split(' ') : [];
}

// ── b.335 — LE ASIATICHE NEL CONFRONTO (Modulo Lingue) ──
// Cinese, giapponese e thai NON hanno spazi: il confronto "per parole"
// vedeva UNA parola sola ed era cieco. Per queste scritture l'unita giusta
// e il CARATTERE (in cinese un carattere = una sillaba = un'unita di
// senso): il confronto diventa carattere-per-carattere, e i badge a
// schermo mostrano i caratteri giusti/sbagliati uno per uno.
const SENZA_SPAZI = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\u0e00-\u0e7f]/; // kana, kanji/hanzi, thai

export function unita(testo, lingua = '') {
  const lang2 = String(lingua || '').replace(/-.*/, '');
  const usaCaratteri = ['zh', 'ja', 'th'].includes(lang2) || SENZA_SPAZI.test(String(testo || ''));
  if (!usaCaratteri) return parole(testo);
  // caratteri: si tengono solo lettere/ideogrammi, niente punteggiatura
  return [...String(testo || '')].filter((c) => /[\p{L}\p{N}]/u.test(c));
}

/** Distanza di edit fra due parole (quanti ritocchi per passare dall'una all'altra). */
export function distanza(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let riga = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prec = riga[0];
    riga[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = riga[j];
      riga[j] = Math.min(
        riga[j] + 1,            // cancellazione
        riga[j - 1] + 1,        // inserimento
        prec + (a[i - 1] === b[j - 1] ? 0 : 1), // sostituzione
      );
      prec = tmp;
    }
  }
  return riga[b.length];
}

/** Due parole si somigliano abbastanza da dire che è la stessa? (0-1) */
export function somiglianza(a, b) {
  const max = Math.max(String(a || '').length, String(b || '').length);
  if (!max) return 1;
  return 1 - distanza(a, b) / max;
}

/**
 * Quanto ci sei andato vicino.
 * @param {string} atteso   la frase proposta dal Maestro
 * @param {string} detto    la trascrizione di ciò che hai detto
 * @returns {{punteggio:number, parole:{parola:string, ok:boolean, vicino:boolean}[]}}
 */
export function valutaPronuncia(atteso, detto, lingua = '') {
  const A = unita(atteso, lingua);
  const D = unita(detto, lingua);
  if (!A.length) return { punteggio: 0, parole: [] };

  const disponibili = [...D];
  const esito = A.map((p) => {
    // Si cerca la parola migliore fra quelle rimaste: così l'ordine può
    // ballare un po' senza far crollare tutto, ma una parola non vale due volte.
    let migliore = -1, punteggioMigliore = 0;
    for (let i = 0; i < disponibili.length; i++) {
      const s = somiglianza(p, disponibili[i]);
      if (s > punteggioMigliore) { punteggioMigliore = s; migliore = i; }
    }
    if (migliore >= 0 && punteggioMigliore >= 0.6) disponibili.splice(migliore, 1);
    return {
      parola: p,
      ok: punteggioMigliore >= 0.85,        // detta bene
      vicino: punteggioMigliore >= 0.6 && punteggioMigliore < 0.85, // ci sei quasi
    };
  });

  const somma = esito.reduce((t, e) => t + (e.ok ? 1 : e.vicino ? 0.5 : 0), 0);
  // Dire molte più parole del necessario non è "aver detto la frase": una
  // piccola penale evita che leggere a caso porti a un punteggio alto.
  const eccesso = Math.max(0, D.length - A.length);
  const penale = Math.min(0.2, eccesso * 0.05);
  const punteggio = Math.max(0, Math.round((somma / A.length - penale) * 100));
  return { punteggio, parole: esito };
}

/** Le parole da riprendere: quelle non dette bene. */
export function paroleDaRivedere(esito) {
  return (esito?.parole || []).filter(p => !p.ok).map(p => p.parola);
}

// ── Il tag con cui il Maestro propone l'esercizio ──
const TAG = /\[PRONUNCIA:\s*([^\]]*?)\s*\]/i;

export const ISTRUZIONE_PRONUNCIA =
`Quando ha senso far provare ad alta voce ciò che hai appena spiegato, proponilo col tag [PRONUNCIA: frase o parola]: si apre un riquadro dove la persona registra la voce e scopre subito com'è andata.
Usalo con misura: una frase per volta, semplice all'inizio e più lunga quando regge. Se è andata male non scoraggiare mai — spezza la frase in pezzi più corti e falla riprovare. Se è andata bene, una parola di riconoscimento e si va avanti: non ripetere lo stesso esercizio.`;

/**
 * Stacca l'esercizio dal testo: il tag non si mostra e non si legge.
 * @returns {{testo:string, esercizio:string|null}}
 */
const TAG_TUTTI = /\[PRONUNCIA:\s*[^\]]*?\s*\]/gi;

export function staccaEsercizio(testo) {
  const s = String(testo || '');
  const m = s.match(TAG);
  if (!m) return { testo: s, esercizio: null };
  // b.317 — DUE difetti trovati dall'audit, entrambi qui.
  // B1: il vecchio `.replace(/\s{2,}/g,' ')` appiattiva TUTTI i doppi a-capo
  // della lezione in spazi: i paragrafi collassavano in uno solo e le
  // diapositive/evidenziazione morivano proprio nei corsi di lingua (dove il
  // tag c'e sempre). Ora si compattano solo spazi e tab: i capoversi restano.
  // B12: il modello a volte propone DUE tag; il vecchio replace toglieva solo
  // il primo e il secondo veniva mostrato e letto ad alta voce. Ora si tolgono
  // tutti; l'esercizio proposto resta il primo.
  const pulito = s.replace(TAG_TUTTI, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { testo: pulito, esercizio: (m[1] || '').trim() || null };
}
