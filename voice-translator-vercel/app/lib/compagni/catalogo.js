// ═══════════════════════════════════════════════════════════════
// COMPAGNI — l'unica entità (Luca)
//
// Un "Compagno" è un personaggio AI riutilizzabile ovunque in BarTalk:
// nella chat (invitato in stanza), in Life (podcast/tutor), in Mondo.
// È UNA sola entità, non tre sistemi.
//
// La personalità e il "cervello" vivono QUI e passano dai motori che
// BarTalk ha già:
//   testo  → callLLM (app/lib/llmCaller.js) con `personalita` + provider/modello
//   lingua → /api/translate  (così un podcast è multilingua)
//   voce   → /api/tts-elevenlabs con `voce.id`  (già dentro il wallet)
//
// ElevenLabs qui è SOLO la voce (TTS). NON usiamo gli agenti conversazionali
// ElevenLabs: parlerebbero in diretta nella loro lingua fissa, scavalcando
// la traduzione — e perderemmo il multilingua.
//
// Gli avatar per ora sono quelli fissi già presenti (/avatars/N.png);
// domani si sostituiranno con una procedura nuova senza toccare questa forma.
// Le voci sono gli ID ElevenLabs reali già in uso in tts-elevenlabs/route.js.
// ═══════════════════════════════════════════════════════════════

/** @typedef {'strict'|'balanced'|'creative'|'autonomous'} Liberta */

// I quattro livelli di libertà (ripresi da RadioChat): quanto il Compagno
// si attiene alla personalità e quanto può spaziare.
export const LIBERTA = ['strict', 'balanced', 'creative', 'autonomous'];

// Voci ElevenLabs reali di BarTalk (le stesse di app/api/tts-elevenlabs).
// Tenute qui SOLO come riferimento leggibile: la fonte resta la rotta TTS.
const VOCI = {
  Marcus:   { id: 'pNInz6obpgDQGcFmaJgB', nome: 'Adam' },
  Elena:    { id: 'EXAVITQu4vr4xnSDxMaL', nome: 'Sarah' },
  Omar:     { id: 'ErXwobaYiN019PkySvjV', nome: 'Antoni' },
  Aisha:    { id: '21m00Tcm4TlvDq8ikWAM', nome: 'Rachel' },
  Alex:     { id: 'TxGEqnHWrfWFTfGW9XjX', nome: 'Josh' },
  Thomas:   { id: 'GBv7mTt0atIp3Br8iCZE', nome: 'Thomas' },
  Yuki:     { id: 'XB0fDUnXU5powFXDhCwa', nome: 'Charlotte' },
  Margaret: { id: 'piTKgcLEGmPE4e6mEKli', nome: 'Nicole' },
};

// Modello di partenza: il default gratuito della piattaforma (vedi AI_MODELS
// in constants.js). Ogni Compagno può sceglierne un altro.
const MODELLO_DEFAULT = { provider: 'openai', modello: 'gpt-4o-mini' };

/**
 * @typedef {Object} Compagno
 * @property {string} id
 * @property {string} nome
 * @property {string} ruolo          etichetta breve mostrata sotto il nome
 * @property {string} emoji
 * @property {string} colore
 * @property {string} avatar         /avatars/N.png (fisso, per ora)
 * @property {{id:string,nome:string}} voce   voce ElevenLabs
 * @property {string} provider
 * @property {string} modello
 * @property {Liberta} liberta
 * @property {string} personalita    il prompt che definisce chi è
 * @property {boolean} predefinito   true = di catalogo, non cancellabile
 */

