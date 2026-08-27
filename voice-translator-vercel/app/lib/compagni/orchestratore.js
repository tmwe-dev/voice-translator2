// ═══════════════════════════════════════════════════════════════
// ORCHESTRATORE — portato da RadioChat (radiochat-clean/src/lib/
// orchestrator.ts + convergence.ts + prompts.ts DEBATE_FRAMEWORK).
//
// Decisione di Luca: NIENTE moderatore artificiale. Si copia il sistema
// di RadioChat, dove gli agenti CONVERGONO da soli, si scelgono chi
// parla, e reagiscono in tempo reale come persone.
//
// Tutto JS puro e testabile: nessuna dipendenza runtime. Chi orchestra
// (podcast.js, tavolo.js) usa queste funzioni; le chiamate al modello e
// il wallet restano dove sono (ponte.js).
// ═══════════════════════════════════════════════════════════════

// ── 1. CONVERGENZA: la conversazione sta stagnando, concordando o
//    divergendo? (da convergence.ts) ──
const PAROLE_ACCORDO = {
  it: ['concordo','esattamente','sono d\'accordo','hai ragione','confermo','condivido','giusto','assolutamente'],
  en: ['agree','exactly','correct','right','indeed','absolutely','precisely','I share'],
  es: ['de acuerdo','exactamente','correcto','coincido','comparto','efectivamente'],
  fr: ['d\'accord','exactement','tout à fait','je confirme','effectivement','je partage'],
  de: ['einverstanden','genau','stimme zu','richtig','absolut','teile die meinung'],
  pt: ['concordo','exatamente','de acordo','correto','compartilho','certamente'],
};
const PAROLE_DISSENSO = {
  it: ['tuttavia','al contrario','non sono d\'accordo','invece','obietto','però','dissento','non credo'],
  en: ['however','disagree','on the contrary','actually','but','rather','I object','not quite','I don\'t think'],
  es: ['sin embargo','al contrario','no estoy de acuerdo','en cambio','pero','disiento','no creo'],
  fr: ['cependant','au contraire','je ne suis pas d\'accord','mais','toutefois','je ne pense pas'],
  de: ['jedoch','im gegenteil','nicht einverstanden','aber','widerspreche','glaube nicht'],
  pt: ['no entanto','ao contrário','discordo','mas','não concordo','não acredito'],
};
const STOP_WORDS = new Set(['il','lo','la','i','gli','le','un','uno','una','di','del','della','a','e','è','che','non','per','con','da','in','su','the','an','is','are','was','be','to','of','and','that','it','for','on','with','as','at','by','this','from','or','but']);

function paroleDi(mappa, lingua) {
  if (lingua && mappa[lingua]) return mappa[lingua];
  return Object.values(mappa).flat();
}
function similarita(a, b) {
  const tok = (s) => new Set(String(s).split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w)));
  const A = tok(a), B = tok(b);
  let comuni = 0;
  for (const w of A) if (B.has(w)) comuni++;
  const tot = Math.max(A.size, B.size);
  return tot === 0 ? 0 : comuni / tot;
}
/** Ritorna 'stagnation' | 'agreement' | 'divergence' | 'neutral'. */
export function analizzaConvergenza(interventi, lingua = 'it') {
  const testi = (interventi || []).slice(-6).map(m => String(m.testo || m.content || '').toLowerCase());
  if (testi.length < 4) return 'neutral';
  // stagnazione: due coppie consecutive troppo simili
  let simili = 0;
  for (let i = 1; i < testi.length; i++) if (similarita(testi[i - 1], testi[i]) > 0.55) simili++;
  if (simili >= 2) return 'stagnation';
  const acc = paroleDi(PAROLE_ACCORDO, lingua);
  const dis = paroleDi(PAROLE_DISSENSO, lingua);
  const conta = (parole) => testi.filter(t => parole.some(w => t.includes(w))).length;
  if (conta(acc) >= 2) return 'agreement';
  if (conta(dis) >= 2) return 'divergence';
  return 'neutral';
}

const ISTRUZIONI_CONVERGENZA = {
  it: {
    stagnation: '\n⚠️ LA CONVERSAZIONE È STAGNANTE. Se hai un angolo nuovo FONDATO, portalo: cambia prospettiva o sfida un presupposto condiviso. Altrimenti dillo apertamente: il tema sembra esaurito — e indica cosa servirebbe per andare avanti (un dato, una precisazione della persona).',
    agreement: '\nGli agenti stanno convergendo. Se vedi una criticità REALE o un\'eccezione vera, dilla; se l\'accordo regge perché è fondato, riconoscilo senza costruire un\'obiezione per non ripeterti.',
    divergence: '\nCi sono opinioni diverse. Cerca un punto di sintesi che integri le prospettive migliori, o proponi un compromesso costruttivo.',
    neutral: '',
  },
  en: {
    stagnation: '\n⚠️ THE CONVERSATION IS STAGNATING. If you have a NEW, GROUNDED angle, bring it: change perspective or challenge a shared assumption. Otherwise say openly the topic seems exhausted — and name what would move it forward (a datum, a clarification).',
    agreement: '\nThe agents are converging. If you see a REAL criticism or true exception, say it; if the agreement holds because it is grounded, acknowledge it rather than inventing an objection.',
    divergence: '\nThere are different opinions. Seek a synthesis of the best perspectives, or propose a constructive compromise.',
    neutral: '',
  },
};
export function istruzioneConvergenza(stato, lingua = 'it') {
  const m = ISTRUZIONI_CONVERGENZA[lingua] || ISTRUZIONI_CONVERGENZA.en;
  return (m && m[stato]) || '';
}

