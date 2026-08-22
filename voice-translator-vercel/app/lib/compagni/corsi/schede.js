// ═══════════════════════════════════════════════════════════════
// LE SCHEDE LINGUA — la conoscenza che guida la costruzione dei corsi.
//
// b.378, ordine di Luca: «dobbiamo creare un elenco di definizioni e
// regole da applicare ai diversi paesi, con tabelle, che devono servire
// come KB chiamate dai prompt per guidare nella costruzione dei corsi».
//
// ── PERCHE' UNA SCHEDA E NON UN PROMPT PIU' LUNGO ──────────────
// Un prompt lungo si legge tutto a ogni lezione (si paga), non si puo
// correggere senza toccare il codice, e soprattutto non lo puo scrivere
// un madrelingua: e dentro una stringa in mezzo ad altre istruzioni.
// Una scheda si guarda, si discute, si corregge una riga alla volta — ed
// e l'unico modo per avere regole GIUSTE su cento lingue, perche quelle
// regole le deve dettare chi la lingua la parla.
//
// ── IL DIFETTO CHE CHIUDE ──────────────────────────────────────
// Senza schede il Maestro tratta il giapponese come l'inglese. Nella
// prima lezione di inglese, non avendo nessuna regola su COME SI APRE un
// corso di lingua, ha prodotto ventisei righe di "A significa A". Non
// era il modello a essere scemo: non gli avevamo mai detto cosa fare.
//
// ── QUANTE SCHEDE ──────────────────────────────────────────────
// Tre sono scritte a fondo (inglese, spagnolo, giapponese: due europee e
// una che rompe tutte le regole), le altre hanno la base corretta. Le
// prime tre vanno provate su corsi veri e corrette PRIMA di scriverne
// altre novanta: e li che si scopre quali campi mancano davvero.
// ═══════════════════════════════════════════════════════════════

/**
 * Una scheda dice sette cose. Ogni campo esiste perche cambia QUALCOSA
 * di concreto in come si costruisce la lezione — non per completezza.
 *
 *  scrittura       se serve una fase di lettura prima di parlare
 *  primaDiParlare  cosa va imparato prima di poter dire qualsiasi cosa
 *  confronto       come si misura la pronuncia: per parole o per caratteri
 *  suoniDifficili  cosa inganna chi arriva da una certa lingua di casa
 *  ordineFrase     se la struttura va spiegata subito o puo aspettare
 *  registri        quanto e grave sbagliare livello di cortesia
 *  tavoleExtra     disegni che questa lingua richiede in piu
 *  apertura        come si apre il corso — la prima lezione, in concreto
 */
