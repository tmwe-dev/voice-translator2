// ═══════════════════════════════════════════════════════════════
// CORSI — generatore (Luca)
//
// Crea syllabus, lezioni e quiz. La SCRITTURA passa dalla cerniera
// (ponte.generaTesto → wallet); le FONTI, per le materie certificate,
// dalla cerniera (ponte.cerca → Topics/Cobra, SSRF-safe). Niente browser
// pesante di Cobra qui dentro: modulo parallelo e leggero.
//
// I costruttori di prompt sono PURI e testabili. I generatori sono sottili
// involucri asincroni attorno al ponte.
// ═══════════════════════════════════════════════════════════════

import { generaTesto, cerca } from '../ponte.js';
import { categoriaCertificata } from './catalogo.js';
import { promptProfilo, profiloEffettivo } from '../profili.js';
import { RESPONSABILITA_MOTIVAZIONALE, RITMO_LEZIONE, bloccoFormeDiProva, contestoStudente, riassuntoProgresso } from './imparare.js';
import { rilevaLinguaStudiata, istruzioniLingua } from './lingua.js';

import { getLang } from '../../constants.js';

// b.214 — la lingua andava al modello come CODICE ("es"), e il modello non
// lo rispettava (un corso "es" tornava in italiano). Ora si passa il NOME
// leggibile: "Spagnolo (Español) [es]". Provato dal vivo.
function nomeLingua(code) {
  const l = getLang(code);
  return l ? `${l.name} [${code}]` : String(code || 'it');
}

