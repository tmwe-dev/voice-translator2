// ═══════════════════════════════════════════════════════════════
// MEMORIA — l'amico che ricorda (Luca)
//
// Un Compagno con `memoria` accesa ti riconosce nel tempo. Memoria a
// livelli: RECENTE (sempre nel prompt), CONSOLIDATA (fatti importanti,
// cercati per tag). Dopo ogni scambio, un'estrazione tira fuori i ricordi
// nuovi e li salva.
//
// Il prompt di estrazione e la tassonomia dei tag sono ripresi VERBATIM da
// RadioChat (src/lib/lifeTutor/extraction.ts): stringhe già collaudate,
// riusate invece di reinventarle.
//
// Privacy — dati personali sensibili: RLS server-only, mai in modalità
// Diretta, per-utente e per-Compagno, cancellabili. (Vedi il piano §9.)
// ═══════════════════════════════════════════════════════════════

import { minimizzaTutti } from './minimizza.js';
import { createLogger } from '../logger.js';
import { getSupabaseAdmin } from '../supabase.js';
import { idUtente } from './persistenza.js';
import { generaTesto } from './ponte.js';

const log = createLogger('compagni-memoria');

// b.411 · P1.13 — la misura della finestra «recente», scritta una volta.
// Il piano dice sette giorni: da oggi lo dice anche il codice.
export const GIORNI_RECENTI = 7;

// b.411 · P1.14 — l'ultima lettura e andata bene? Serve a non far dire al
// Compagno «non mi ricordo» quando la verita e «non sono riuscito a
// leggere». Chi costruisce il prompt lo puo chiedere.
let memoriaGuasta = false;
export function memoriaDisponibile() { return !memoriaGuasta; }

export const TAG_MEMORIA = ['famiglia', 'lavoro', 'studio', 'emozione', 'successo', 'difficolta', 'salute', 'hobby', 'relazioni', 'obiettivi', 'evento', 'preferenza', 'opinione', 'aneddoto', 'progresso', 'altro'];

// b.231 — indizi testuali → tag, per RICHIAMARE i ricordi consolidati
// pertinenti al messaggio (prima si passava [] e il richiamo non scattava mai).
const INDIZI_TAG = {
  famiglia: ['famiglia', 'figli', 'figlio', 'figlia', 'moglie', 'marito', 'madre', 'padre', 'genitori', 'fratello', 'sorella'],
  lavoro: ['lavoro', 'ufficio', 'capo', 'collega', 'carriera', 'azienda', 'progetto', 'cliente'],
  studio: ['studio', 'esame', 'università', 'corso', 'scuola', 'imparare', 'lezione', 'lingua'],
  salute: ['salute', 'medico', 'malattia', 'dieta', 'sonno', 'stress', 'ansia', 'palestra', 'correre'],
  hobby: ['hobby', 'musica', 'sport', 'viaggio', 'viaggi', 'cucina', 'lettura', 'gioco'],
  relazioni: ['amico', 'amica', 'relazione', 'partner', 'fidanzat', 'coppia'],
  obiettivi: ['obiettivo', 'obiettivi', 'traguardo', 'voglio', 'sogno', 'meta'],
  emozione: ['sento', 'triste', 'felice', 'arrabbiat', 'paura', 'preoccupat', 'contento'],
  progresso: ['progresso', 'miglior', 'riuscito', 'completato', 'avanzamento'],
};

/** Tag rilevanti dedotti da un messaggio, per il richiamo della memoria. */
export function tagsDalTesto(testo) {
  const t = String(testo || '').toLowerCase();
  const tags = [];
  for (const [tag, indizi] of Object.entries(INDIZI_TAG)) {
    if (indizi.some((k) => t.includes(k))) tags.push(tag);
  }
  return tags;
}

