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
  if (!docente) return 'Sei un docente esperto, chiaro e incoraggiante.';
  const p = docente.personalita ? `${docente.personalita}\n` : '';
  return `${p}Sei ${docente.nome || 'il docente'} e insegni questo corso con la tua voce.`;
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
export function promptLezione({ argomento, lezione, livello = 'base', lingua = 'it', docente = null, fonti = [] } = {}) {
  const system = `${vestePocente(docente)}
Scrivi una lezione chiara e ben strutturata. Scrivi in lingua: ${nomeLingua(lingua)}.${registroBambini(livello, lingua)}`;
  const obiettivi = Array.isArray(lezione?.obiettivi) ? lezione.obiettivi.join('; ') : '';
  const bloccoFonti = (fonti && fonti.length)
    ? `\n\nFONTI da cui attingere (fondaci sopra i fatti, e cita i titoli quando usi un dato):\n${
        fonti.slice(0, 5).map((f, i) => `${i + 1}. ${f.titolo || ''} — ${(f.sintesi || '').slice(0, 300)}`).join('\n')}`
    : '';
  const prompt =
`Corso: "${argomento}" (livello ${livello}). Scrivi la lezione: "${lezione?.titolo || ''}".
Obiettivi: ${obiettivi}.
Struttura: una breve introduzione, il corpo con esempi concreti, e una chiusura con i punti chiave. Tono adatto al livello.${bloccoFonti}`;
  return { system, prompt };
}

// ── PROMPT: quiz di verifica ──
export function promptQuiz({ lezione, lingua = 'it', nDomande = 3, livello = '' } = {}) {
  const system = `Sei un valutatore didattico. Scrivi in lingua: ${nomeLingua(lingua)}.${registroBambini(livello, lingua)}`;
  const prompt =
`Sulla lezione "${lezione?.titolo || ''}", crea ${nDomande} domande a risposta multipla.
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
export async function generaLezione({ argomento, categoria = 'altro', lezione, livello = 'base', lingua = 'it', docente = null } = {}, { userToken = null } = {}) {
  let fonti = [];
  if (categoriaCertificata(categoria)) {
    const query = `${argomento} ${lezione?.titolo || ''}`.trim();
    const trovate = await cerca(query, { lingua, profonda: true, fonti: 4 });
    fonti = (trovate || []).slice(0, 5).map(a => ({ titolo: a.titolo, sintesi: a.sintesi, url: a.url }));
  }
  const { system, prompt } = promptLezione({ argomento, lezione, livello, lingua, docente, fonti });
  const r = await generaTesto({ system, prompt, userToken, maxTokens: 900 });
  if (!r.ok) return { ok: false, motivo: r.motivo, status: r.status };
  return { ok: true, contenuto: r.testo, fonti };
}

/** Genera il quiz di una lezione. */
export async function generaQuiz(lezione, { lingua = 'it', userToken = null, nDomande = 3, livello = '' } = {}) {
  const { system, prompt } = promptQuiz({ lezione, lingua, nDomande, livello });
  const r = await generaTesto({ system, prompt, userToken, maxTokens: 600 });
  if (!r.ok) return { ok: false, motivo: r.motivo, status: r.status };
  const dati = estraiJSON(r.testo);
  if (!Array.isArray(dati) || dati.length === 0) return { ok: false, motivo: 'quiz-illeggibile' };
  const domande = dati
    .filter(d => d && d.domanda && Array.isArray(d.opzioni))
    .map(d => ({ domanda: String(d.domanda), opzioni: d.opzioni.slice(0, 4).map(String), corretta: Math.max(0, Math.min(3, Number(d.corretta) || 0)), spiegazione: String(d.spiegazione || '') }));
  return { ok: true, domande };
}
