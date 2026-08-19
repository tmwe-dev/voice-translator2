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
export const DIREZIONI = [
  { id: 'ampio',    etichetta: 'Più ampio',    icona: '🔭', nota: 'Panoramica, più argomenti' },
  { id: 'specifico', etichetta: 'Più specifico', icona: '🔬', nota: 'Un aspetto in profondità' },
  { id: 'pratico',  etichetta: 'Più pratico',  icona: '🛠️', nota: 'Esempi, esercizi, applicazioni' },
  { id: 'teorico',  etichetta: 'Più teorico',  icona: '📖', nota: 'Fondamenti e teoria' },
];

/** Template di partenza (scorciatoie). L'utente può ignorarli e scrivere il proprio. */
export const CORSI_TEMPLATE = [
  { id: 'inglese',   titolo: 'Inglese',              icona: '🇬🇧', categoria: 'lingue',      livello: 'intermedio', colore: '#1a237e' },
  { id: 'python',    titolo: 'Python per principianti', icona: '💻', categoria: 'informatica', livello: 'base',       colore: '#2b6cb0' },
  { id: 'filosofia', titolo: 'Storia della filosofia', icona: '🏛️', categoria: 'filosofia',   livello: 'intermedio', colore: '#6b46c1' },
  { id: 'quantistica', titolo: 'Meccanica quantistica', icona: '⚛️', categoria: 'scienze',    livello: 'avanzato',   colore: '#0f766e' },
  { id: 'anatomia',  titolo: 'Anatomia umana',       icona: '🫀', categoria: 'medicina',     livello: 'universitario', colore: '#b91c1c' },
  { id: 'economia',  titolo: 'Economia comportamentale', icona: '📈', categoria: 'economia',  livello: 'avanzato',   colore: '#b45309' },
];

export function getLivello(id) { return LIVELLI.find(l => l.id === id) || null; }
export function getCategoria(id) { return CATEGORIE.find(c => c.id === id) || null; }
export function categoriaCertificata(id) { return !!getCategoria(id)?.fontiCertificate; }

/** Quante lezioni per un livello (il minimo del range, per non gonfiare). */
export function lezioniPerLivello(id) {
  const l = getLivello(id);
  return l ? l.lezioni[0] : 5;
}

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