// Ripreso da RadioChat (lifeTutor/extraction.ts) e adattato in b.231 con la
// clausola di DATA-MINIMIZATION (niente dati sensibili automatici).
export const PROMPT_ESTRAZIONE = `Sei un analista di conversazioni per il sistema Life Tutor. Il tuo compito è estrarre INFORMAZIONI SIGNIFICATIVE da questa conversazione.

Per ogni ricordo, fornisci:
- content: il ricordo completo (1-3 frasi)
- summary: riassunto brevissimo (max 80 caratteri)
- tags: array di tag tra: famiglia, lavoro, studio, emozione, successo, difficolta, salute, hobby, relazioni, obiettivi, evento, preferenza, opinione, aneddoto, progresso, altro
- importance: 1-5 (5 = fatto cruciale sulla vita della persona)
- emotion: stato emotivo associato (felice, triste, ansioso, motivato, frustrato, soddisfatto, neutro, eccitato, pensieroso)
- layer: "recent" per fatti recenti, "consolidated" per fatti importanti permanenti

Estrai SOLO fatti personali significativi e utili ad aiutare la persona (obiettivi, sfide, successi, preferenze, progressi, il nome se lo dice). NON estrarre contenuto didattico generico, domande tecniche senza contesto personale, saluti e convenevoli. DATA-MINIMIZATION: NON memorizzare dati sensibili come diagnosi mediche precise, farmaci, orientamenti, numeri di documenti, indirizzi o recapiti, anche se compaiono; al più annota il tema in modo generico (es. "sta seguendo un percorso di salute") senza il dettaglio sensibile.

Rispondi SOLO con JSON valido:
{ "memories": [ { "content": "...", "summary": "...", "tags": ["..."], "importance": 3, "emotion": "neutro", "layer": "recent" } ] }
Se non c'è nulla di significativo, rispondi { "memories": [] }.`;

/** Salva una lista di ricordi (dall'estrazione) per utente+Compagno. */
export async function aggiungiRicordi(email, compagnoId, ricordi) {
  const owner = idUtente(email);
  if (!owner || !compagnoId || !Array.isArray(ricordi) || ricordi.length === 0) return 0;
  const sb = getSupabaseAdmin();
  if (!sb) return 0;
  // b.410 (P0.8) — LA SECONDA BARRIERA, prima del database.
  //
  // Il prompt dell'estrazione chiede gia di non memorizzare diagnosi,
  // farmaci, documenti, indirizzi e recapiti. Ma un prompt e una
  // richiesta a un modello, non un controllo: fra l'estrazione e questo
  // INSERT non c'era niente che guardasse. Ora c'e, e non usa AI —
  // riconosce forme, copre cio che si riconosce, e butta via il ricordo
  // quando la forma dice «farmaco con dosaggio», perche li il dettaglio
  // E' il dato e coprirlo lascerebbe una frase che finge di tacere.
  const setaccio = minimizzaTutti(ricordi);
  const motivi = Object.keys(setaccio.conto);
  if (motivi.length) {
    // Il registro dice QUANTI e DI CHE TIPO, mai cosa: scriverci dentro il
    // dato che stavi proteggendo sarebbe comico.
    log.info('memoria minimizzata', setaccio.conto);
  }
  const righe = setaccio.ricordi
    .filter(m => m && m.content)
    .slice(0, 20)
    .map(m => ({
      owner, compagno_id: compagnoId,
      content: String(m.content).slice(0, 1000),
      summary: (m.summary || '').slice(0, 120),
      tags: Array.isArray(m.tags) ? m.tags.filter(t => TAG_MEMORIA.includes(t)).slice(0, 8) : [],
      importance: Math.max(1, Math.min(5, Number(m.importance) || 3)),
      emotion: (m.emotion || '').slice(0, 24),
      layer: m.layer === 'consolidated' ? 'consolidated' : 'recent',
    }));
  if (righe.length === 0) return 0;
  const { error } = await sb.from('compagno_memorie').insert(righe);
  return error ? 0 : righe.length;
}

/**
 * I ricordi da mettere nel prompt: i più recenti SEMPRE, più i consolidati
 * che combaciano coi tag rilevanti al messaggio. Tetto per non gonfiare.
 */
