// ═══════════════════════════════════════════════════════════════
// IMPARARE — la responsabilità del Maestro e le forme della prova
// (Luca, b.240)
//
// Impara oggi produce: syllabus → lezione → quiz a scelta multipla. È una
// mappa e un esame. Manca la cosa per cui uno torna il giorno dopo:
// l'esperienza di imparare — la curiosità, la sfida, la piccola vittoria.
//
// Ma la cura NON è una gamification appiccicata sopra (punti, stelline,
// classifiche) né uno schema di lezione obbligatorio. È dire al Maestro di
// cosa ALTRO si sente responsabile, e dargli un CATALOGO di forme fra cui
// scegliere. Poi sceglie lui, come farebbe un bravo insegnante.
//
// Il pericolo da evitare è il Maestro tifoso, quello che dice "Bravissimo!"
// a ogni risposta: svaluta il riconoscimento e non insegna niente. Un buon
// maestro sa anche dire "hai indovinato, ma non credo che tu abbia capito
// perché".
//
// PURO e testabile: nessuna rete, nessuno stato.
// ═══════════════════════════════════════════════════════════════

// Si aggiunge alla vocazione GUIDA quando si insegna: non sostituisce nulla.
const MAX_OSS = 12;

export const RESPONSABILITA_MOTIVAZIONALE =
`SENTI ANCHE QUESTA RESPONSABILITÀ: alimentare curiosità, fiducia e voglia di continuare.
Non rendere artificialmente facile ciò che è difficile e non lodare a vuoto: un riconoscimento che arriva sempre non vale niente. Riconosci ciò che merita, e quando una risposta è giusta per caso dillo ("hai indovinato, ma non sono sicuro che sia chiaro il perché").
Aiuta la persona a VEDERE il progresso: la distanza fra ciò che non sapeva fare poco fa e ciò che sa fare ora è la motivazione più forte che esista. E lascia sempre una porta aperta sul passo successivo.`;

// Il ritmo di una lezione: una filosofia narrativa, NON uno schema da eseguire.
export const RITMO_LEZIONE =
`RITMO: aggancia con qualcosa che incuriosisce, insegna poco per volta, e fai FARE qualcosa alla persona invece di spiegare fino in fondo. Collega al mondo reale — dove le serve davvero — e chiudi lasciando voglia del passo dopo, non un riassunto.

DOMANDE: NON scrivere nella lezione domande a cui la persona dovrebbe rispondere ("Quale fu la data? A cosa serve? Prova a dire..."). La verifica NON sta nella lezione: c'e un QUIZ interattivo, separato, che arriva dopo. Nella lezione puoi invitare a NOTARE o a OSSERVARE, ma le domande con una risposta giusta lasciale al quiz. La lezione si LEGGE ad alta voce da sola: una domanda dentro il testo verrebbe letta come una domanda retorica a cui nessuno risponde.`;

/**
 * Il catalogo delle forme di verifica. Il Maestro SCEGLIE: non c'è
 * "se lingua allora roleplay". Anche una lingua a volte ha bisogno di una
 * domanda secca, e una materia tecnica di una simulazione.
 */
export const FORME_DI_PROVA = [
  { id: 'ricorda', desc: 'ricordare un fatto o una regola appena vista' },
  { id: 'trova-errore', desc: 'trovare l\'errore in un esempio sbagliato' },
  { id: 'correggi-maestro', desc: 'smentire il Maestro, che dice qualcosa di sbagliato apposta' },
  { id: 'completa', desc: 'completare una frase, un calcolo, un passaggio mancante' },
  { id: 'spiega', desc: 'scegliere la spiegazione giusta, come la darebbe a un altro' },
  { id: 'caso', desc: 'applicare a un caso concreto e nuovo' },
  { id: 'scegli-mossa', desc: 'decidere cosa farebbe in una situazione reale' },
  { id: 'ordina', desc: 'mettere in ordine passaggi o eventi' },
];