// b.363 — qui vivevano due funzioni che non governavano piu niente:
// la scelta 70/30 di chi parla (mai collegata a nessun turno) e il
// cancello anti-consenso, che decideva per tutti in una volta sola e
// riduceva un tavolo di quattro a una voce. Chi tace ora lo dice da se,
// col canale esito di b.362.

// ── 2. LE REGOLE DEL DIBATTITO (da DEBATE_FRAMEWORK) ──
//
// b.380 — RISCRITTE. Collaudo di Luca sul podcast: «tre turni su quattro
// aprono con un complimento, e in quattro turni non esce un numero».
// Non era il modello: era scritto qui. Le regole dicevano «se concordi,
// approfondisci» e soprattutto «l'obiettivo e CONVERGERE» — cioe
// chiedevano proprio di andare d'accordo. Un dibattito programmato per
// convergere non e un dibattito: e un coro.
//
// E c'era la prova che i numeri esistevano: gli stessi Compagni, davanti
// a "fai il documento", hanno tirato fuori cifre e stime. Il prompt del
// dibattito glieli sopprimeva; quello del documento glieli liberava.
//
// Adesso: vietato aprire dando ragione, ogni turno porta un dato o
// dichiara di non averlo, e restare in disaccordo alla fine e un esito
// legittimo — non un fallimento da evitare per educazione.
const REGOLE_DIBATTITO = {
  it: 'Sei in una conversazione a più voci, in tempo reale, come persone vere. REGOLE:\n• NON aprire mai dando ragione a qualcuno. Niente "hai colto un punto importante", niente complimenti di cortesia: si entra dal merito, prima parola.\n• Ogni intervento porta UNA COSA CONCRETA: un numero, una data, un caso, un esempio preciso. Se quel dato non ce l\'hai, dillo in una riga secca — "su questo non ho il numero" — e passa. Un giro senza un solo dato è un giro sprecato.\n• Rivolgiti agli altri per NOME, e aggancia UNA cosa che hanno detto davvero.\n• Se qualcosa non ti torna, DILLO. Un disaccordo argomentato vale più di tre accordi cortesi: è per quello che siete in più di uno.\n• Mai ripetere ciò che è già stato detto.\n• Parla BREVE e naturale, come al bar, non come in un\'aula.\n• Non si arriva d\'accordo per educazione. Se alla fine le posizioni restano diverse, va benissimo: si dice dove ci si divide e perché.',
  en: 'You are in a multi-voice, real-time conversation, like real people. RULES:\n• NEVER open by agreeing. No "that is an important point", no polite compliments: start from the substance, first word.\n• Every turn brings ONE CONCRETE THING: a number, a date, a case, a precise example. If you do not have that figure, say so in one flat line — "I do not have the number on this" — and move on. A round without a single figure is a wasted round.\n• Address the others by NAME, and hook onto ONE thing they actually said.\n• If something does not add up, SAY SO. One argued disagreement is worth more than three polite agreements: that is why there is more than one of you.\n• Never repeat what was already said.\n• Speak SHORT and natural, like at a bar, not in a classroom.\n• You do not agree out of politeness. If positions stay apart at the end, that is fine: say where you split, and why.',
};
export function regoleDibattito(lingua = 'it') {
  return REGOLE_DIBATTITO[lingua] || REGOLE_DIBATTITO.en;
}

// ── 3. COME LITIGA *QUESTO* COMPAGNO (b.525, da RadioChat) ──
//
// In RadioChat ogni agente ha una `debateRule`: Albert dissente col
// dato, Archimede scavando il perche, Pitagora smontando il
// presupposto. E il motore della differenziazione: quattro persone che
// dissentono in quattro MODI diversi, e ogni scontro ha una forma
// nuova. I Compagni avevano caratteri diversi ma un solo stile di
// conflitto (quello educato): questa riga li divide.
export function bloccoRegolaDibattito(compagno) {
  const r = compagno && compagno.regolaDibattito;
  if (!r) return '';
  return `\nIL TUO MODO DI DISSENTIRE (tuo e di nessun altro): ${r}`;
}

// ── 4. SCRIVERE PER LA VOCE (b.525, da RadioChat buildTTSKnowledgeBase) ──
//
// In RadioChat, quando la voce e accesa, ogni agente riceve le regole
// dello scrivere PARLATO — ed e meta del piacere d'ascolto: i suoi
// agenti scrivono per essere ascoltati, i nostri scrivevano per essere
// letti e poi venivano letti ad alta voce. Versione condensata: gli
// obiettivi, non un dizionario per lingua — il modello la fonetica la
// sa gia.
const KB_VOCE = {
  it: `[VOCE] Il tuo testo verra LETTO AD ALTA VOCE da una voce sintetica. Scrivi come se parlassi a gente presente:
- frasi corte e connesse, mai elenchi puntati, mai markdown, mai emoji;
- numeri in forma parlata («il quindici percento», «due milioni», «dal dieci al venti»);
- sigle sciolte alla prima uscita («l'Organizzazione Mondiale della Sanita»), poi pure la sigla;
- niente simboli (%, &, /, →): sempre la parola;
- punti e virgole come respiri: e un discorso, non una pagina.`,
  en: `[VOICE] Your text will be READ ALOUD by a synthetic voice. Write as if speaking to people in the room:
- short connected sentences, never bullet lists, never markdown, never emoji;
- numbers in spoken form ("fifteen percent", "two million", "ten to twenty");
- expand acronyms on first use, then the acronym alone is fine;
- no symbols (%, &, /): always the word;
- periods and commas are breaths: this is speech, not a page.`,
};
export function kbVoceParlata(lingua = 'it') {
  return KB_VOCE[lingua] || KB_VOCE.en;
}

