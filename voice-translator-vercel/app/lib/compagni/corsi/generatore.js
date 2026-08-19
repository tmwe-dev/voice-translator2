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
import { RESPONSABILITA_MOTIVAZIONALE, RITMO_LEZIONE, bloccoFormeDiProva, contestoStudente, riassuntoProgresso, ISTRUZIONE_APPUNTO, staccaAppunto } from './imparare.js';
import { rilevaLinguaStudiata, istruzioniLingua } from './lingua.js';

import { getLang } from '../../constants.js';
import { createLogger } from '../../logger.js';

const log = createLogger('compagni-corsi');

// ── INIZIO b.247 — una ricerca GUASTA non deve travestirsi da "nessuna fonte" ──
// `ponte.cerca` ritornava `[]` sia quando non trovava niente sia quando
// esplodeva: qui dentro i due casi diventavano indistinguibili e una lezione
// di medicina poteva nascere senza una sola fonte senza che nessuno lo
// sapesse. Ora l'esito è { ok, risultati, errore } e si legge da qui.
// Si tollera ancora l'ARRAY nudo del vecchio contratto (= ricerca riuscita),
// così la migrazione non rompe chi/che cosa ritorna ancora una lista.
// Una forma SCONOSCIUTA vale guasto: non si può giurare che sia andata bene.
function leggiEsitoRicerca(x) {
  if (Array.isArray(x)) return { ok: true, risultati: x };
  if (x && typeof x === 'object' && typeof x.ok === 'boolean') {
    return { ok: x.ok, risultati: Array.isArray(x.risultati) ? x.risultati : [], errore: x.errore };
  }
  return { ok: false, risultati: [], errore: 'esito-ricerca-sconosciuto' };
}
// ── FINE b.247 ──

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
  if (ultimo > 0) { try { return JSON.parse(s.slice(0, ultimo + 1)); } catch { /* si prova il recupero dell'array troncato */ } }
  // b.306 — RECUPERO DI UN ARRAY TRONCATO. Se la risposta e un array che si e
  // interrotto a meta ("...},{"titolo":"incompl") il ritaglio qui sopra lascia
  // la parentesi quadra aperta e JSON.parse fallisce lo stesso: si perdevano
  // TUTTE le lezioni gia complete. Qui si taglia dopo l'ultimo oggetto chiuso e
  // si richiude l'array, salvando quelle valide.
  if (s[0] === '[') {
    const ultimaGraffa = s.lastIndexOf('}');
    if (ultimaGraffa > 0) {
      try { return JSON.parse(s.slice(0, ultimaGraffa + 1) + ']'); } catch { /* JSON irrecuperabile: si rinuncia */ }
    }
  }
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
export function promptLezione({ argomento, lezione, livello = 'base', lingua = 'it', docente = null, fonti = [], osservazioni = [], progresso = [], fontiNonTrovate = false } = {}) {
  // b.241 — se si sta imparando una LINGUA, il Maestro cambia mestiere: marca
  // la lingua straniera con [L2:...] (voce madrelingua) e fa parlare la
  // persona invece di spiegarle la grammatica. Ripreso da RadioChat.
  const l2 = rilevaLinguaStudiata(argomento, lezione?.titolo || '');
  const bloccoLingua = (l2 && l2 !== lingua) ? istruzioniLingua({ linguaParlata: lingua, linguaStudiata: l2 }) : '';
  // b.301 — PUNTO 5: a livello universitario/ricercatore la lezione ha
  // un'altra stazza. Non piu 900 token di prosa: piu moduli, metodologia,
  // problemi, casi, e — se ci sono fonti — riferimenti espliciti.
  const livelloAlto = livello === 'universitario' || livello === 'ricercatore';
  const profondita = livelloAlto
    ? `\nQUESTO E UN LIVELLO ${livello.toUpperCase()}: vai in profondita. Struttura la lezione in piu passaggi collegati; includi la METODOLOGIA (come si ragiona in questo campo, non solo cosa si sa), almeno un PROBLEMA o CASO concreto da analizzare, e le sfumature/dibattiti aperti. Cita i titoli delle fonti quando usi un dato. Niente semplificazioni da manuale introduttivo.`
    : '';
  const system = `${vestePocente(docente)}
Scrivi una lezione chiara e ben strutturata. Scrivi in lingua: ${nomeLingua(lingua)}.${registroBambini(livello, lingua)}${profondita}${bloccoLingua}${contestoStudente(osservazioni)}${riassuntoProgresso(progresso)}`;
  const obiettivi = Array.isArray(lezione?.obiettivi) ? lezione.obiettivi.join('; ') : '';
  const bloccoFonti = (fonti && fonti.length)
    ? `\n\nFONTI da cui attingere (fondaci sopra i fatti, e cita i titoli quando usi un dato):\n${
        fonti.slice(0, 5).map((f, i) => `${i + 1}. ${f.titolo || ''} — ${(f.sintesi || '').slice(0, 300)}`).join('\n')}`
    : '';
  // b.247 — materia certificata per cui la ricerca è RIUSCITA ma non ha
  // trovato nulla: il silenzio non basta. Prima il blocco FONTI spariva e
  // basta, e il modello scriveva lo stesso citando studi "a memoria" — cioè
  // inventandoli. Ora glielo si dice in faccia: niente fonti, niente citazioni.
  const bloccoSenzaFonti = (!bloccoFonti && fontiNonTrovate)
    ? `\n\nATTENZIONE: la ricerca di fonti per questa materia (che le pretende) NON ha restituito alcun documento. NON hai fonti. Insegna solo ciò che è consolidato, NON citare studi, linee guida, statistiche, dosaggi o riferimenti bibliografici (nemmeno a memoria), e dichiara apertamente quali punti vanno verificati su una fonte autorevole o con un professionista.`
    : '';
  const prompt =
// b.240 — la struttura fissa "introduzione → corpo → punti chiave" produceva
// dispense: corrette e dimenticabili. Ora c'è un RITMO (aggancia, insegna
// poco, fai fare, collega al reale, lascia voglia del passo dopo) che è una
// filosofia narrativa, non uno schema da eseguire alla lettera.
`Corso: "${argomento}" (livello ${livello}). Scrivi la lezione: "${lezione?.titolo || ''}".
Obiettivi: ${obiettivi}.
${RITMO_LEZIONE}
Tono adatto al livello.${bloccoFonti}${bloccoSenzaFonti}

${ISTRUZIONE_APPUNTO}`;
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
  // b.306 — il tetto di 700 token era FISSO, ma b.301 ha portato le lezioni a
  // 12 (universitario) e 14 (ricercatore): il JSON di 12+ lezioni con titoli e
  // obiettivi sfonda i 700 token, esce TRONCATO e illeggibile — "syllabus
  // illeggibile", 502, corso non creato. (Ai livelli bassi, 5-8 lezioni,
  // ci stava: per questo falliva solo in alto.) Ora il tetto segue il numero
  // di lezioni chieste, con un minimo generoso.
  const nLezioni = Math.max(1, Number(opts.nLezioni) || 8);
  const maxTokens = Math.min(2200, 500 + nLezioni * 130);
  const r = await generaTesto({ system, prompt, userToken, maxTokens });
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
  // ── INIZIO b.247 — FAIL-CLOSED sulle materie certificate ──
  // Scelta dichiarata: per una materia che PRETENDE fonti (medicina,
  // psicologia, nutrizione, benessere: `fontiCertificate` in catalogo.js) una
  // ricerca GUASTA non si degrada, si RIFIUTA. Generare lo stesso vorrebbe
  // dire consegnare una lezione che ha l'aria di essere fondata su fonti
  // mentre non lo è: il danno non è la lezione mancante, è la lezione
  // inventata di cui nessuno sospetta. Meglio un errore leggibile.
  // Diverso il caso "ricerca riuscita, zero documenti": lì si genera, ma
  // dicendo al modello che fonti non ce ne sono (vedi promptLezione).
  let fontiNonTrovate = false;
  // b.301 — PUNTO 6: a livello ALTO (universitario, ricercatore) le fonti
  // sono obbligatorie SEMPRE, non solo per medicina/psicologia. A quei
  // livelli una lezione "a memoria" non basta: deve poggiare su documenti.
  const livelloAlto = livello === 'universitario' || livello === 'ricercatore';
  if (categoriaCertificata(categoria) || livelloAlto) {
    const query = `${argomento} ${lezione?.titolo || ''}`.trim();
    const esito = leggiEsitoRicerca(await cerca(query, { lingua, profonda: true, fonti: livelloAlto ? 6 : 4 }));
    if (!esito.ok) {
      // Materia certificata (medicina...): fail-closed, si rifiuta.
      // Livello alto ma materia non certificata: la ricerca guasta non
      // blocca — si genera dicendo al modello che non ha fonti (niente
      // citazioni inventate), come per il caso "zero documenti".
      if (categoriaCertificata(categoria)) {
        log.warn('materia certificata: ricerca fonti guasta, lezione NON generata', {
          categoria, argomento: String(argomento || '').slice(0, 120), errore: esito.errore || 'ignoto',
        });
        return { ok: false, motivo: 'fonti-non-disponibili: ' + (esito.errore || 'ricerca-guasta'), status: 503 };
      }
      fontiNonTrovate = true;
    } else {
      fonti = esito.risultati.slice(0, livelloAlto ? 6 : 5).map(a => ({ titolo: a.titolo, sintesi: a.sintesi, url: a.url }));
      fontiNonTrovate = fonti.length === 0;
    }
  }
  // ── FINE b.247 ──
  const { system, prompt } = promptLezione({ argomento, lezione, livello, lingua, docente, fonti, osservazioni, progresso, fontiNonTrovate });
  // b.301 PUNTO 5: la lezione universitaria/ricercatore ha piu respiro.
  const r = await generaTesto({ system, prompt, userToken, maxTokens: livelloAlto ? 1600 : 900 });
  if (!r.ok) return { ok: false, motivo: r.motivo, status: r.status };
  // b.244 — l'appunto del Maestro si stacca qui: non deve MAI comparire nella
  // lezione. Le osservazioni NUOVE tornano al chiamante, che le salva (il
  // nome è diverso da `osservazioni` in ingresso, che sono quelle già note).
  const { testo, osservazioni: appunto } = staccaAppunto(r.testo);
  // b.247 — `fontiNonTrovate` esce dalla funzione: chi mostra la lezione può
  // dire la verità ("senza fonti") invece di lasciarlo intuire dall'elenco vuoto.
  return { ok: true, contenuto: testo, fonti, osservazioni: appunto, fontiNonTrovate };
}

/** Genera il quiz di una lezione. */
export async function generaQuiz(lezione, { lingua = 'it', userToken = null, nDomande = 3, livello = '', contenuto = '', argomento = '', docente = null, osservazioni = [], progresso = [] } = {}) {
  const { system, prompt } = promptQuiz({ lezione, contenuto, argomento, lingua, nDomande, livello, docente, osservazioni, progresso });
  const r = await generaTesto({ system, prompt, userToken, maxTokens: Math.min(1400, 250 + nDomande * 200) });   // b.301: verifiche piu ricche a livello alto
  if (!r.ok) return { ok: false, motivo: r.motivo, status: r.status };
  const dati = estraiJSON(r.testo);
  if (!Array.isArray(dati) || dati.length === 0) return { ok: false, motivo: 'quiz-illeggibile' };
  const domande = dati
    .filter(d => d && d.domanda && Array.isArray(d.opzioni))
    .map(d => ({ domanda: String(d.domanda), opzioni: d.opzioni.slice(0, 4).map(String), corretta: Math.max(0, Math.min(3, Number(d.corretta) || 0)), spiegazione: String(d.spiegazione || '') }));
  return { ok: true, domande };
}
