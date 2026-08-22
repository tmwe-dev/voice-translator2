// ═══════════════════════════════════════════════════════════════
// LE PERSONE CHE NON VOGLIO PIU' VEDERE.
//
// b.383. Nell'audit dei contenuti era emerso che si puo SEGNALARE una
// discussione o un commento, ma non esisteva un modo di dire «questa
// persona non me la far piu vedere». Su una piattaforma costruita sulla
// preferenza personale era il pezzo piu ovvio che mancava.
//
// PERCHE' STA NELLE PREFERENZE E NON SUL SERVER. Segnalare e un atto
// PUBBLICO: dice a noi che qualcosa non va, e riguarda tutti. Bloccare e
// un atto PRIVATO: riguarda solo i miei occhi, e non deve diventare un
// giudizio su quella persona ne un dato che la segue in giro. E' la
// stessa riga di confine di tutto il resto: puoi decidere cosa entra nei
// tuoi occhi, non cosa entra in quelli di un altro.
//
// Conseguenza pratica: chi blocchi non lo sa, e non gli succede niente.
// Semplicemente, per te sparisce.
// ═══════════════════════════════════════════════════════════════

/** L'elenco delle persone bloccate da questa persona. */
export function bloccati(prefs) {
  const v = prefs?.personeBloccate;
  return Array.isArray(v) ? v : [];
}

/** Vero se questa persona e bloccata. */
export function eBloccato(prefs, publicId) {
  if (!publicId) return false;
  return bloccati(prefs).includes(publicId);
}

/**
 * Blocca o sblocca. Restituisce le preferenze nuove: chi chiama decide
 * se salvarle — come si fa gia per gli interessi.
 */
export function cambiaBlocco(prefs, publicId) {
  if (!publicId) return prefs;
  const ora = bloccati(prefs);
  const nuovi = ora.includes(publicId)
    ? ora.filter((x) => x !== publicId)
    : [...ora, publicId].slice(-500);   // un tetto: non e un archivio
  return { ...prefs, personeBloccate: nuovi };
}

/**
 * Toglie da un elenco quello che viene da persone bloccate.
 * `quale` dice dove trovare l'identificativo di chi ha scritto.
 *
 * NON si lascia un buco con scritto "contenuto nascosto": quello e un
 * promemoria di una persona che hai deciso di non vedere piu, cioe
 * esattamente il contrario di quello che hai chiesto.
 */
export function senzaBloccati(elenco, prefs, quale = (x) => x.author_user_id) {
  const b = bloccati(prefs);
  if (!b.length || !Array.isArray(elenco)) return elenco || [];
  return elenco.filter((x) => !b.includes(quale(x)));
}