/**
 * Il blocco che invita a variare la prova. Resta dentro il formato a scelta
 * multipla che l'interfaccia già mostra: cambia l'ESPERIENZA, non il contratto
 * dei dati — "correggi il Maestro" e "trova l'errore" sono domande a scelta
 * multipla a tutti gli effetti, ma non sembrano un esame.
 */
export function bloccoFormeDiProva(n = 3) {
  const elenco = FORME_DI_PROVA.map(f => `${f.id} (${f.desc})`).join('; ');
  return `VARIA LA FORMA: non fare ${n} domande tutte uguali da interrogazione. Scegli tu, fra queste, quelle adatte a ciò che hai insegnato: ${elenco}.
Ogni domanda resta a scelta multipla, ma deve sembrare una sfida, non un esame: parla alla persona in seconda persona, usa esempi concreti, e quando serve mettici dentro il Maestro ("ho scritto questa frase: cosa non va?").`;
}

/**
 * Cosa il Maestro sa già di questo studente, in parole e non in punteggi.
 * `motivazione = 72%` sarebbe un numero inventato; "fatica coi tempi passati"
 * si può usare davvero.
 * @param {string[]} osservazioni
 */
export function contestoStudente(osservazioni = []) {
  const righe = (osservazioni || []).filter(Boolean).slice(0, 8);
  if (!righe.length) return '';
  return `\n\nCOSA SAI GIÀ DI QUESTA PERSONA (usalo, non elencarlo):\n${righe.map(r => `- ${r}`).join('\n')}`;
}

// ── IL RICORDO DELLO STUDENTE (puro: nessuna rete) ──
// Vive qui e non in studente.js perche i costruttori di prompt lo usano, e
// non devono trascinarsi dietro il client del database.