const SCHEDE = {

  // ── INGLESE ───────────────────────────────────────────────────
  en: {
    nome: 'inglese',
    scrittura: 'alfabeto latino, uguale a quello italiano nelle lettere ma non nei suoni',
    primaDiParlare: null,   // si puo parlare dal primo minuto
    confronto: 'parola',
    suoniDifficili: {
      it: ['il "th" di think e di this: due suoni diversi, e nessuno dei due esiste in italiano',
           'le vocali lunghe e corte: ship e sheep sono due parole',
           'la "h" aspirata a inizio parola, che in italiano e muta',
           'le parole che finiscono in consonante: non si aggiunge la vocale'],
      es: ['la differenza fra b e v, che in spagnolo non c\'e',
           'la "s" a inizio parola senza la "e" davanti: school, non "escuela"',
           'le vocali lunghe e corte'],
      fr: ['la "h" aspirata', 'l\'accento che cade sulla prima sillaba, non sull\'ultima'],
      zh: ['le consonanti in fondo alla parola', 'la differenza fra l e r'],
      ja: ['la differenza fra l e r', 'le consonanti senza vocale dopo'],
    },
    ordineFrase: 'soggetto-verbo-oggetto come in italiano: non serve spiegarlo subito',
    registri: 'poco: si passa dal formale all\'informale con poche parole, non cambia la grammatica',
    tavoleExtra: [],
    apertura: 'NON elencare l\'alfabeto lettera per lettera. Si apre dicendo cosa cambia rispetto alla lingua di casa: quali lettere si scrivono uguale e si dicono diverse, e quali due o tre suoni non esistono affatto. Poi si fanno SENTIRE quei suoni dentro parole vere, non da soli. Cinque minuti, e si e gia dentro una situazione.',
  },

  // ── SPAGNOLO ──────────────────────────────────────────────────
  es: {
    nome: 'spagnolo',
    scrittura: 'alfabeto latino con la ñ; si legge come si scrive, quasi sempre',
    primaDiParlare: null,
    confronto: 'parola',
    suoniDifficili: {
      it: ['la "j" e la "g" davanti a e/i: un suono raschiato che in italiano non c\'e',
           'la doppia "r" arrotolata',
           'la "z" e la "c" davanti a e/i (in Spagna): come il "th" inglese',
           'NON raddoppiare le consonanti: in spagnolo le doppie quasi non esistono'],
      en: ['le cinque vocali sempre uguali, mai ridotte',
           'la "h" che non si pronuncia mai',
           'la "r" arrotolata'],
    },
    ordineFrase: 'come l\'italiano: non serve spiegarlo subito. Il soggetto si omette spesso, e questo si',
    registri: 'medio: tu e usted cambiano il verbo, va detto presto ma senza farne una lezione',
    tavoleExtra: [],
    apertura: 'Si apre dalla somiglianza, che e il vantaggio di chi parla italiano: moltissime parole si capiscono senza studiarle. Poi subito i tre o quattro suoni che tradiscono l\'italiano — la j, la doppia r, le consonanti mai raddoppiate — fatti sentire dentro parole vere. E si avverte dei falsi amici piu comuni, che sono la trappola vera di questa coppia di lingue.',
  },

  // ── GIAPPONESE ────────────────────────────────────────────────
  ja: {
    nome: 'giapponese',
    scrittura: 'tre sistemi insieme: hiragana (46 segni), katakana (46 segni per le parole straniere), kanji (ideogrammi, migliaia)',
    primaDiParlare: 'i 46 hiragana. Senza quelli non si legge niente, e imparare il giapponese in lettere latine e un vicolo cieco: bisogna poi disimparare tutto',
    confronto: 'carattere',
    suoniDifficili: {
      it: ['le vocali lunghe: obasan (zia) e obaasan (nonna) sono due parole',
           'la doppia consonante che e una PAUSA, non un suono piu forte',
           'la "r" giapponese, che sta fra la r e la l italiane',
           'l\'accento e di TONO, non di intensita: non si "batte" sulla sillaba'],
      en: ['ogni consonante porta una vocale dopo', 'le vocali sempre pure'],
    },
    ordineFrase: 'il verbo va SEMPRE in fondo, e la funzione delle parole la danno le particelle. Va spiegato SUBITO: senza, ogni frase sembra al contrario',
    registri: 'molto: sbagliare livello di cortesia e un errore sociale, non grammaticale. Si insegna prima la forma cortese, sempre',
    tavoleExtra: [
      'tavola dei 46 hiragana, a gruppi di cinque, con l\'ordine dei tratti',
      'un disegno per ogni kanji nuovo: il segno grande, l\'ordine dei tratti numerato, e la cosa che rappresenta',
    ],
    apertura: 'Non si apre parlando: si apre LEGGENDO. Prima blocco: i primi dieci hiragana, con l\'ordine dei tratti e una parola vera per ciascuno. Si spiega subito perche ci sono tre scritture e a cosa serve ognuna, se no sembra una crudelta. E si dice subito che il verbo va in fondo — e la chiave che rende leggibile tutto il resto.',
  },

  // ── LE ALTRE CHE INSEGNIAMO ──────────────────────────────────
  fr: {
    nome: 'francese',
    scrittura: 'alfabeto latino con accenti; si scrive molto piu di quanto si pronuncia',
    primaDiParlare: null, confronto: 'parola',
    suoniDifficili: { it: ['le vocali nasali (on, an, in): non esistono in italiano',
                           'la "u" chiusa di tu, diversa dalla u italiana',
                           'la "r" in gola',
                           'le lettere finali che NON si pronunciano'] },
    ordineFrase: 'come l\'italiano; la negazione a due pezzi (ne...pas) va detta presto',
    registri: 'medio: tu e vous cambiano il verbo',
    tavoleExtra: [],
    apertura: 'Si apre dal fatto che sconvolge di piu chi parla italiano: si scrive molto piu di quanto si dice. Si mostrano tre parole scritte e dette, e la differenza si vede da sola. Poi le vocali nasali, fatte sentire in coppia con la vocale semplice.',
  },

  de: {
    nome: 'tedesco',
    scrittura: 'alfabeto latino con ä ö ü ß; si legge come si scrive',
    primaDiParlare: null, confronto: 'parola',
    suoniDifficili: { it: ['la "ch" (due suoni diversi: ich e ach)',
                           'le vocali con l\'umlaut',
                           'la "r" in gola',
                           'le parole composte lunghissime, che si leggono a pezzi'] },
    ordineFrase: 'il verbo in seconda posizione, e in fondo nelle secondarie. Va spiegato SUBITO',
    registri: 'medio: du e Sie',
    tavoleExtra: [],
    apertura: 'Si apre dalla buona notizia — si legge come si scrive — e subito dalla regola che serve per capire qualunque frase: dove va il verbo. Poi i suoni che non ci sono in italiano, dentro parole d\'uso.',
  },

  it: {
    nome: 'italiano',
    scrittura: 'alfabeto latino; si legge come si scrive',
    primaDiParlare: null, confronto: 'parola',
    suoniDifficili: { en: ['le doppie, che cambiano la parola: nono e nonno',
                           'le vocali sempre pure, mai ridotte',
                           'la "gl" e la "gn"',
                           'ogni lettera si pronuncia, anche la e finale'] },
    ordineFrase: 'soggetto-verbo-oggetto, con il soggetto spesso omesso',
    registri: 'medio: tu e Lei',
    tavoleExtra: [],
    apertura: 'Si apre dalle doppie, perche sono la cosa che gli stranieri sbagliano sempre e che cambia il significato. E dalle cinque vocali, che non si riducono mai.',
  },

  pt: {
    nome: 'portoghese',
    scrittura: 'alfabeto latino con accenti e la tilde',
    primaDiParlare: null, confronto: 'parola',
    suoniDifficili: { it: ['le vocali nasali (ão, ãe)', 'le vocali chiuse non accentate, che quasi spariscono',
                           'la differenza fra portoghese europeo e brasiliano, da dichiarare subito'] },
    ordineFrase: 'come l\'italiano', registri: 'medio',
    tavoleExtra: [],
    apertura: 'Si dichiara subito QUALE portoghese si insegna, perche il suono cambia molto. Poi le nasali, che sono il tratto che si sente di piu.',
  },

  zh: {
    nome: 'cinese',
    scrittura: 'ideogrammi: un carattere e una sillaba ed e un\'unita di senso. Il pinyin (lettere latine) e una stampella, non la lingua',
    primaDiParlare: 'i quattro toni. Prima dei toni non si puo dire niente: la stessa sillaba con tono diverso e una parola diversa',
    confronto: 'carattere',
    suoniDifficili: { it: ['i quattro toni, che non sono intonazione ma parte della parola',
                           'la differenza fra q, j, x e i suoni italiani vicini',
                           'la mancanza di consonanti finali'] },
    ordineFrase: 'soggetto-verbo-oggetto, ma il tempo si dice con le parole e non col verbo: i verbi non si coniugano',
    registri: 'poco nella grammatica, molto nelle formule',
    tavoleExtra: ['tavola dei quattro toni disegnati come linee, con la stessa sillaba nei quattro sensi',
                  'un disegno per ogni carattere nuovo: il segno grande, l\'ordine dei tratti, la cosa che rappresenta'],
    apertura: 'Si apre dai TONI, e si aprono facendoli SENTIRE: la stessa sillaba detta nei quattro modi, con i quattro significati. Senza quello, tutto il resto e rumore. La buona notizia arriva subito dopo: i verbi non si coniugano.',
  },

  ar: {
    nome: 'arabo',
    scrittura: 'alfabeto arabo, si scrive da destra a sinistra; le lettere cambiano forma secondo la posizione nella parola',
    primaDiParlare: 'le lettere e il verso di scrittura',
    confronto: 'parola',
    suoniDifficili: { it: ['le consonanti profonde di gola, che in italiano non esistono',
                           'le vocali brevi che spesso non si scrivono',
                           'la differenza fra le consonanti "normali" e quelle enfatiche'] },
    ordineFrase: 'spesso verbo-soggetto-oggetto: va detto subito',
    registri: 'molto: la lingua scritta e quella parlata sono due cose diverse, e va dichiarato quale si insegna',
    tavoleExtra: ['tavola dell\'alfabeto con le quattro forme di ogni lettera (isolata, iniziale, mediana, finale)'],
    apertura: 'Si dichiara subito quale arabo si insegna. Si apre dal verso di scrittura e dal fatto che le lettere cambiano forma: sono le due cose che rendono illeggibile la pagina a chi arriva dall\'alfabeto latino.',
  },

  nl: {
    nome: 'olandese', scrittura: 'alfabeto latino', primaDiParlare: null, confronto: 'parola',
    suoniDifficili: { it: ['la "g" raschiata', 'i dittonghi ui, ij, eu', 'la "r" che cambia da zona a zona'] },
    ordineFrase: 'verbo in seconda posizione, in fondo nelle secondarie: va spiegato subito',
    registri: 'medio', tavoleExtra: [],
    apertura: 'Si apre dalla "g", che e il suono che identifica la lingua e che nessun italiano fa al primo colpo. Poi la posizione del verbo.',
  },

  hi: {
    nome: 'hindi',
    scrittura: 'alfabeto devanagari: le lettere pendono da una linea orizzontale continua',
    primaDiParlare: 'i segni base del devanagari',
    confronto: 'carattere',
    suoniDifficili: { it: ['le consonanti aspirate e non aspirate, che sono lettere diverse',
                           'le retroflesse, con la lingua girata indietro',
                           'le vocali lunghe e brevi'] },
    ordineFrase: 'il verbo va in fondo: va detto subito',
    registri: 'medio-alto: tre livelli di "tu"',
    tavoleExtra: ['tavola del devanagari a gruppi, con l\'ordine dei tratti'],
    apertura: 'Si apre dalla scrittura, con la linea che tiene insieme le lettere. E dalla coppia aspirata/non aspirata, perche per un italiano sono lo stesso suono e invece sono due lettere.',
  },

  tr: {
    nome: 'turco', scrittura: 'alfabeto latino con ç ğ ı ö ş ü; si legge come si scrive', primaDiParlare: null,
    confronto: 'parola',
    suoniDifficili: { it: ['la "ı" senza punto, una vocale che in italiano non c\'e', 'la "ğ" che allunga e non suona'] },
    ordineFrase: 'il verbo va in fondo, e le parole crescono attaccando pezzi in coda. Va spiegato SUBITO: e la chiave di tutto',
    registri: 'medio', tavoleExtra: [],
    apertura: 'Si apre da come si costruisce una parola turca: si parte da una radice e si attaccano pezzi. Mostrata una volta, mezza lingua diventa leggibile.',
  },
};

