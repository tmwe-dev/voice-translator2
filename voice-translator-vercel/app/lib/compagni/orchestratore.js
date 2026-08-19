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
    stagnation: '\n⚠️ LA CONVERSAZIONE È STAGNANTE. Porta un punto di vista COMPLETAMENTE NUOVO o una direzione inaspettata. Cambia prospettiva, usa un\'analogia diversa, o sfida un presupposto condiviso.',
    agreement: '\nGli agenti stanno convergendo. Approfondisci un aspetto che nessuno ha ancora esplorato, oppure trova una criticità o un\'eccezione alla posizione condivisa.',
    divergence: '\nCi sono opinioni diverse. Cerca un punto di sintesi che integri le prospettive migliori, o proponi un compromesso costruttivo.',
    neutral: '',
  },
  en: {
    stagnation: '\n⚠️ THE CONVERSATION IS STAGNATING. Bring a COMPLETELY NEW perspective or an unexpected direction. Change angle, use a different analogy, or challenge a shared assumption.',
    agreement: '\nThe agents are converging. Dive into an aspect no one explored yet, or find a criticism/exception to the shared position.',
    divergence: '\nThere are different opinions. Seek a synthesis of the best perspectives, or propose a constructive compromise.',
    neutral: '',
  },
};
export function istruzioneConvergenza(stato, lingua = 'it') {
  const m = ISTRUZIONI_CONVERGENZA[lingua] || ISTRUZIONI_CONVERGENZA.en;
  return (m && m[stato]) || '';
}

// ── 2. CHI PARLA: scelta intelligente del prossimo (da buildPlan) ──
// 'smart' = 70% sequenziale, 30% a caso (mai due volte di fila lo stesso).
export function prossimoAParlare(agenti, turno, strategia = 'smart') {
  if (!agenti || agenti.length === 0) return null;
  if (agenti.length === 1) return agenti[0];
  if (strategia === 'random') return agenti[Math.floor(Math.random() * agenti.length)];
  if (strategia === 'smart' && Math.random() < 0.3) {
    const ultimo = turno > 0 ? (turno - 1) % agenti.length : -1;
    const liberi = agenti.filter((_, i) => i !== ultimo);
    return liberi[Math.floor(Math.random() * liberi.length)];
  }
  return agenti[turno % agenti.length]; // round-robin
}

// ── 3. SALTA CHI NON HA NIENTE DA AGGIUNGERE (da shouldSkipAgent) ──
const PAROLE_SKIP = ['concordo','sono d\'accordo','esattamente','hai ragione','agree','exactly','right','absolutely'];
export function puoSaltare(interventi, messaggioUmano = '', turno = 0) {
  if (turno < 4) return false;
  if (String(messaggioUmano).includes('?')) return false;
  const recenti = (interventi || []).slice(-3);
  if (recenti.length < 3) return false;
  const inAccordo = recenti.filter(m => {
    const t = String(m.testo || m.content || '').toLowerCase();
    return PAROLE_SKIP.some(k => t.includes(k));
  }).length;
  return inAccordo >= 2;
}

// ── 4. LE REGOLE DEL DIBATTITO (da DEBATE_FRAMEWORK) ──
const REGOLE_DIBATTITO = {
  it: 'Sei in una conversazione a più voci, in tempo reale, come persone vere. REGOLE:\n• Ascolta gli altri PRIMA di rispondere, e rivolgiti a loro per NOME.\n• Aggiungi VALORE NUOVO — mai ripetere ciò che è già stato detto.\n• Se concordi, approfondisci o estendi il punto dell\'altro.\n• Se dissenti, dillo con chiarezza e argomenti concreti.\n• Parla BREVE e naturale, come al bar, non come in un\'aula.\n• L\'obiettivo è CONVERGERE verso la risposta migliore, insieme.',
  en: 'You are in a multi-voice, real-time conversation, like real people. RULES:\n• Listen to others BEFORE replying, and address them by NAME.\n• Add NEW VALUE — never repeat what was already said.\n• If you agree, deepen or extend the other\'s point.\n• If you disagree, say so clearly with concrete arguments.\n• Speak SHORT and natural, like at a bar, not in a classroom.\n• The goal is to CONVERGE toward the best answer, together.',
};
export function regoleDibattito(lingua = 'it') {
  return REGOLE_DIBATTITO[lingua] || REGOLE_DIBATTITO.en;
}