/** Chiave stabile di un corso a partire dal titolo. */
export function chiaveCorso(argomento) {
  return String(argomento || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'corso';
}


/** Unisce osservazioni vecchie e nuove: niente doppioni, niente crescita infinita. */
export function unisciOsservazioni(attuali = [], nuove = []) {
  const viste = new Set();
  const fuori = [];
  for (const o of [...(nuove || []), ...(attuali || [])]) {
    const t = String(o || '').trim().slice(0, 160);
    const k = t.toLowerCase();
    if (!t || viste.has(k)) continue;
    viste.add(k);
    fuori.push(t);
  }
  return fuori.slice(0, MAX_OSS);
}

/**
 * Il progresso raccontato al Maestro. Non "3/5 lezioni, media 74": una riga
 * che gli dica cosa può DIRE alla persona, e cosa vale la pena ripassare.
 */
export function riassuntoProgresso(righe = []) {
  const fatte = (righe || []).filter(r => r && typeof r.lezione === 'number');
  if (!fatte.length) return '';
  const conVoto = fatte.filter(r => typeof r.punteggio === 'number');
  const ultima = fatte[fatte.length - 1];
  const daRivedere = [];
  for (const r of fatte) for (const d of (r.da_rivedere || [])) if (!daRivedere.includes(d)) daRivedere.push(d);

  const parti = [`Ha già affrontato ${fatte.length} ${fatte.length === 1 ? 'lezione' : 'lezioni'} di questo corso`];
  if (typeof ultima.punteggio === 'number') {
    parti.push(ultima.punteggio >= 80
      ? `e l'ultima prova è andata bene (${ultima.punteggio}%)`
      : ultima.punteggio >= 50
        ? `e l'ultima prova è andata così così (${ultima.punteggio}%)`
        : `e l'ultima prova è andata male (${ultima.punteggio}%)`);
  }
  if (conVoto.length >= 2) {
    const primo = conVoto[0].punteggio, ora = conVoto[conVoto.length - 1].punteggio;
    if (ora - primo >= 15) parti.push(`— ed è MIGLIORATA parecchio da quando ha cominciato (era ${primo}%, ora ${ora}%): faglielo notare, se ne accorga`);
    else if (primo - ora >= 15) parti.push('— ma sta calando: forse il ritmo è troppo veloce o l\'argomento non la prende');
  }
  let s = `\n\nDOVE SIETE ARRIVATI: ${parti.join(' ')}.`;
  if (daRivedere.length) {
    s += `\nCOSE RIMASTE INDIETRO (riprendile quando càpita, dentro qualcos'altro — non come un'interrogazione): ${daRivedere.slice(0, 8).join('; ')}.`;
  }
  return s;
}

// ── L'APPUNTO DEL MAESTRO (ripreso da RadioChat: MAESTRO_META) ──
//
// Finora il ricordo si nutriva solo dei punteggi. Ma il punteggio dice
// QUANTO, non PERCHE': "60%" non aiuta nessuno, "fatica quando la spiegazione
// e astratta" si. Qui il Maestro, dopo aver insegnato, lascia due righe di
// appunti in un blocco invisibile — che si stacca dal testo e finisce nelle
// osservazioni sullo studente.

export const ISTRUZIONE_APPUNTO =
`In fondo, e SOLO se hai notato qualcosa che vale la pena ricordare di questa persona, aggiungi un blocco invisibile in questa forma esatta:
<!--APPUNTO: {"osservazioni":["...","..."]}-->
Una o due frasi brevi, su COME impara (non su quanto e brava): "capisce meglio con esempi concreti", "si perde nelle spiegazioni lunghe", "si appassiona quando c'entra la musica". Niente giudizi, niente voti, niente percentuali. Se non hai notato nulla di utile, ometti del tutto il blocco: e' meglio nessun appunto che un appunto inventato.`;

const TAG_APPUNTO = /<!--APPUNTO:\s*([\s\S]*?)-->/i;

/**
 * Stacca l'appunto dal testo: il blocco non si vede e non si legge mai.
 * Un appunto malformato non rovina la lezione: si butta e basta.
 * @returns {{testo:string, osservazioni:string[]}}
 */
export function staccaAppunto(testo) {
  const s = String(testo || '');
  const m = s.match(TAG_APPUNTO);
  if (!m) return { testo: s.trim(), osservazioni: [] };
  const pulito = s.replace(TAG_APPUNTO, '').trim();
  try {
    const dati = JSON.parse(m[1]);
    const oss = Array.isArray(dati?.osservazioni) ? dati.osservazioni : [];
    return { testo: pulito, osservazioni: oss.filter(o => typeof o === 'string' && o.trim()).slice(0, 3).map(o => o.trim().slice(0, 160)) };
  } catch {
    return { testo: pulito, osservazioni: [] };
  }
}

// ── SUPERAMENTO E SBLOCCO (ripreso da RadioChat: assessmentEngine) ──

/** Sotto questa soglia la lezione si rifa: non e una bocciatura, e un ripasso. */
export const SOGLIA_SUPERAMENTO = 50;

/**
 * La lezione `indice` e aperta? La prima sempre; le altre quando la
 * precedente e stata superata. Chi non ha mai fatto una prova NON viene
 * bloccato: il blocco vale solo se ha provato e non ha superato — altrimenti
 * si sbarrerebbe la strada a chi vuole solo leggere.
 */
export function lezioneSbloccata(progresso = [], indice = 0) {
  if (indice <= 0) return true;
  const prec = (progresso || []).find(r => Number(r?.lezione) === indice - 1);
  if (!prec || typeof prec.punteggio !== 'number') return true;
  return prec.punteggio >= SOGLIA_SUPERAMENTO;
}

/** Come e andata, detto a parole. */
export function esitoInParole(punteggio) {
  if (typeof punteggio !== 'number') return '';
  if (punteggio >= 90) return 'quasi perfetto';
  if (punteggio >= 70) return 'bene';
  if (punteggio >= SOGLIA_SUPERAMENTO) return 'superato';
  return 'da riprendere';
}
