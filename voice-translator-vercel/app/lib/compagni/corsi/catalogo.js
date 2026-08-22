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

// ═══════════════════════════════════════════════════════════════
// b.378 — I PROFILI: chi sei, che e un'altra cosa da quanto sai.
//
// Piano approvato da Luca: «corsi di approfondimento specifico con
// standard differenti quando le caratteristiche dell'utente lo
// richiedono (bambino, anziano, ragazzo universitario, ricercatore,
// professionista)».
//
// PERCHE' NON SI AGGIUNGONO ALLA SCALA DEI LIVELLI. La scala va da
// bambino a ricercatore ed e una scala di PROFONDITA'. "Anziano" non e
// piu difficile di "ragazzo", e "professionista" non sta fra avanzato e
// universitario: sono la stessa lingua studiata da persone diverse, con
// tempi e situazioni diverse. Infilarli nella scala vorrebbe dire dire
// che un anziano sta a un livello — che oltre a essere sgradevole e
// falso.
//
// Quindi due assi separati:
//   LIVELLO  quanto si va a fondo   (c'era gia)
//   PROFILO  chi studia, e quindi la FORMA della lezione: quanto dura,
//            in quali situazioni si svolge, quanto si ripete
//
// Il profilo non cambia il tono — quello lo fa gia il livello. Cambia
// la forma: e per questo che vive qui e non dentro una veste narrativa.
export const PROFILI = [
  {
    id: 'chiunque', etichetta: 'Per tutti', icona: '\u{1F464}',
    minuti: null, istruzione: '',
  },
  {
    id: 'bambino', etichetta: 'Bambino', icona: '\u{1F9D2}',
    minuti: 3,
    istruzione: 'Blocchi da tre minuti. Al massimo SEI parole nuove per lezione, tutte cose che si possono toccare o indicare in un disegno. Nessuna regola scritta: la forma si impara ripetendola dentro il gioco. Situazioni: casa, scuola, giocare, mangiare. Mai una tabella.',
  },
  {
    id: 'ragazzo', etichetta: 'Ragazzo', icona: '\u{1F3A7}',
    minuti: 8,
    istruzione: 'Blocchi da otto minuti. Situazioni della sua vita: scuola, musica, sport, viaggiare da soli, parlare con altri ragazzi online. Registro informale, quello vero, non quello dei manuali. La regola in due righe, dopo averla usata.',
  },
  {
    id: 'professionista', etichetta: 'Professionista', icona: '\u{1F4BC}',
    minuti: 10,
    istruzione: 'Blocchi da dieci minuti, SOLO situazioni di lavoro: riunione, telefonata, email, trattativa, presentazione, colloquio. Registro formale e cortese. Nessuna situazione da turista. Ogni lezione deve lasciare frasi che si possono usare domani mattina.',
  },
  {
    id: 'anziano', etichetta: 'Anziano', icona: '\u{1F9D3}',
    minuti: 6,
    istruzione: 'Blocchi da sei minuti, con calma. Si ripete: ogni lezione riprende meta delle parole della precedente prima di aggiungerne di nuove. Frasi corte, una cosa per volta. Situazioni: viaggiare, la famiglia lontana, il medico, fare la spesa. Mai fretta, mai vergogna: se qualcosa non torna si rifa senza farlo pesare.',
  },
  {
    id: 'universitario', etichetta: 'Universitario', icona: '\u{1F393}',
    minuti: 15,
    istruzione: 'Blocchi da quindici minuti. Qui la regola puo arrivare PRIMA e per intero, con la sua terminologia: chi studia cosi e abituato a sistemare le cose in uno schema. Situazioni accademiche e sociali. Si possono confrontare due lingue.',
  },
  {
    id: 'ricercatore', etichetta: 'Ricercatore', icona: '\u{1F52C}',
    minuti: 20,
    istruzione: 'Blocchi da venti minuti. Etimologia, varianti regionali, registri storici, e le fonti quando ci sono. Si dicono le eccezioni e i casi controversi invece di semplificarli.',
  },
];

/** Il profilo, o quello neutro. */
export function profiloPer(id) {
  return PROFILI.find((p) => p.id === id) || PROFILI[0];
}

/** L'istruzione da mettere nel prompt. Vuota per il profilo neutro. */
export function istruzioniProfilo(id) {
  const p = profiloPer(id);
  if (!p.istruzione) return '';
  return `\n\n\u2500\u2500 CHI STUDIA: ${p.etichetta.toUpperCase()} \u2500\u2500\n${p.istruzione}`;
}

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

// ═══════════════════════════════════════════════════════════════
// b.391 — LA RETE DI SICUREZZA ERA SCOLLEGATA DA MESI.
//
// Le materie che pretendono fonti (medicina, psicologia, nutrizione,
// benessere) hanno una regola severa: se la ricerca fonti fallisce, la
// lezione NON si genera. E dal collaudo di oggi ho aggiunto anche il
// filtro sui domini, che butta via i siti di consumo.
//
// Nessuna delle due e mai scattata. Il motivo: la categoria si sceglieva
// da un menu che b.300 ha TOLTO — «basta il campo di ricerca». Da
// allora ogni corso nasce come "altro", e "altro" non e certificata.
// Quindi un corso di FARMACOLOGIA a livello Ricercatore veniva trattato
// come un corso di giardinaggio, e sotto le controindicazioni di un
// betabloccante compariva un sito di fitness per consumatori.
//
// Togliere un menu era giusto: chiedere la categoria era una domanda
// burocratica. Ma la categoria serviva a qualcosa, e quel qualcosa e
// rimasto scollegato. Adesso si DEDUCE dall'argomento, come si fa gia
// per la lingua studiata: chi scrive "Farmacologia" non deve anche
// dichiarare che e medicina.
// ═══════════════════════════════════════════════════════════════
const INDIZI_CATEGORIA = [
  ['medicina', /\b(medicin|farmac|farmacolog|patolog|clinic|diagnos|terapi|malatt|sintom|anatomi|fisiolog|cardiolog|neurolog|oncolog|pediatr|chirurg|antibiotic|vaccin|posolog|controindicaz|effetti collaterali|betabloccant|anticoagulant|insulin|dosagg)/i],
  ['psicologia', /\b(psicolog|psichiatr|psicoterap|ansia|depression|trauma|disturb[oi] (?:d\w+ )?(?:personalit|alimentar|umore)|cognitiv[oa] comportament)/i],
  ['nutrizione', /\b(nutrizion|dietolog|alimentazion|dieta|integrator|macronutrient|fabbisogno calor)/i],
  ['benessere', /\b(benesser|salute ment|sonno e salute|stress cronico)/i],
];

/**
 * La categoria dedotta dall'argomento, quando non ne e stata scelta una
 * vera. Restituisce quella data se e gia significativa.
 */
export function categoriaDaArgomento(argomento = '', categoriaScelta = 'altro') {
  if (categoriaScelta && categoriaScelta !== 'altro') return categoriaScelta;
  const t = String(argomento || '');
  for (const [id, re] of INDIZI_CATEGORIA) if (re.test(t)) return id;
  return categoriaScelta || 'altro';
}

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
