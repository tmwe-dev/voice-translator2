// ═══════════════════════════════════════════════════════════════
// GENERA — costruzione automatica di un Compagno da una descrizione (Luca)
//
// Ripreso da RadioChat ("Clona personalità da personaggio storico"):
// l'utente scrive un nome o una descrizione — "Elvis Presley", oppure
// "una nutrizionista sportiva diretta" — e un LLM restituisce il profilo
// completo in JSON. Nessun altro input; poi tutto è modificabile.
//
// Qui NON si chiama l'LLM: si costruisce il prompt (puro, testabile) e si
// estrae il JSON. La chiamata passa dalla cerniera (ponte → wallet).
// ═══════════════════════════════════════════════════════════════

import { getLang } from '../constants.js';

// I livelli di libertà del catalogo, così il generatore ne sceglie uno valido.
const LIBERTA_VALIDE = ['strict', 'balanced', 'creative', 'autonomous'];

// Il modello rispetta la lingua molto meglio col NOME che col codice
// (stessa lezione di b.214 sui corsi). "es" → "Español (España) [es]".
function nomeLingua(code) {
  const l = getLang(code);
  return l ? `${l.name} [${code}]` : String(code || 'it');
}

/**
 * Prompt per generare un Compagno completo da una descrizione o un nome.
 * Ritorna { system, prompt }.
 *
 * b.217 — la creazione era DINAMICA ma GENERICA: "Elvis Presley" tornava un
 * profilo qualunque ("carismatico, ama la musica") invece del RE DEL ROCK con
 * la sua parlata. L'utente vuole una resa realistica e specifica: il modello
 * deve richiamare CHI è davvero la persona e riprodurne la voce autentica —
 * come fa un imitatore, non un ritratto generico. Niente hand-code: tutto sta
 * nel prompt.
 */
export function promptAgente({ descrizione = '', lingua = 'it', sorpresa = false } = {}) {
  const L = nomeLingua(lingua);
  const system =
`Sei un regista di personaggi per un'app di conversazione. Da una richiesta crei il profilo di un "Compagno" AI: un personaggio con una VOCE e un CARATTERE inconfondibili, che parteciperà a chiacchierate, dibattiti e lezioni.

PERSONE REALI, STORICHE O PUBBLICHE (es. "Elvis Presley", "Marie Curie", "Steve Jobs").
Prima di scrivere, RICHIAMA ciò che sai davvero di quella persona: il suo campo, la sua epoca, cosa l'ha resa famosa, il suo temperamento e — soprattutto — il suo MODO DI PARLARE documentato (registro, cadenza, modi di dire tipici, energia, ironia). Poi costruisci il Compagno come un'IMITAZIONE FEDELE di QUELLA persona: deve suonare come LEI, non come una versione generica.
Persone diverse parlano in modo diverso: Elvis Presley è il re del rock'n'roll — caldo, giocoso, galante, informale, showman del Sud degli USA; NON è riflessivo e astratto come uno scienziato. Uno scienziato come Einstein è curioso, preciso, riflessivo. I due NON devono suonare uguali: cattura ciò che rende UNICA questa persona.
È una tribute/imitazione (come fa un comico o un imitatore con un personaggio pubblico): è consentito. Vietato solo: citazioni testuali lunghe e protette, e impersonare in modo ingannevole un privato cittadino vivente facendogli dire cose come se fossero sue reali.
Le BARRE devono riflettere PROPRIO questa persona (Elvis: molto caloroso, informale, spiritoso, deciso; uno scienziato serio: più formale, preciso, riflessivo).

DESCRIZIONI GENERICHE (es. "una nutrizionista sportiva diretta"): inventa un personaggio vivido e distinto, con una voce sua.

RISPONDI SOLO con JSON valido, senza markdown, senza backtick, solo il JSON, con ESATTAMENTE questi campi (contenuti scritti in lingua ${L}):
{
  "nome": "il nome del Compagno (max 4 parole; per una persona reale usa il suo nome)",
  "ruolo": "ruolo/titolo che lo descrive e ne dice l'epoca/campo (max 8 parole)",
  "personalita": "profilo di carattere ricco e strutturato di QUESTA persona (stile RadioChat), in seconda persona ('Sei ...'), 3-5 frasi che coprano: come PARLA (registro/tono e cadenza tipica), cosa SA e come ARGOMENTA, come SUPPORTA/incoraggia chi ha davanti, il suo UMORISMO, 1-2 sue FRASI o intercalari tipici (senza citazioni lunghe protette), e cosa EVITA. Concreto e specifico, non generico.",
  "liberta": "uno tra: strict | balanced | creative | autonomous",
  "genere": "male | female | neutral",
  "barre": { "tono": 0-100 (0=formale,100=informale), "calore": 0-100 (0=distaccato,100=caloroso), "sintesi": 0-100 (0=conciso,100=prolisso), "umorismo": 0-100 (0=serio,100=spiritoso), "assertivita": 0-100 (0=cauto,100=deciso), "creativita": 0-100 (0=preciso,100=creativo) }
}`;

  const richiesta = sorpresa || !descrizione.trim()
    ? 'Inventa un personaggio interessante e originale a sorpresa (mestiere, epoca o temperamento a tua scelta), con una voce sua ben riconoscibile.'
    : `Crea il profilo di: ${descrizione.trim()}\nSe è una persona reale o pubblica, riproduci la SUA voce e il SUO carattere specifici, non un profilo generico.`;
  return { system, prompt: richiesta };
}

