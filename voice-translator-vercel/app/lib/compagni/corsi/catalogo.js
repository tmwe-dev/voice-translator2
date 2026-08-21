// ═══════════════════════════════════════════════════════════════
// CORSI — catalogo (Luca)
//
// Ripreso dal sistema corsi di RadioChat, ridotto all'essenziale e reso
// dati PURI (nessun import da BarTalk): categorie, livelli, e alcuni
// template di partenza. L'utente può comunque generare un corso su
// QUALSIASI argomento (il template è solo una scorciatoia).
//
// Le categorie "fontiCertificate: true" (medicina, ecc.) diranno al
// generatore di cercare PRIMA fonti autorevoli (via ponte.cerca) e di
// fondarci sopra la lezione. Vedi generatore.js.
// ═══════════════════════════════════════════════════════════════

/** I livelli, con quante lezioni ha senso generare. */
export const LIVELLI = [
  { id: 'bambino',       etichetta: 'Bambino',       icona: '🧒', lezioni: [3, 5],  nota: 'Linguaggio semplice, esempi concreti, quiz facili' },
  { id: 'base',          etichetta: 'Base',          icona: '🌱', lezioni: [5, 7],  nota: 'Concetti fondamentali' },
  { id: 'intermedio',    etichetta: 'Intermedio',    icona: '📘', lezioni: [6, 8],  nota: 'Terminologia specifica' },
  { id: 'avanzato',      etichetta: 'Avanzato',      icona: '🎯', lezioni: [8, 10], nota: 'Analisi dettagliata e applicazioni' },
  { id: 'universitario', etichetta: 'Universitario', icona: '🎓', lezioni: [8, 12], nota: 'Livello accademico, riferimenti' },
  { id: 'ricercatore',   etichetta: 'Ricercatore',   icona: '🔬', lezioni: [10, 14], nota: 'Frontiera della ricerca, metodologia' },
];

/** Le categorie. `fontiCertificate` = pretende fonti attendibili. */
export const CATEGORIE = [
  { id: 'lingue',      etichetta: 'Lingue',            icona: '🌍', fontiCertificate: false },
  { id: 'scienze',     etichetta: 'Scienze',           icona: '🔬', fontiCertificate: false },
  { id: 'matematica',  etichetta: 'Matematica',        icona: '📐', fontiCertificate: false },
  { id: 'informatica', etichetta: 'Informatica',       icona: '💻', fontiCertificate: false },
  { id: 'medicina',    etichetta: 'Medicina',          icona: '🏥', fontiCertificate: true },
  { id: 'psicologia',  etichetta: 'Psicologia',        icona: '🧠', fontiCertificate: true },
  { id: 'nutrizione',  etichetta: 'Nutrizione',        icona: '🥗', fontiCertificate: true },
  { id: 'storia',      etichetta: 'Storia',            icona: '📜', fontiCertificate: false },
  { id: 'filosofia',   etichetta: 'Filosofia',         icona: '🏛️', fontiCertificate: false },
  { id: 'economia',    etichetta: 'Economia',          icona: '📈', fontiCertificate: false },
  { id: 'arte',        etichetta: 'Arte e Design',     icona: '🎨', fontiCertificate: false },
  { id: 'benessere',   etichetta: 'Benessere',         icona: '🧘', fontiCertificate: true },
  { id: 'crescita',    etichetta: 'Crescita personale', icona: '🌟', fontiCertificate: false },
  { id: 'altro',       etichetta: 'Altro',             icona: '📚', fontiCertificate: false },
];

/** Come piegare un corso su misura (passato al generatore). */
// b.363 — qui c'erano DIREZIONI (le quattro direzioni in cui piegare un
// corso: piu ampio, piu specifico, piu pratico, piu teorico) e
// CORSI_TEMPLATE (sei corsi di partenza come scorciatoia). Due elenchi
// pensati per l'interfaccia che l'interfaccia non ha mai letto: nessuna
// schermata mostrava quelle scelte, e nessun collaudo le toccava.
// Restavano promesse scritte in un file, e chi le leggeva credeva che
// quelle funzioni esistessero gia.

// b.363 — getLivello e getCategoria non sono piu esportate: le usa solo
// questo file, poche righe piu sotto.
function getLivello(id) { return LIVELLI.find(l => l.id === id) || null; }
function getCategoria(id) { return CATEGORIE.find(c => c.id === id) || null; }
export function categoriaCertificata(id) { return !!getCategoria(id)?.fontiCertificate; }

// b.363 — qui c'era lezioniPerLivello, che dava il minimo di lezioni per
// livello. E stata sostituita da lezioniProfonde (b.301), che ai livelli
// alti prende la coda della forbice invece del minimo; da allora nessuno
// chiamava piu la vecchia, ma restava li accanto alla nuova, pronta a
// essere ripresa per sbaglio.

// b.301 — PUNTO 5: piu moduli a livello alto. La coda della forbice
// (universitario 8-12, ricercatore 10-14) invece del minimo.
export function lezioniProfonde(id) {
  const l = getLivello(id);
  if (!l) return 5;
  const alto = id === 'universitario' || id === 'ricercatore';
  return alto ? l.lezioni[1] : l.lezioni[0];
}

// b.301 — PUNTO 7: quante domande di verifica, per livello.
// Base bastano 3; a salire crescono, perche una verifica universitaria
// non si esaurisce in tre crocette.
export function domandePerLivello(id) {
  return { bambino: 3, base: 3, intermedio: 4, avanzato: 5, universitario: 6, ricercatore: 6 }[id] || 3;
}
