// ═══════════════════════════════════════════════════════════════
// LA SECONDA BARRIERA — b.410, P0.8 dell'audit
//
// Il prompt che estrae i ricordi dice gia la cosa giusta, e la dice
// bene: «NON memorizzare dati sensibili come diagnosi mediche precise,
// farmaci, orientamenti, numeri di documenti, indirizzi o recapiti».
//
// Ma un prompt non e un controllo di sicurezza. E' una richiesta a un
// modello, e un modello non e tenuto a obbedire: basta una risposta
// fuori riga e il dato entra nel database in chiaro, senza che niente
// fra l'estrazione e l'INSERT lo guardi.
//
// Qui c'e cio che guarda. Deterministico, senza AI, senza rete: si
// riconoscono FORME, non significati. Non e un rilevatore di sensibilita
// e non pretende di esserlo — e la rete sotto il trapezio.
//
// DUE LIVELLI, come chiede l'audit:
//   1. si REDIGE cio che e riconoscibile per forma (recapiti, documenti,
//      coordinate bancarie, carte, indirizzi);
//   2. si SCARTA il ricordo intero quando la forma dice «farmaco con
//      dosaggio» — perche li il dettaglio E' il dato sensibile, e
//      redigerlo lascerebbe una frase che finge di dire qualcosa.
//
// LIMITE DICHIARATO, e va detto forte: gli schemi degli indirizzi sono
// italiani ed europei. Un indirizzo scritto in thailandese non viene
// riconosciuto. Questa barriera abbassa il rischio, non lo azzera, e la
// prima difesa resta il prompt. Chi legge questo file non deve poter
// credere che sia una garanzia.
// ═══════════════════════════════════════════════════════════════

const COPERTO = '[omesso]';