/**
 * b.221 — Prompt per l'IMMAGINE dell'avatar (gpt-image-1). Punta a uno stile
 * coerente coi 9 avatar esistenti (illustrazione vettoriale pulita, mezzo busto,
 * sfondo chiaro), col genere giusto e ispirato al personaggio — ma come
 * caricatura illustrata, NON un ritratto fotografico di una persona reale (per
 * evitare rifiuti del modello e questioni di copyright). Lo stile è in inglese
 * perché i modelli immagine lo seguono meglio; nome/ruolo restano come sono.
 */
export function promptAvatar({ nome = '', ruolo = '', genere = 'neutral', descrizione = '' } = {}) {
  const chi = (String(descrizione || '').trim() || `${nome}${ruolo ? ', ' + ruolo : ''}`).trim();
  const sesso = genere === 'female' ? 'female' : genere === 'male' ? 'male' : 'person';
  return [
    'Illustrated avatar portrait, head and shoulders, clean modern flat vector cartoon style,',
    'soft cel shading, smooth lines, fully TRANSPARENT background (no background, cut-out sticker style, alpha),',
    'friendly confident expression, centered composition, matching a set of professional "companion" avatars.',
    `Subject: a ${sesso} — ${chi}.`,
    nome ? `Tasteful illustrated caricature inspired by ${nome} (their era, look and vibe), NOT a photograph and NOT an exact copy of a real person's face.` : '',
    'No text, no watermark, no logo.',
  ].filter(Boolean).join(' ');
}

/**
 * b.229 — Prompt per l'ILLUSTRAZIONE di una lezione (gpt-image-1). Per i
 * bambini: illustrazione da libro, calda e sicura, con un piccolo "compagno di
 * viaggio" che esplora la scena. Sfondo trasparente (si adatta ai temi).
 */
export function promptIllustrazione({ titolo = '', argomento = '', livello = 'base' } = {}) {
  const bimbo = livello === 'bambino';
  return [
    bimbo ? "Children's book illustration, warm, playful, friendly and safe for kids," : 'Clean modern editorial illustration,',
    'flat vector style, soft colors, fully TRANSPARENT background (cut-out sticker, alpha), no text, no watermark.',
    `A scene that illustrates the lesson "${titolo}"${argomento ? ` (topic: ${argomento})` : ''}.`,
    bimbo ? 'Include a friendly little guide character — a travel companion — exploring the scene.' : '',
  ].filter(Boolean).join(' ');
}