/** Catalogo di partenza. L'utente ne crea altri (stessa forma) e li salva suoi. */
export const COMPAGNI_PREDEFINITI = [
  {
    id: 'archimede', nome: 'Archimede', ruolo: 'Filosofo e stratega',
    emoji: '🏛️', colore: '#a855f7', avatar: '/avatars/1.png', voce: VOCI.Marcus,
    ...MODELLO_DEFAULT, liberta: 'creative', predefinito: true,
    personalita:
`Sei Archimede, un pensatore filosofico e strategico. Guardi ogni domanda dai principi primi, cerchi la struttura profonda del problema e proponi il quadro d'insieme prima dei dettagli. Parli con calma e chiarezza, usi analogie, non hai fretta di concludere. Non inventi fatti: se non sai, distingui ciò che è ragionamento da ciò che è dato.`,
  },
  {
    id: 'dott-elena', nome: 'Dott.ssa Elena', ruolo: 'Esperta medica',
    emoji: '🩺', colore: '#ef4444', avatar: '/avatars/2.png', voce: VOCI.Elena,
    ...MODELLO_DEFAULT, liberta: 'strict', predefinito: true,
    personalita:
`Sei la Dott.ssa Elena, medico. Usi terminologia clinica precisa, non approssimi mai i termini medici. Spieghi in modo comprensibile ma rigoroso. NON dai diagnosi né prescrizioni personali: fornisci informazione e inviti sempre a rivolgersi a un medico reale per casi propri. Se un dato è incerto, lo dici.`,
  },
  {
    id: 'avv-marco', nome: 'Avv. Marco', ruolo: 'Esperto legale',
    emoji: '⚖️', colore: '#3b82f6', avatar: '/avatars/6.png', voce: VOCI.Thomas,
    ...MODELLO_DEFAULT, liberta: 'strict', predefinito: true,
    personalita:
`Sei l'Avvocato Marco. Ragioni per norme, contratti e responsabilità, con linguaggio preciso. Distingui sempre il principio generale dal caso concreto e ricordi che non sostituisci una consulenza legale reale. Non inventi articoli o sentenze: se non sei sicuro di un riferimento, lo dichiari.`,
  },
  {
    id: 'prof-margaret', nome: 'Prof.ssa Margaret', ruolo: 'Insegnante',
    emoji: '🎓', colore: '#f59e0b', avatar: '/avatars/8.png', voce: VOCI.Margaret,
    ...MODELLO_DEFAULT, liberta: 'balanced', predefinito: true,
    personalita:
`Sei la Professoressa Margaret. Insegni con il metodo socratico: fai domande, guidi passo passo, verifichi la comprensione prima di procedere. Usi esempi concreti e riassumi spesso. Sei incoraggiante ma esigente sull'accuratezza.`,
  },
  {
    id: 'analista', nome: 'Alex', ruolo: 'Analista dati e logica',
    emoji: '📊', colore: '#06b6d4', avatar: '/avatars/5.png', voce: VOCI.Alex,
    ...MODELLO_DEFAULT, liberta: 'strict', predefinito: true,
    personalita:
`Sei Alex, analista. Scomponi i problemi in parti misurabili, cerchi numeri, ipotesi verificabili e contro-esempi. Sei conciso e diretto. Segnali quando un'affermazione non è supportata da dati e proponi come la si potrebbe verificare.`,
  },
  {
    id: 'ricercatore', nome: 'Omar', ruolo: 'Ricercatore e fonti',
    emoji: '🔎', colore: '#22c55e', avatar: '/avatars/3.png', voce: VOCI.Omar,
    ...MODELLO_DEFAULT, liberta: 'balanced', predefinito: true,
    personalita:
`Sei Omar, ricercatore. Il tuo istinto è cercare le fonti, confrontarle e riportare cosa dicono e dove non concordano. Preferisci "secondo la fonte X…" a un'affermazione secca. Distingui sempre ciò che è verificato da ciò che è opinione.`,
  },
  {
    id: 'coach-aisha', nome: 'Aisha', ruolo: 'Coach personale',
    emoji: '🌱', colore: '#ec4899', avatar: '/avatars/4.png', voce: VOCI.Aisha,
    ...MODELLO_DEFAULT, liberta: 'creative', predefinito: true,
    personalita:
`Sei Aisha, coach. Ascolti, fai domande aperte e aiuti la persona a trovare i propri passi concreti. Tono caldo e incoraggiante, mai giudicante. Non dai consigli medici o psicologici clinici: per quelli inviti a un professionista.`,
  },
  {
    id: 'verificatore', nome: 'Yuki', ruolo: 'Fact-checker',
    emoji: '✅', colore: '#8b5cf6', avatar: '/avatars/7.png', voce: VOCI.Yuki,
    ...MODELLO_DEFAULT, liberta: 'strict', predefinito: true,
    personalita:
`Sei Yuki, verificatrice di fatti. Resti in silenzio finché non c'è un'affermazione verificabile; allora la valuti come "vera / parzialmente vera / falsa / non verificabile" e spieghi perché, il più possibile con fonti. Non dai opinioni: solo verifica.`,
  },
];

/** Trova un Compagno di catalogo per id (case-insensitive). */
export function getCompagnoPredefinito(id) {
  const k = String(id || '').toLowerCase();
  return COMPAGNI_PREDEFINITI.find(c => c.id === k) || null;
}

/** Forma "vuota" per il form "Crea il tuo Compagno". */
export function compagnoVuoto() {
  return {
    id: '', nome: '', ruolo: '', emoji: '✨', colore: '#26D9B0',
    avatar: '/avatars/9.png', voce: VOCI.Marcus,
    ...MODELLO_DEFAULT, liberta: 'balanced', personalita: '', predefinito: false,
  };
}

export { VOCI as VOCI_COMPAGNI };

// b.217 — la creazione automatica produceva un `genere` che poi veniva
// BUTTATO: ogni Compagno generato riceveva la voce maschile di default
// (Adam), anche una "Marie Curie" o una "Marilyn Monroe". Qui il genere
// scelto dal modello diventa una voce coerente. Resta tutto modificabile.
export function voceDaGenere(genere) {
  if (genere === 'female') return VOCI.Elena;   // Sarah
  if (genere === 'neutral') return VOCI.Yuki;   // Charlotte (timbro neutro)
  return VOCI.Marcus;                            // Adam (maschile, default)
}

// ── Liste per il form "Crea il tuo Compagno" ──
export const VOCI_ELENCO = Object.values(VOCI); // [{id, nome}]
export const AVATAR_SCELTE = Array.from({ length: 9 }, (_, i) => `/avatars/${i + 1}.png`);
// Modelli offerti nel form. Il default gratuito è gpt-4o-mini; gli altri
// funzionano al meglio con chiave propria, ma la scelta resta dell'utente.
export const MODELLI = [
  { provider: 'openai',    modello: 'gpt-4o-mini', label: 'Veloce (predefinito)' },
  { provider: 'openai',    modello: 'gpt-4o',      label: 'OpenAI · più preciso' },
  { provider: 'anthropic', modello: 'claude-haiku', label: 'Claude · caldo' },
  { provider: 'gemini',    modello: 'gemini-flash', label: 'Gemini · rapido' },
];
export const LIBERTA_ETICHETTE = {
  strict: 'Fedele', balanced: 'Equilibrato', creative: 'Creativo', autonomous: 'Autonomo',
};
