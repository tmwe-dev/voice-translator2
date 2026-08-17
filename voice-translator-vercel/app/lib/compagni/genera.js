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

// I livelli di libertà del catalogo, così il generatore ne sceglie uno valido.
const LIBERTA_VALIDE = ['strict', 'balanced', 'creative', 'autonomous'];

/**
 * Prompt per generare un Compagno completo da una descrizione o un nome.
 * Ritorna { system, prompt }.
 */
export function promptAgente({ descrizione = '', lingua = 'it', sorpresa = false } = {}) {
  const system =
`Sei un regista di personaggi per un'app di conversazione. Da una richiesta crei il profilo di un "Compagno" AI: un personaggio con una voce e un carattere ben definiti, che parteciperà a chiacchierate, dibattiti e lezioni.

Se ti danno un personaggio reale o storico (es. "Elvis Presley", "Marie Curie"), basa il profilo sulle sue caratteristiche VERE: come parla, come pensa, cosa lo appassiona, il suo temperamento — senza citazioni testuali protette e senza impersonare in modo ingannevole una persona vivente.

RISPONDI SOLO con JSON valido, senza markdown, senza backtick, solo il JSON, con ESATTAMENTE questi campi (contenuti in lingua ${lingua}):
{
  "nome": "il nome del Compagno (max 4 parole)",
  "ruolo": "ruolo/titolo che lo descrive (max 8 parole)",
  "personalita": "come parla, cosa sa, come argomenta, cosa evita — 2-4 frasi, in seconda persona: 'Sei ...'",
  "liberta": "uno tra: strict | balanced | creative | autonomous",
  "genere": "male | female | neutral",
  "barre": { "tono": 0-100 (0=formale,100=informale), "calore": 0-100 (0=distaccato,100=caloroso), "sintesi": 0-100 (0=conciso,100=prolisso), "umorismo": 0-100 (0=serio,100=spiritoso), "assertivita": 0-100 (0=cauto,100=deciso), "creativita": 0-100 (0=preciso,100=creativo) }
}`;

  const richiesta = sorpresa || !descrizione.trim()
    ? 'Inventa un personaggio interessante e originale a sorpresa (mestiere, epoca o temperamento a tua scelta).'
    : `Crea il profilo di: ${descrizione.trim()}`;
  return { system, prompt: richiesta };
}

// ── Estrazione tollerante del JSON dall'output del modello ──
export function estraiAgente(testo) {
  if (!testo) return null;
  let s = String(testo).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const i = s.indexOf('{');
  if (i > 0) s = s.slice(i);
  const j = s.lastIndexOf('}');
  if (j >= 0) s = s.slice(0, j + 1);
  let d;
  try { d = JSON.parse(s); } catch { return null; }
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