export async function ricordiPerContesto(email, compagnoId, tagsRilevanti = []) {
  const owner = idUtente(email);
  if (!owner || !compagnoId) return [];
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  // b.411 · P1.13 — LA FINESTRA RECENTE NON ESISTEVA. Il piano dice
  // «RECENTE ~ 7 giorni, CONSOLIDATA separata», ma qui si prendevano le
  // ultime otto righe QUALUNQUE, senza guardare ne il livello ne la data.
  // Conseguenza: i ricordi consolidati — che per disegno sono i piu
  // importanti e i piu vecchi — occupavano gli slot dei recenti, e il
  // Compagno ti parlava di te di sei mesi fa credendo di parlarti di ieri.
  const settimanaFa = new Date(Date.now() - GIORNI_RECENTI * 24 * 60 * 60 * 1000).toISOString();
  const { data: recenti, error: guastoRecenti } = await sb.from('compagno_memorie')
    .select('content, summary, tags, importance, layer')
    .eq('owner', owner).eq('compagno_id', compagnoId)
    .eq('layer', 'recent').gte('created_at', settimanaFa)
    .order('created_at', { ascending: false }).limit(8);
  let consolidati = [];
  let guastoConsolidati = null;
  if (Array.isArray(tagsRilevanti) && tagsRilevanti.length) {
    const { data, error } = await sb.from('compagno_memorie')
      .select('content, summary, tags, importance, layer')
      .eq('owner', owner).eq('compagno_id', compagnoId).eq('layer', 'consolidated')
      .overlaps('tags', tagsRilevanti)
      .order('importance', { ascending: false }).limit(6);
    consolidati = data || [];
    guastoConsolidati = error || null;
  }
  // b.411 · P1.14 — UN DEPOSITO GUASTO NON E' «NESSUN RICORDO». Prima
  // l'errore veniva buttato (`data || []`) e da fuori le due cose erano
  // identiche: un Compagno senza ricordi e un Compagno che non riesce a
  // leggerli. La differenza conta, perche nel secondo caso il Compagno
  // dice «non ricordo» a chi gli ha appena raccontato qualcosa.
  const guasto = guastoRecenti || guastoConsolidati;
  if (guasto) log.warn('memoria non letta', { motivo: guasto.message || 'ignoto' });
  memoriaGuasta = !!guasto;
  // Unione senza duplicati (per content).
  const visti = new Set();
  const uniti = [];
  for (const m of [...(recenti || []), ...consolidati]) {
    if (visti.has(m.content)) continue;
    visti.add(m.content); uniti.push(m);
  }
  return uniti.slice(0, 12);
}

/** Trasforma i ricordi in un blocco da iniettare nel prompt del Compagno. */
export function contestoMemoria(ricordi) {
  if (!ricordi || ricordi.length === 0) return '';
  const righe = ricordi.map(m => `- ${m.summary || m.content}`).join('\n');
  return `\n\nCosa ricordi di questa persona (usalo con naturalezza, non elencarlo):\n${righe}`;
}

/**
 * Estrae i ricordi nuovi da uno scambio, via la cerniera (fatturato).
 * Ritorna un array di ricordi (può essere vuoto). Non lancia: la memoria è
 * un di più, non deve far cadere la risposta.
 */
export async function estraiRicordi(messaggi, { userToken } = {}) {
  const testo = (messaggi || []).slice(-12).map(m => `[${m.ruolo || m.role}]: ${m.testo || m.content}`).join('\n');
  if (!testo.trim()) return [];
  const r = await generaTesto({
    system: PROMPT_ESTRAZIONE,
    prompt: `Analizza questa conversazione ed estrai le informazioni significative:\n\n${testo}`,
    // b.363 — estrarre non e inventare: a temperatura alta il JSON usciva
    // storto (e il catch tornava a mani vuote in silenzio) e i ricordi
    // erano piu romanzati che estratti.
    userToken, maxTokens: 700, temperature: 0.2,
  });
  if (!r.ok) return [];
  try {
    const m = r.testo.match(/\{[\s\S]*\}/);
    if (!m) return [];
    const dati = JSON.parse(m[0]);
    return Array.isArray(dati.memories) ? dati.memories : [];
  } catch { return []; }
}

/**
 * b.411 · P1.16 — CANCELLARE UN COMPAGNO CANCELLAVA SOLO LA SUA SCHEDA.
 *
 * Verificato sul database vivo: fra `compagni` e `compagno_memorie` non
 * esiste NESSUN vincolo, quindi nessuna cascata. I ricordi restavano li
 * per sempre — dati personali senza piu un proprietario raggiungibile,
 * perche sparito il Compagno dalla schermata non c'e piu modo di
 * arrivarci.
 *
 * Non si aggiunge un vincolo nel database, e per un motivo: i Compagni
 * PREDEFINITI non stanno nella tabella `compagni` (vengono dal catalogo),
 * quindi una chiave esterna renderebbe impossibile ricordare qualcosa di
 * loro. Si cancella qui, esplicitamente — la seconda strada che l'audit
 * stesso indica.
 *
 * Ed e la stessa funzione che serve al tasto «Dimentica» (P1.17): il
 * diritto di far dimenticare e la cancellazione del Compagno passano
 * dalla stessa porta, cosi non possono divergere.
 */
export async function dimentica(email, compagnoId) {
  const owner = idUtente(email);
  if (!owner || !compagnoId) return false;
  const sb = getSupabaseAdmin();
  if (!sb) return false;
  const { error } = await sb.from('compagno_memorie').delete().eq('owner', owner).eq('compagno_id', compagnoId);
  return !error;
}
