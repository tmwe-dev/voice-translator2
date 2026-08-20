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
import { assistentePer } from './assistenti.js';

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

function vesteDocente(docente) {
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
  const system = `${vesteDocente(docente)}
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
// b.321 — Ondata A/B: la DURATA della sessione la decide l'utente (linea di
// Luca: corsi e lezioni LEGGERI di default, ma con i comandi in mano a chi
// studia). breve = micro-sessione 3-5 min; normale = 6-10; approfondita = 10-15.
const ISTRUZIONI_DURATA = {
  breve: '\nDURATA: micro-sessione BREVE (3-5 minuti di ascolto). UN concetto solo, dritto al punto, un esempio. Se il tema e grande, chiudi il pezzo di oggi con naturalezza: il resto verra nella prossima micro-sessione. Breve NON significa superficiale: significa un morso alla volta.',
  normale: '\nDURATA: sessione normale (6-10 minuti di ascolto). Pochi concetti, ben digeriti.',
  approfondita: '\nDURATA: sessione approfondita (10-15 minuti di ascolto): piu esempi, piu sfumature, piu collegamenti.',
};

export function promptLezione({ argomento, lezione, livello = 'base', lingua = 'it', docente = null, fonti = [], osservazioni = [], progresso = [], fontiNonTrovate = false, notaPersona = '', durata = '' } = {}) {
  // b.241 — se si sta imparando una LINGUA, il Maestro cambia mestiere: marca
  // la lingua straniera con [L2:...] (voce madrelingua) e fa parlare la
  // persona invece di spiegarle la grammatica. Ripreso da RadioChat.
  const l2 = rilevaLinguaStudiata(argomento, lezione?.titolo || '');
  // b.323 — nel duetto il Maestro presenta l'Assistente madrelingua per nome.
  const bloccoLingua = (l2 && l2 !== lingua)
    ? istruzioniLingua({ linguaParlata: lingua, linguaStudiata: l2, nomeAssistente: assistentePer(l2).nome })
    : '';
  // b.301 — PUNTO 5: a livello universitario/ricercatore la lezione ha
  // un'altra stazza. Non piu 900 token di prosa: piu moduli, metodologia,
  // problemi, casi, e — se ci sono fonti — riferimenti espliciti.
  const livelloAlto = livello === 'universitario' || livello === 'ricercatore';
  const profondita = livelloAlto
    ? `\nQUESTO E UN LIVELLO ${livello.toUpperCase()}: vai in profondita. Struttura la lezione in piu passaggi collegati; includi la METODOLOGIA (come si ragiona in questo campo, non solo cosa si sa), almeno un PROBLEMA o CASO concreto da analizzare, e le sfumature/dibattiti aperti. Cita i titoli delle fonti quando usi un dato. Niente semplificazioni da manuale introduttivo.`
    : '';
  const bloccoDurata = ISTRUZIONI_DURATA[durata] || '';
  const system = `${vesteDocente(docente)}
Scrivi una lezione chiara e ben strutturata. Scrivi in lingua: ${nomeLingua(lingua)}.${registroBambini(livello, lingua)}${profondita}${bloccoDurata}${notaPersona}${bloccoLingua}${contestoStudente(osservazioni)}${riassuntoProgresso(progresso)}`;
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
  // b.317 — PUNTO DELL'AUDIT: il livello non calibrava la DIFFICOLTÀ delle
  // domande (cambiava solo il numero). Ora ogni livello ha una consegna
  // operativa: base = riconoscere, intermedio = capire, avanzato = applicare
  // a un caso nuovo, universitario = analizzare, ricercatore = valutare.
  const DIFFICOLTA = {
    bambino: 'Domande semplicissime, sul riconoscere le cose appena viste.',
    base: 'Domande sul RICONOSCERE e ricordare i punti chiave.',
    intermedio: 'Domande sul CAPIRE: parafrasi, perché, collegamenti fra due punti della lezione.',
    avanzato: 'Domande che APPLICANO i concetti a un piccolo caso nuovo (ma risolvibile SOLO col contenuto della lezione).',
    universitario: 'Domande che ANALIZZANO: distinguere cause ed effetti, confrontare posizioni presenti nella lezione.',
    ricercatore: 'Domande che VALUTANO: giudicare un’affermazione o un’obiezione alla luce di quanto insegnato.',
  };
  const consegnaDifficolta = DIFFICOLTA[livello] || DIFFICOLTA.base;
  const system = `${vesteDocente(docente)}\nOra metti alla prova la persona su ciò che le hai appena insegnato. Scrivi in lingua: ${nomeLingua(lingua)}.\nDIFFICOLTÀ (livello ${livello || 'base'}): ${consegnaDifficolta}${registroBambini(livello, lingua)}${contestoStudente(osservazioni)}${riassuntoProgresso(progresso)}`;
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
  // b.308 — tetto alzato a 2800: anche un syllabus da 14 lezioni (ricercatore)
  // ci sta dentro con margine, senza riabbattere contro il soffitto.
  const maxTokens = Math.min(2800, 500 + nLezioni * 150);
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
export async function generaLezione({ argomento, categoria = 'altro', lezione, livello = 'base', lingua = 'it', docente = null, osservazioni = [], progresso = [], notaPersona = '', durata = '' } = {}, { userToken = null } = {}) {
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
  const { system, prompt } = promptLezione({ argomento, lezione, livello, lingua, docente, fonti, osservazioni, progresso, fontiNonTrovate, notaPersona, durata });
  // b.301 PUNTO 5: la lezione universitaria/ricercatore ha piu respiro.
  // b.308 — spazio piu generoso: una lezione da documentario non deve
  // uscire tagliata a meta per un tetto stretto. Il costo segue la mole, ma
  // il principio e non bloccare/non mozzare: chi va in profondita ha respiro.
  // b.321 — la micro-sessione breve accorcia anche lo spazio (meno costo,
  // meno attesa); la scelta resta dell'utente.
  const r = await generaTesto({ system, prompt, userToken, maxTokens: durata === 'breve' ? 700 : (livelloAlto ? 2400 : 1200) });
  if (!r.ok) return { ok: false, motivo: r.motivo, status: r.status };
  // b.244 — l'appunto del Maestro si stacca qui: non deve MAI comparire nella
  // lezione. Le osservazioni NUOVE tornano al chiamante, che le salva (il
  // nome è diverso da `osservazioni` in ingresso, che sono quelle già note).
  const { testo, osservazioni: appunto } = staccaAppunto(r.testo);
  // b.247 — `fontiNonTrovate` esce dalla funzione: chi mostra la lezione può
  // dire la verità ("senza fonti") invece di lasciarlo intuire dall'elenco vuoto.
  return { ok: true, contenuto: testo, fonti, osservazioni: appunto, fontiNonTrovate };
}

// b.313 — "ALZO LA MANO E CHIEDO". Durante la lezione lo studente interrompe
// e fa una domanda; il Maestro risponde NEL PERSONAGGIO, ancorato al pezzo che
// stava spiegando, breve e naturale, poi lascia riprendere. Non e una chat a
// parte: e lo stesso docente, che si gira verso di te un momento.
export async function generaRispostaDomanda({ argomento = '', lezione = null, sezione = '', prossime = [], domanda = '', storia = [], modo = 'risposta', livello = 'base', lingua = 'it', docente = null } = {}, { userToken = null } = {}) {
  const persona = vesteDocente(docente);
  const storiaTxt = (Array.isArray(storia) ? storia.slice(-8) : [])
    .map((t) => `[${t.ruolo === 'maestro' ? 'Maestro' : 'Studente'}]: ${String(t.testo || '').slice(0, 500)}`).join('\n');
  const pezzo = `"""${String(sezione || '').slice(0, 1400)}"""`;

  // b.314/b.315 — RIENTRO: lo studente ha finito. Il Maestro torna alla
  // lezione con UNA frase cortese. Ma prima GUARDA cosa viene dopo: se la
  // chiacchierata ha gia coperto la sezione (o due) successive, lo dice ("di
  // questo abbiamo gia parlato, proseguiamo") e propone di SALTARLE — come un
  // professore vero. Ritorna anche `salta` = quante sezioni successive omettere.
  if (modo === 'ripresa') {
    const prox = (Array.isArray(prossime) ? prossime.slice(0, 2) : [])
      .map((p, k) => `[SEZIONE SUCCESSIVA ${k + 1}]: ${String(p || '').slice(0, 700)}`).join('\n');
    const system = `${persona}
Lo studente ha finito le domande e si RIPRENDE la lezione. Parla nella lingua: ${nomeLingua(lingua)}, a voce (niente tag).
Guarda le SEZIONI SUCCESSIVE: se quello che vi siete gia detti nella conversazione COPRE gia una o entrambe, comportati da professore — dillo con garbo ("di questo abbiamo gia parlato, proseguiamo") e proponi di saltarle. Altrimenti riprendi normalmente ("Se non vi dispiace, riprendiamo...").
Rispondi SOLO con JSON: {"salta": N, "frase": "..."} dove N e' quante sezioni successive saltare (0, 1 o 2) perche gia trattate, e "frase" e' la battuta cortese di ripresa (una o due frasi).${registroBambini(livello, lingua)}`;
    const prompt = `Eravate a questo punto:\n${pezzo}\n${prox ? `\n${prox}\n` : ''}${storiaTxt ? `\nVi siete detti:\n${storiaTxt}\n` : ''}\nDecidi salta e frase.`;
    const r = await generaTesto({ system, prompt, userToken, maxTokens: 260, temperature: 0.5 });
    if (!r.ok) return { ok: false, motivo: r.motivo, status: r.status };
    const d = estraiJSON(r.testo);
    if (d && typeof d === 'object' && !Array.isArray(d)) {
      const salta = Math.max(0, Math.min(2, Number(d.salta) || 0));
      return { ok: true, risposta: String(d.frase || '').trim() || staccaAppunto(r.testo).testo, salta };
    }
    return { ok: true, risposta: staccaAppunto(r.testo).testo, salta: 0 };
  }

  if (!domanda || !domanda.trim()) return { ok: false, motivo: 'domanda-mancante' };
  // b.314 — un Maestro VERO non risponde e scappa: risponde, poi si ACCERTA
  // che sia chiaro e CHIEDE se vuoi un altro dettaglio o hai altre curiosita,
  // lasciando a te decidere quando riprendere. Niente auto-rientro qui.
  // b.315 — e VIVE la lezione con te: puo divagare un poco, tenendo pero la
  // lezione come bussola.
  const system = `${persona}
Stai tenendo una lezione e lo studente ha ALZATO LA MANO. Rispondi come il docente che sei: naturale, caldo, BREVE, nella lingua: ${nomeLingua(lingua)}. Dai il dettaglio utile; puoi divagare un poco ma tieni la lezione come bussola; niente elenchi, niente titoli, non rifare la lezione. Il testo si legge ad alta voce: nessun tag.
NON tornare da solo alla lezione. Alla fine ACCERTATI che sia chiaro e CHIEDI, con una domanda breve, se vuole un altro dettaglio o ha altre curiosita — sta a lui decidere se riprendere.${registroBambini(livello, lingua)}`;
  const prompt = `LEZIONE: "${lezione?.titolo || argomento}".
Stavi spiegando questo pezzo:\n${pezzo}
${storiaTxt ? `\nFin qui vi siete detti:\n${storiaTxt}\n` : ''}
Lo studente ora dice: "${domanda.trim().slice(0, 400)}"

Rispondi tu, a voce, come faresti in aula.`;
  const r = await generaTesto({ system, prompt, userToken, maxTokens: 600, temperature: 0.7 });
  if (!r.ok) return { ok: false, motivo: r.motivo, status: r.status };
  return { ok: true, risposta: staccaAppunto(r.testo).testo };
}

/** Genera il quiz di una lezione. */
export async function generaQuiz(lezione, { lingua = 'it', userToken = null, nDomande = 3, livello = '', contenuto = '', argomento = '', docente = null, osservazioni = [], progresso = [] } = {}) {
  const { system, prompt } = promptQuiz({ lezione, contenuto, argomento, lingua, nDomande, livello, docente, osservazioni, progresso });
  const r = await generaTesto({ system, prompt, userToken, maxTokens: Math.min(2200, 400 + nDomande * 260) });   // b.308: tetto piu alto, il quiz a 6 domande non si tronca piu
  if (!r.ok) return { ok: false, motivo: r.motivo, status: r.status };
  const dati = estraiJSON(r.testo);
  if (!Array.isArray(dati) || dati.length === 0) return { ok: false, motivo: 'quiz-illeggibile' };
  const domande = dati
    .filter(d => d && d.domanda && Array.isArray(d.opzioni))
    .map(d => {
      const opzioni = d.opzioni.slice(0, 4).map(String);
      // b.317 — B7 dell'audit: l'indice della risposta era limitato a 0-3 ma
      // NON al numero reale di opzioni: con 3 opzioni e corretta=3 la domanda
      // diventava IMPOSSIBILE (nessuna opzione giusta). Ora l'indice e sempre
      // dentro l'elenco.
      const corretta = Math.max(0, Math.min(opzioni.length - 1, Number(d.corretta) || 0));
      return { domanda: String(d.domanda), opzioni, corretta, spiegazione: String(d.spiegazione || '') };
    });
  return { ok: true, domande };
}