/** La scheda di una lingua, o null se non c'e ancora. */
export function schedaLingua(codice) {
  const l = String(codice || '').replace(/-.*/, '').toLowerCase();
  return SCHEDE[l] || null;
}

/** Le lingue che hanno una scheda scritta. */
export function lingueConScheda() { return Object.keys(SCHEDE).sort(); }

/**
 * L'istruzione da mettere nel prompt del Maestro. E' il punto in cui la
 * conoscenza della scheda diventa un ordine concreto.
 *
 * @param {string} codice        la lingua che si studia
 * @param {string} linguaDiCasa  la lingua di chi studia (per i suoni difficili)
 * @param {boolean} primaLezione se e la lezione di apertura del corso
 */
export function istruzioniDaScheda(codice, linguaDiCasa = 'it', primaLezione = false) {
  const s = schedaLingua(codice);
  if (!s) return '';
  const righe = [`\n── COME SI INSEGNA ${s.nome.toUpperCase()} ──`];
  righe.push(`Scrittura: ${s.scrittura}.`);
  if (s.primaDiParlare) {
    righe.push(`PRIMA DI POTER PARLARE va imparato: ${s.primaDiParlare}. Non si salta e non si rimanda.`);
  }
  const suoni = s.suoniDifficili?.[String(linguaDiCasa).replace(/-.*/, '')] || s.suoniDifficili?.it || [];
  if (suoni.length) {
    righe.push(`Cosa inganna chi arriva da questa lingua di casa — falli SENTIRE dentro parole vere, mai isolati:\n  · ${suoni.join('\n  · ')}`);
  }
  righe.push(`Ordine della frase: ${s.ordineFrase}.`);
  righe.push(`Livelli di cortesia: ${s.registri}.`);
  if (s.tavoleExtra?.length) {
    righe.push(`Questa lingua richiede tavole in piu:\n  · ${s.tavoleExtra.join('\n  · ')}`);
  }
  if (primaLezione) {
    righe.push(`\nL'APERTURA DEL CORSO (questa e la prima lezione): ${s.apertura}\nVIETATO aprire con un elenco meccanico (l'alfabeto lettera per lettera, i numeri da uno a venti): un elenco non e una lezione, e un indice.`);
  }
  return righe.join('\n');
}