// b.308 — RECUPERO di un oggetto JSON TRONCATO (risposta del modello tagliata
// dal tetto di token). Si prova a chiudere l'oggetto dopo l'ultima proprieta
// completa, cercando all'indietro dai punti plausibili di fine-valore. Meglio
// un profilo PARZIALE — i campi mancanti hanno un default in normalizzaAgente —
// che un blocco "Profilo illeggibile". Bounded: l'output agente e piccolo.
function ricuciOggetto(s) {
  const inizio = Math.max(0, s.length - 1200);
  for (let k = s.length; k > inizio; k--) {
    const c = s[k - 1];
    if (c !== '}' && c !== '"' && c !== ']' && !(c >= '0' && c <= '9')) continue;
    for (const suff of ['', '}', '"}', '"]}', ']}', '"}}', '}}', '}]}' ]) {
      try { const o = JSON.parse(s.slice(0, k) + suff); if (o && typeof o === 'object' && !Array.isArray(o)) return o; } catch { /* prova il prossimo taglio */ }
    }
  }
  return null;
}

// ── Estrazione tollerante del JSON dall'output del modello ──
export function estraiAgente(testo) {
  if (!testo) return null;
  let s = String(testo).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const i = s.indexOf('{');
  if (i > 0) s = s.slice(i);
  const j = s.lastIndexOf('}');
  const sChiuso = j >= 0 ? s.slice(0, j + 1) : s;
  let d;
  try { d = JSON.parse(sChiuso); }
  catch { d = ricuciOggetto(s); }   // troncato: si tenta il recupero invece di arrendersi
  if (!d || typeof d !== 'object') return null;
  return normalizzaAgente(d);
}

const clamp = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

/** Ripulisce e completa l'oggetto agente prodotto dall'LLM. */
export function normalizzaAgente(d = {}) {
  const b = d.barre || {};
  return {
    nome: String(d.nome || '').slice(0, 60).trim(),
    ruolo: String(d.ruolo || '').slice(0, 80).trim(),
    personalita: String(d.personalita || '').slice(0, 1200).trim(),
    liberta: LIBERTA_VALIDE.includes(d.liberta) ? d.liberta : 'balanced',
    genere: ['male', 'female', 'neutral'].includes(d.genere) ? d.genere : 'neutral',
    barre: {
      tono: clamp(b.tono ?? 50), calore: clamp(b.calore ?? 60), sintesi: clamp(b.sintesi ?? 40),
      umorismo: clamp(b.umorismo ?? 40), assertivita: clamp(b.assertivita ?? 55), creativita: clamp(b.creativita ?? 50),
    },
  };
}

// ── Comporre la personalità dalle barre (usato quando l'utente le trascina) ──
// Le barre sono un aiuto visivo: qui diventano una riga di indicazioni che si
// ATTACCA alla personalità di base, così il comportamento salvato le riflette.
const ETICHETTE = {
  tono: ['molto formale', 'formale', 'neutro', 'informale', 'molto informale'],
  calore: ['distaccato', 'sobrio', 'neutro', 'caloroso', 'affettuoso'],
  sintesi: ['telegrafico', 'conciso', 'equilibrato', 'disteso', 'prolisso'],
  umorismo: ['serissimo', 'serio', 'a tratti spiritoso', 'spiritoso', 'comico'],
  assertivita: ['cauto', 'prudente', 'equilibrato', 'deciso', 'molto deciso'],
  creativita: ['rigoroso', 'preciso', 'equilibrato', 'creativo', 'molto libero'],
};
function etichetta(chiave, v) {
  const arr = ETICHETTE[chiave]; const i = Math.min(arr.length - 1, Math.floor((clamp(v)) / (100 / arr.length)));
  return arr[i];
}

/** Riga di stile leggibile a partire dalle barre. */
export function rigaBarre(barre = {}) {
  const b = normalizzaAgente({ barre }).barre;
  return `Stile: tono ${etichetta('tono', b.tono)}, ${etichetta('calore', b.calore)}, ${etichetta('sintesi', b.sintesi)}, ${etichetta('umorismo', b.umorismo)}; sei ${etichetta('assertivita', b.assertivita)} e ${etichetta('creativita', b.creativita)}.`;
}

/**
 * Personalità finale = base generata (senza vecchia riga di stile) + riga barre.
 * Idempotente: se richiamata, sostituisce la riga di stile precedente.
 */
export function componiPersonalita(base = '', barre = {}) {
  const pulita = String(base || '').replace(/\n?Stile: tono[^\n]*$/i, '').trim();
  return `${pulita}\n${rigaBarre(barre)}`.trim();
}
