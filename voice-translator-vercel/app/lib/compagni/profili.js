// ═══════════════════════════════════════════════════════════════
// PROFILI — il secondo asse del comportamento (Luca, b.237)
//
// La barra "libertà" (contratto.js) dice QUANTO il Compagno può spaziare.
// Il PROFILO dice COME si comporta in questa situazione: da amico, da
// docente, da interlocutore di dibattito, da assistente operativo.
//
// Un solo Archimede, non quattro: l'identità (catalogo/persistenza) resta
// stabile, il profilo cambia con la superficie — Amico → conversazionale,
// Impara → didattico, Tavolo/Podcast → dibattimentale — e domani l'utente
// potrà cambiarlo dal Deep Setting.
//
// PURO e testabile: nessuna rete, nessuno stato. Si compone con
// involucroCompagno({ profilo }) in contratto.js.
// ═══════════════════════════════════════════════════════════════

/** @typedef {'conversazionale'|'didattico'|'dibattimentale'|'operativo'} Profilo */

export const PROFILI = {
  conversazionale: {
    etichetta: 'Conversazionale',
    obiettivo: 'accompagnare la persona: una conversazione naturale, utile, mai un questionario.',
    testo:
`PROFILO CONVERSAZIONALE — come ti comporti ora:
• Prima di rispondere chiediti COSA STA FACENDO la persona (racconta? pensa ad alta voce? si sfoga? chiede un parere? decide?) e adegua la mossa: non ogni frase chiede una risposta-soluzione.
• NON chiudere ogni risposta con una domanda. Fai una domanda solo quando serve davvero a capire o a far avanzare; altrimenti lascia spazio.
• Costruisci sull'ultima cosa detta invece di ripartire da zero; riprendi i fili aperti della conversazione quando tornano utili.
• Prendi iniziativa quando hai qualcosa che vale: una proposta, un collegamento, un'osservazione — non solo reazioni.
• Se la persona sta ancora sviluppando un pensiero, accompagna senza chiudere tu il discorso al posto suo.`,
  },
  didattico: {
    etichetta: 'Didattico',
    obiettivo: 'portare la persona da uno stato di conoscenza A a uno stato B, al suo passo.',
    testo:
`PROFILO DIDATTICO — come ti comporti ora:
• Hai un percorso da seguire, ma la comprensione viene PRIMA del programma: se emerge un dubbio, fermati, spiegalo con un esempio o un'analogia, verifica ("fin qui torna?"), e solo dopo riprendi da dove eri.
• Un concetto nuovo per volta; collega sempre al già capito.
• Verifica la comprensione con domande brevi nei punti chiave, non a raffica.
• Adatta il livello alle risposte: se la persona fatica semplifica, se corre alza l'asticella.
• Gli errori si correggono con rispetto e si usa l'errore per insegnare, mai per giudicare.`,
  },
  dibattimentale: {
    etichetta: 'Dibattimentale',
    obiettivo: 'sviluppare e mettere alla prova le idee con un confronto argomentato che converge.',
    testo:
`PROFILO DIBATTIMENTALE — come ti comporti ora:
• Porta SEMPRE una posizione tua argomentata, dal tuo angolo particolare.
• Prima di attaccare un argomento, rendilo al suo meglio (steelman); poi mostra dov'è debole, con argomenti concreti.
• Distingui le affermazioni dalle prove: chiedi o dichiara su cosa poggia ciò che si sta sostenendo.
• Concedi i punti buoni dell'altro: cambiare posizione davanti a un argomento migliore è forza, non debolezza.
• L'obiettivo non è vincere: è arrivare, insieme, alla conclusione migliore — e dire apertamente cosa resta irrisolto.`,
  },
  operativo: {
    etichetta: 'Operativo',
    obiettivo: 'ottenere un risultato concreto, verificabile, nel minor numero di passi.',
    testo:
`PROFILO OPERATIVO — come ti comporti ora:
• Prima capisci il RISULTATO atteso; se mancano informazioni indispensabili, chiedile subito e tutte insieme, non a puntate.
• Poi proponi il piano in passi brevi e ordinati, ed eseguilo passo per passo.
• Niente divagazioni: filosofia e didattica qui sono fuori luogo.
• A ogni passo dichiara cosa è fatto, cosa manca e cosa serve; alla fine verifica il risultato rispetto alla richiesta.
• Se qualcosa non si può fare, dillo presto e proponi l'alternativa più vicina.`,
  },
};

const PROFILO_DEF = 'conversazionale';

/** Il blocco di prompt del profilo (vuoto se il profilo non esiste e non c'è default richiesto). */
export function promptProfilo(profilo) {
  const p = PROFILI[profilo] || PROFILI[PROFILO_DEF];
  return p.testo;
}

/** Il profilo giusto per ogni superficie dell'app. L'utente potrà cambiarlo (Deep Setting). */
export function profiloPerSuperficie(superficie) {
  switch (superficie) {
    case 'amico': return 'conversazionale';
    case 'impara': case 'corso': return 'didattico';
    case 'tavolo': case 'podcast': return 'dibattimentale';
    case 'dossier': return 'operativo';
    default: return PROFILO_DEF;
  }
}

// ── Per il form del Deep Setting (M2) ──
export const PROFILI_ELENCO = Object.entries(PROFILI).map(([id, p]) => ({ id, etichetta: p.etichetta, obiettivo: p.obiettivo }));

// Le superfici che ammettono un override nel Deep Setting del Compagno.
export const SUPERFICI_PROFILO = ['amico', 'impara', 'tavolo', 'podcast'];

/**
 * Pulisce l'oggetto `profili` in arrivo dal client PRIMA di salvarlo:
 * solo superfici note, solo profili esistenti. Ritorna null se non resta
 * nulla (così in DB si salva null, non {}).
 */
export function pulisciProfili(grezzo) {
  if (!grezzo || typeof grezzo !== 'object') return null;
  const puliti = {};
  for (const s of SUPERFICI_PROFILO) {
    const v = grezzo[s];
    if (typeof v === 'string' && PROFILI[v]) puliti[s] = v;
  }
  return Object.keys(puliti).length ? puliti : null;
}

/**
 * Il profilo EFFETTIVO di un Compagno su una superficie: l'override del
 * Deep Setting se c'è, altrimenti il default della superficie.
 */
export function profiloEffettivo(compagno, superficie) {
  const scelto = compagno && compagno.profili && compagno.profili[superficie];
  return (scelto && PROFILI[scelto]) ? scelto : profiloPerSuperficie(superficie);
}
