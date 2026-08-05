// ═══════════════════════════════════════════════════════════════
// IL VELO — una tendina grigia davanti a cio che e pesante.
//
// NON si cancella niente e non si blocca nessuno. Nelle stanze dove ci
// si puo mandare a quel paese, mandarsi a quel paese e permesso: quello
// che non e permesso e sbatterlo in faccia a chi non ha chiesto di
// leggerlo. Quindi il messaggio resta, coperto, e chi vuole tocca.
//
// COME DECIDE. Un elenco di termini forti in piu lingue, qui sul
// telefono. Non e elegante, ma e istantaneo, non costa niente e —
// soprattutto — funziona anche nelle chat cifrate, dove il server non
// vede nulla e quindi non potrebbe giudicare.
//
// DUE LIMITI, DETTI CHIARAMENTE:
//  · un elenco di parole non capisce il contesto: sbagliera per eccesso
//    su una citazione e per difetto su una cattiveria scritta con garbo
//  · copre le lingue elencate qui sotto, non le altre quaranta
//
// Per questo copre e basta, e non cancella: un errore costa un tocco,
// non un messaggio perduto. Quando servira andare oltre, la strada e un
// giudizio dal server sui messaggi non cifrati — ma va costruita fino
// alla nuvoletta, non lasciata a meta.
// ═══════════════════════════════════════════════════════════════

// I termini piu duri, quelli il cui uso e quasi sempre aggressivo.
// Deliberatamente CORTO: piu si allunga, piu vela cose innocue.
const TERMINI = [
  // italiano
  'vaffanculo', 'vaffanbagno', 'stronzo', 'stronza', 'coglione', 'coglioni',
  'bastardo', 'bastarda', 'puttana', 'troia', 'merda', 'cazzo', 'figa',
  'zoccola', 'infame', 'pezzo di merda', 'testa di cazzo',
  // inglese
  'fuck', 'fucking', 'fucker', 'motherfucker', 'shit', 'bullshit',
  'bitch', 'asshole', 'cunt', 'whore', 'dickhead', 'bastard',
  // spagnolo
  'joder', 'gilipollas', 'cabron', 'cabrón', 'puta', 'mierda', 'coño', 'pendejo',
  // francese
  'putain', 'connard', 'connasse', 'salope', 'enculé', 'encule', 'merde',
  // portoghese
  'caralho', 'foda-se', 'puta que pariu', 'merda', 'filho da puta',
  // tedesco
  'scheisse', 'scheiße', 'arschloch', 'hurensohn', 'fotze',
];

// Le lettere con cui si prova ad aggirare un elenco: fuck -> f*ck, f4ck.
// L'asterisco NON si toglie: in "f*ck" sta AL POSTO di una lettera, e
// cancellandolo resta "fck", che non somiglia piu a niente. Resta li, e
// nel confronto vale come una lettera qualsiasi.
const SOSTITUZIONI = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' };

function appiattisci(testo) {
  return (testo || '')
    .toLowerCase()
    // Accenti via: "cabrón" e "cabron" sono la stessa parola. Il gruppo
    // va scritto in esadecimale, non coi segni veri, che nel file
    // finiscono attaccati alla lettera precedente e rompono l'intervallo.
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[013457@$]/g, c => SOSTITUZIONI[c] ?? c)
    // Le lettere tirate per rabbia: "stroooonzo" -> "stronzo". Si
    // schiacciano solo le ripetizioni da TRE in su, cosi le doppie vere
    // ("merce", "bello") restano intatte e non nascono falsi allarmi.
    .replace(/(.)\1{2,}/g, '$1');
}

/**
 * Decide se un testo va coperto.
 * @returns {{ velare: boolean, motivo: string }}
 */
export function daVelare(testo) {
  if (!testo || typeof testo !== 'string') return { velare: false, motivo: '' };
  const piatto = appiattisci(testo);

  for (const t of TERMINI) {
    // Ogni lettera puo essere mascherata da un asterisco: "f*ck" conta
    // quanto la parola intera. Gli spazi nelle locuzioni restano spazi.
    const corpo = t.split('').map(c => (/[a-z]/.test(c) ? `[${c}*]` : c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('');
    // Confine di parola: "cazzo" si vela, "cazzotto" no, e soprattutto
    // "Scunthorpe" non diventa un caso di censura.
    const bordo = new RegExp(`(^|[^a-z])${corpo}([^a-z]|$)`);
    if (bordo.test(piatto)) return { velare: true, motivo: 'linguaggio pesante' };
  }

  // TUTTO MAIUSCOLO E PUNTI ESCLAMATIVI non e un insulto, ma e urlare.
  const lettere = testo.replace(/[^a-zA-Z]/g, '');
  if (lettere.length >= 15 && lettere === lettere.toUpperCase()
    && (testo.match(/!/g) || []).length >= 3) {
    return { velare: true, motivo: 'sta urlando' };
  }

  return { velare: false, motivo: '' };
}

// Il verdetto del server, quando c'e, vale piu del nostro elenco: ha
// visto il testo con un modello, non con una lista di parole.
export function velare(messaggio) {
  if (!messaggio) return { velare: false, motivo: '' };
  if (messaggio.moderazione?.velare) {
    return { velare: true, motivo: messaggio.moderazione.motivo || 'contenuto pesante' };
  }
  return daVelare(messaggio.original || messaggio.text || '');
}