// Ogni regola: come si riconosce, e come si chiama nel registro.
// L'ordine conta — le piu specifiche prima, o una generica se le mangia.
const REGOLE = [
  { nome: 'recapito-email', schema: /\b[\w.+-]+@[\w-]+\.[\w.-]{2,}\b/g },
  // IBAN: due lettere, due cifre, poi da 10 a 30 fra lettere e cifre.
  { nome: 'coordinate-bancarie', schema: /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g },
  // Codice fiscale italiano: la forma e inconfondibile.
  { nome: 'codice-fiscale', schema: /\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b/gi },
  // Carte: 13-19 cifre eventualmente spaziate. Il controllo di Luhn evita
  // di coprire numeri lunghi qualunque (un anno, un conteggio).
  // b.410 — i confini sono guardie di CIFRA, non `\b`: fra due cifre `\b`
  // non esiste, quindi la regola si mangiava un pezzo lungo tredici di un
  // numero interno lungo sedici e — trovando per caso un Luhn valido — lo
  // copriva a meta, lasciando «[omesso]6». Trovato da una prova, non a
  // occhio. Una carta non e un pezzo di un altro numero.
  { nome: 'carta', schema: /(?<!\d)(?:\d[ -]?){13,19}(?!\d)/g, seVale: luhn },
  // Documenti: passaporto/patente/carta d'identita seguiti da un codice.
  { nome: 'documento', schema: /\b(?:passaporto|patente|carta d'identit[aà]|documento)\s*(?:n[.°]?\s*)?[A-Z0-9]{5,}\b/gi },
  // Telefono: da 7 cifre in su, con separatori o prefisso internazionale.
  //
  // b.410 — ANCHE QUI le guardie di cifra, ed e questa la regola che
  // produceva «[omesso]6»: non la carta, come sembrava. Senza guardie si
  // prendeva quindici cifre di un numero interno lungo sedici e copriva
  // solo quelle, lasciando l'ultima orfana. Un numero e tutto o niente.
  { nome: 'recapito-telefono', schema: /(?<!\d)(?:\+\d{1,3}[\s.-]?)?(?:\d[\s.-]?){7,14}\d(?!\d)/g, seVale: abbastanzaCifre },
  // Indirizzo: la parola della via, POI UN NOME PROPRIO, poi il civico.
  //
  // b.410 — il nome proprio non e un vezzo, e la correzione di un falso
  // allarme che avevo introdotto io e che una prova ha preso subito: in
  // italiano «corso» e sia una strada sia un corso di inglese, e
  // «Ha finito il corso di inglese nel 2024» finiva coperto come se
  // fosse un indirizzo. Un ricordo mutilato per sbaglio e peggio di un
  // ricordo non filtrato: sparisce senza che nessuno lo sappia.
  // Una via ha un nome che si scrive con la maiuscola; un corso di
  // inglese no.
  { nome: 'indirizzo', schema: /\b(?:[Vv]ia|[Vv]iale|[Pp]iazza|[Pp]iazzale|[Cc]orso|[Vv]icolo|[Ll]argo|[Ss]trada|[Ss]tr\.|[Rr]ue|[Cc]alle|[Ss]tra[sß]e|[Ss]treet|[Aa]venue|[Rr]oad)\s+[A-ZÀ-Þ][A-Za-zÀ-ÿ'’.]*(?:\s+[A-Za-zÀ-ÿ'’.]+){0,3}\s*,?\s*\d{1,4}\b/g },
];

// Le forme che parlano di un FARMACO con la sua dose. Qui non si redige:
// si butta via il ricordo. «La persona assume [omesso] 20 mg» sarebbe una
// frase che finge di non dire, e continuerebbe a dire.
const DOSAGGIO = /\b\d+(?:[.,]\d+)?\s?(?:mg|mcg|µg|ml|cc|g|ui|u\.i\.|mmol|mg\/dl|mg\/ml)\b/i;
// e le parole che, insieme a un dosaggio, dicono che si parla di terapia
const TERAPIA = /\b(?:assum|prend|terapi|farmac|medicin|compress|pastigli|dose|dosaggi|posologi|somministr|prescri|cura con)\w*/i;

function luhn(testo) {
  const cifre = testo.replace(/\D/g, '');
  if (cifre.length < 13 || cifre.length > 19) return false;
  let somma = 0; let doppia = false;
  for (let i = cifre.length - 1; i >= 0; i--) {
    let n = Number(cifre[i]);
    if (doppia) { n *= 2; if (n > 9) n -= 9; }
    somma += n; doppia = !doppia;
  }
  return somma % 10 === 0;
}

function abbastanzaCifre(testo) {
  const cifre = testo.replace(/\D/g, '');
  // meno di sette cifre non e un numero di telefono; piu di quindici
  // nemmeno, ed e quasi sempre un codice che ha gia una sua regola.
  return cifre.length >= 7 && cifre.length <= 15;
}

/**
 * Copre cio che si riconosce per forma.
 * @returns {{testo: string, tolti: string[]}} il testo ripulito e i NOMI
 *          di cio che e stato tolto — mai il contenuto.
 */
export function ripulisci(testo) {
  let fuori = String(testo || '');
  const tolti = [];
  for (const r of REGOLE) {
    fuori = fuori.replace(r.schema, (trovato) => {
      if (r.seVale && !r.seVale(trovato)) return trovato;
      if (!tolti.includes(r.nome)) tolti.push(r.nome);
      return COPERTO;
    });
  }
  return { testo: fuori, tolti };
}

/**
 * Il ricordo si puo salvare? E in che forma?
 * @returns {{ok:true, ricordo, tolti}} oppure {{ok:false, motivo}}
 */
export function minimizza(ricordo) {
  if (!ricordo || !ricordo.content) return { ok: false, motivo: 'vuoto' };
  const intero = `${ricordo.content} ${ricordo.summary || ''}`;

  // LIVELLO 2 — la terapia con la dose non si salva. In caso di dubbio si
  // scarta: un ricordo perso e un fastidio, un farmaco nel database e
  // un'altra cosa.
  if (DOSAGGIO.test(intero) && TERAPIA.test(intero)) {
    return { ok: false, motivo: 'terapia-con-dosaggio' };
  }

  // LIVELLO 1 — si copre cio che ha una forma riconoscibile.
  const c = ripulisci(ricordo.content);
  const s = ripulisci(ricordo.summary || '');
  const tolti = [...new Set([...c.tolti, ...s.tolti])];
  return { ok: true, tolti, ricordo: { ...ricordo, content: c.testo, summary: s.testo } };
}

/**
 * Passa un mazzo di ricordi. Restituisce quelli salvabili e un CONTO di
 * cosa e stato tolto o scartato — per il registro. Mai il contenuto:
 * scrivere nel registro il dato che stavi proteggendo sarebbe comico.
 */
export function minimizzaTutti(ricordi) {
  const buoni = [];
  const conto = {};
  const segna = (k) => { conto[k] = (conto[k] || 0) + 1; };
  for (const r of Array.isArray(ricordi) ? ricordi : []) {
    const esito = minimizza(r);
    if (!esito.ok) { segna(`scartato:${esito.motivo}`); continue; }
    for (const t of esito.tolti) segna(`coperto:${t}`);
    buoni.push(esito.ricordo);
  }
  return { ricordi: buoni, conto };
}