// ── Estrazione JSON tollerante dall'output del modello ──
// I modelli a volte avvolgono il JSON in ```json ... ``` o aggiungono una
// riga di cortesia. Si prende il primo array/oggetto ben formato.
export function estraiJSON(testo) {
  if (!testo) return null;
  let s = String(testo).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const primo = s.search(/[[{]/);
  if (primo > 0) s = s.slice(primo);
  try { return JSON.parse(s); } catch { /* riprova a ritagliare */ }
  // Ritaglio fino all'ultima chiusura utile.
  const ultimo = Math.max(s.lastIndexOf(']'), s.lastIndexOf('}'));
  if (ultimo > 0) { try { return JSON.parse(s.slice(0, ultimo + 1)); } catch { /* JSON irrecuperabile: si rinuncia */ } }
  return null;
}

function vestePocente(docente) {
  // b.237 — il profilo DIDATTICO (profili.js): la comprensione viene prima
  // del programma, verifica nei punti chiave, un concetto per volta. Vale
  // anche per il docente generico; per un Compagno scelto conta l'eventuale
  // override del suo Deep Setting sulla superficie 'impara'.
  // b.240 — alla vocazione si aggiunge la responsabilità MOTIVAZIONALE: un
  // maestro non risponde soltanto bene, fa venire voglia di continuare.
  if (!docente) return `Sei un docente esperto, chiaro e incoraggiante.\n${promptProfilo('didattico')}\n${RESPONSABILITA_MOTIVAZIONALE}`;
  const didattica = `\n${promptProfilo(profiloEffettivo(docente, 'impara'))}\n${RESPONSABILITA_MOTIVAZIONALE}`;
  const p = docente.personalita ? `${docente.personalita}\n` : '';
  return `${p}Sei ${docente.nome || 'il docente'} e insegni questo corso con la tua voce.${didattica}`;
}

// b.213 — registro e SICUREZZA per i bambini. Attivo quando il livello è
// 'bambino': parole semplici, tono da compagno di viaggio, e paletti sui
// contenuti inadatti ai minori. La lingua richiesta va rispettata SEMPRE,
// con vocabolario adatto all'età.
function registroBambini(livello, lingua) {
  if (livello !== 'bambino') return '';
  return `
STAI INSEGNANDO A UN BAMBINO. Usa parole semplici e frasi brevi, tono caldo, incoraggiante e giocoso, come un compagno di viaggio. Spiega con esempi concreti e immagini mentali; introduci un termine nuovo solo dopo averlo spiegato con parole facili. VIETATO qualunque contenuto spaventoso, violento, sessuale o comunque inadatto ai minori. Scrivi SOLO in lingua ${nomeLingua(lingua)}, con un vocabolario adatto all'età.`;
}

// ── PROMPT: syllabus (elenco lezioni) ──
export function promptSyllabus({ argomento, livello = 'base', categoria = 'altro', direzione = '', nLezioni = 5, lingua = 'it', docente = null } = {}) {
  const system = `${vestePocente(docente)}
Progetti un percorso di studio strutturato e progressivo. Scrivi in lingua: ${nomeLingua(lingua)}.${registroBambini(livello, lingua)}`;
  const dir = direzione ? ` Taglio richiesto: ${direzione}.` : '';
  const prompt =
`Progetta il syllabus di un corso su "${argomento}" (categoria: ${categoria}, livello: ${livello}).${dir}
Genera ESATTAMENTE ${nLezioni} lezioni, in ordine progressivo.
Rispondi SOLO con JSON valido, un array di oggetti con questa forma:
[{"titolo":"...","obiettivi":["...","..."]}]
Niente testo fuori dal JSON.`;
  return { system, prompt };
}

// ── PROMPT: contenuto di una lezione (fondato sulle fonti, se presenti) ──
export function promptLezione({ argomento, lezione, livello = 'base', lingua = 'it', docente = null, fonti = [], osservazioni = [], progresso = [] } = {}) {
  // b.241 — se si sta imparando una LINGUA, il Maestro cambia mestiere: marca
  // la lingua straniera con [L2:...] (voce madrelingua) e fa parlare la
  // persona invece di spiegarle la grammatica. Ripreso da RadioChat.
  const l2 = rilevaLinguaStudiata(argomento, lezione?.titolo || '');
  const bloccoLingua = (l2 && l2 !== lingua) ? istruzioniLingua({ linguaParlata: lingua, linguaStudiata: l2 }) : '';
  const system = `${vestePocente(docente)}
Scrivi una lezione chiara e ben strutturata. Scrivi in lingua: ${nomeLingua(lingua)}.${registroBambini(livello, lingua)}${bloccoLingua}${contestoStudente(osservazioni)}${riassuntoProgresso(progresso)}`;
  const obiettivi = Array.isArray(lezione?.obiettivi) ? lezione.obiettivi.join('; ') : '';
  const bloccoFonti = (fonti && fonti.length)
    ? `\n\nFONTI da cui attingere (fondaci sopra i fatti, e cita i titoli quando usi un dato):\n${
        fonti.slice(0, 5).map((f, i) => `${i + 1}. ${f.titolo || ''} — ${(f.sintesi || '').slice(0, 300)}`).join('\n')}`
    : '';
  const prompt =
// b.240 — la struttura fissa "introduzione → corpo → punti chiave" produceva
// dispense: corrette e dimenticabili. Ora c'è un RITMO (aggancia, insegna
// poco, fai fare, collega al reale, lascia voglia del passo dopo) che è una
// filosofia narrativa, non uno schema da eseguire alla lettera.
`Corso: "${argomento}" (livello ${livello}). Scrivi la lezione: "${lezione?.titolo || ''}".
Obiettivi: ${obiettivi}.
${RITMO_LEZIONE}
Tono adatto al livello.${bloccoFonti}`;
  return { system, prompt };
}

// ── PROMPT: quiz di verifica ──
// b.231 — il quiz ora è FONDATO sul contenuto reale della lezione (prima
// usava solo il titolo, e poteva chiedere cose mai insegnate).
export function promptQuiz({ lezione, contenuto = '', argomento = '', lingua = 'it', nDomande = 3, livello = '', docente = null, osservazioni = [], progresso = [] } = {}) {
  // b.240 — la sfida la lancia il MAESTRO, non un "valutatore didattico":
  // era la voce sbagliata, e trasformava ogni verifica in un esame.
  const system = `${vestePocente(docente)}\nOra metti alla prova la persona su ciò che le hai appena insegnato. Scrivi in lingua: ${nomeLingua(lingua)}.${registroBambini(livello, lingua)}${contestoStudente(osservazioni)}${riassuntoProgresso(progresso)}`;
  const obiettivi = Array.isArray(lezione?.obiettivi) ? lezione.obiettivi.join('; ') : '';
  const testo = String(contenuto || '').slice(0, 4000);
  const prompt =
`Crea ${nDomande} domande a risposta multipla SOLO su ciò che è stato insegnato nella lezione qui sotto.
CORSO: ${argomento || ''}
LEZIONE: "${lezione?.titolo || ''}"
OBIETTIVI: ${obiettivi}
CONTENUTO DELLA LEZIONE (unica base ammessa per le domande):
"""
${testo || '(contenuto non disponibile: attieniti al titolo e agli obiettivi)'}
"""
REGOLA VINCOLANTE: non chiedere nulla che non sia presente nel contenuto qui sopra. Ogni domanda e la sua risposta corretta devono poter essere ricavate dal testo.
${bloccoFormeDiProva(nDomande)}
Rispondi SOLO con JSON valido:
[{"domanda":"...","opzioni":["a","b","c","d"],"corretta":0,"spiegazione":"..."}]
"corretta" è l'indice (0-3) dell'opzione giusta. Niente testo fuori dal JSON.`;
  return { system, prompt };
}

// ── GENERATORI (usano SOLO la cerniera) ──

/** Genera l'elenco lezioni. Ritorna { ok, lezioni } o { ok:false, motivo }. */
export async function generaSyllabus(opts = {}, { userToken = null } = {}) {
  const { system, prompt } = promptSyllabus(opts);
  const r = await generaTesto({ system, prompt, userToken, maxTokens: 700 });
  if (!r.ok) return { ok: false, motivo: r.motivo, status: r.status };
  const dati = estraiJSON(r.testo);
  if (!Array.isArray(dati) || dati.length === 0) return { ok: false, motivo: 'syllabus-illeggibile' };
  const lezioni = dati
    .filter(l => l && l.titolo)
    .map((l, i) => ({ indice: i, titolo: String(l.titolo).slice(0, 160), obiettivi: Array.isArray(l.obiettivi) ? l.obiettivi.slice(0, 6).map(String) : [], stato: i === 0 ? 'disponibile' : 'bloccata' }));
  return { ok: true, lezioni };
}

/** Genera il contenuto di una lezione; per le materie certificate cerca prima le fonti. */
export async function generaLezione({ argomento, categoria = 'altro', lezione, livello = 'base', lingua = 'it', docente = null, osservazioni = [], progresso = [] } = {}, { userToken = null } = {}) {
  let fonti = [];
  if (categoriaCertificata(categoria)) {
    const query = `${argomento} ${lezione?.titolo || ''}`.trim();
    const trovate = await cerca(query, { lingua, profonda: true, fonti: 4 });
    fonti = (trovate || []).slice(0, 5).map(a => ({ titolo: a.titolo, sintesi: a.sintesi, url: a.url }));
  }
  const { system, prompt } = promptLezione({ argomento, lezione, livello, lingua, docente, fonti, osservazioni, progresso });
  const r = await generaTesto({ system, prompt, userToken, maxTokens: 900 });
  if (!r.ok) return { ok: false, motivo: r.motivo, status: r.status };
  return { ok: true, contenuto: r.testo, fonti };
}

/** Genera il quiz di una lezione. */
export async function generaQuiz(lezione, { lingua = 'it', userToken = null, nDomande = 3, livello = '', contenuto = '', argomento = '', docente = null, osservazioni = [], progresso = [] } = {}) {
  const { system, prompt } = promptQuiz({ lezione, contenuto, argomento, lingua, nDomande, livello, docente, osservazioni, progresso });
  const r = await generaTesto({ system, prompt, userToken, maxTokens: 600 });
  if (!r.ok) return { ok: false, motivo: r.motivo, status: r.status };
  const dati = estraiJSON(r.testo);
  if (!Array.isArray(dati) || dati.length === 0) return { ok: false, motivo: 'quiz-illeggibile' };
  const domande = dati
    .filter(d => d && d.domanda && Array.isArray(d.opzioni))
    .map(d => ({ domanda: String(d.domanda), opzioni: d.opzioni.slice(0, 4).map(String), corretta: Math.max(0, Math.min(3, Number(d.corretta) || 0)), spiegazione: String(d.spiegazione || '') }));
  return { ok: true, domande };
}
