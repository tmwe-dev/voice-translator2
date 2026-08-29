// ═══════════════════════════════════════════════════════════════
// LE PAROLE PER CERCARE, SEPARATE DALLE PAROLE PER LEGGERE
// (b.575, FASE 1; b.578, ponte di compatibilita)
//
// Regola 6 del documento di Luca: «le traduzioni della UI non devono
// mai determinare le query di ricerca». Il motore conosce ID canonici
// (`economy`, `sport`, `technology`); questo file — e nessun altro — sa
// come trasformarli nelle parole con cui interrogare le fonti.
//
// L'inglese e' obbligatorio per ogni topic: e' la rete di sicurezza.
// Una lingua che non c'e' non fa sparire un ramo, lo fa cercare in
// inglese.
//
// b.578 — durante la migrazione la UI vecchia usa ancora QUERY_RAPIDE.
// Alcune di quelle stringhe non coincidono con DOMANDE (es. «sport»
// contro «sport risultati»). Finche la UI non portera il topic insieme
// alla query, questa tabella di alias e' il solo ponte ammesso: il topic
// resta canonico e non viene mai indovinato dal titolo del contenuto.
//
// File PURO: nessun import.
// ═══════════════════════════════════════════════════════════════

export const DOMANDE = {
  news:        { en: 'top news today', it: 'ultime notizie oggi', es: 'últimas noticias hoy', fr: 'actualités du jour', de: 'aktuelle nachrichten', pt: 'últimas notícias' },
  breaking:    { en: 'breaking news', it: 'ultim\'ora', es: 'última hora', fr: 'dernière minute', de: 'eilmeldung', pt: 'plantão notícias' },
  politics:    { en: 'politics government', it: 'politica governo', es: 'política gobierno', fr: 'politique gouvernement', de: 'politik regierung', pt: 'política governo' },
  world:       { en: 'world news', it: 'notizie dal mondo', es: 'noticias del mundo', fr: 'actualités monde', de: 'weltnachrichten', pt: 'notícias do mundo' },

  economy:     { en: 'economy finance markets', it: 'economia finanza mercati', es: 'economía finanzas mercados', fr: 'économie finance marchés', de: 'wirtschaft finanzen', pt: 'economia finanças' },
  markets:     { en: 'stock markets today', it: 'borsa mercati oggi', es: 'bolsa mercados hoy', fr: 'bourse marchés', de: 'börse märkte', pt: 'bolsa mercados' },
  companies:   { en: 'companies business news', it: 'aziende imprese notizie', es: 'empresas negocios', fr: 'entreprises affaires', de: 'unternehmen wirtschaft', pt: 'empresas negócios' },
  finance:     { en: 'personal finance money', it: 'finanza personale risparmio', es: 'finanzas personales', fr: 'finances personnelles', de: 'finanzen geld', pt: 'finanças pessoais' },
  macroeconomics: { en: 'inflation interest rates economy', it: 'inflazione tassi economia', es: 'inflación tipos economía', fr: 'inflation taux économie', de: 'inflation zinsen', pt: 'inflação juros' },

  sport:       { en: 'sport results', it: 'sport risultati', es: 'deportes resultados', fr: 'sport résultats', de: 'sport ergebnisse', pt: 'esporte resultados' },
  football:    { en: 'football soccer', it: 'calcio serie a', es: 'fútbol', fr: 'football', de: 'fußball', pt: 'futebol' },
  motorsport:  { en: 'motorsport racing', it: 'motorsport gare', es: 'automovilismo', fr: 'sport automobile', de: 'motorsport', pt: 'automobilismo' },
  formula1:    { en: 'formula 1 f1', it: 'formula 1 f1', es: 'fórmula 1 f1', fr: 'formule 1 f1', de: 'formel 1', pt: 'fórmula 1' },
  motogp:      { en: 'motogp', it: 'motogp motomondiale', es: 'motogp', fr: 'motogp', de: 'motogp', pt: 'motogp' },
  tennis:      { en: 'tennis atp wta', it: 'tennis atp wta', es: 'tenis atp', fr: 'tennis atp', de: 'tennis atp', pt: 'tênis atp' },
  basketball:  { en: 'basketball nba', it: 'basket nba', es: 'baloncesto nba', fr: 'basket nba', de: 'basketball nba', pt: 'basquete nba' },
  cycling:     { en: 'cycling race', it: 'ciclismo corsa', es: 'ciclismo', fr: 'cyclisme', de: 'radsport', pt: 'ciclismo' },

  technology:  { en: 'technology news', it: 'tecnologia novità', es: 'tecnología novedades', fr: 'technologie actualités', de: 'technik neuheiten', pt: 'tecnologia novidades' },
  artificial_intelligence: { en: 'artificial intelligence ai', it: 'intelligenza artificiale', es: 'inteligencia artificial', fr: 'intelligence artificielle', de: 'künstliche intelligenz', pt: 'inteligência artificial' },
  devices:     { en: 'smartphones gadgets', it: 'smartphone dispositivi', es: 'móviles dispositivos', fr: 'smartphones appareils', de: 'smartphones geräte', pt: 'celulares dispositivos' },
  software:    { en: 'software apps', it: 'software applicazioni', es: 'software aplicaciones', fr: 'logiciels applications', de: 'software apps', pt: 'software aplicativos' },
  cybersecurity: { en: 'cybersecurity hacking', it: 'sicurezza informatica', es: 'ciberseguridad', fr: 'cybersécurité', de: 'cybersicherheit', pt: 'cibersegurança' },
  motors:      { en: 'cars motors news', it: 'motori auto novità', es: 'motor coches', fr: 'automobile actualités', de: 'auto news', pt: 'carros novidades' },

  science:     { en: 'science discoveries', it: 'scoperte scientifiche', es: 'descubrimientos científicos', fr: 'découvertes scientifiques', de: 'wissenschaft entdeckungen', pt: 'descobertas científicas' },
  space:       { en: 'space astronomy', it: 'spazio astronomia', es: 'espacio astronomía', fr: 'espace astronomie', de: 'weltraum astronomie', pt: 'espaço astronomia' },
  environment: { en: 'environment climate', it: 'ambiente clima', es: 'medio ambiente clima', fr: 'environnement climat', de: 'umwelt klima', pt: 'meio ambiente clima' },
  nature:      { en: 'nature planet', it: 'natura pianeta', es: 'naturaleza planeta', fr: 'nature planète', de: 'natur planet', pt: 'natureza planeta' },
  animals:     { en: 'animals wildlife', it: 'animali fauna', es: 'animales fauna', fr: 'animaux faune', de: 'tiere wildtiere', pt: 'animais fauna' },
  history:     { en: 'history stories past', it: 'storia racconti', es: 'historia relatos', fr: 'histoire récits', de: 'geschichte', pt: 'história' },

  culture:     { en: 'culture entertainment', it: 'cultura spettacolo', es: 'cultura espectáculo', fr: 'culture spectacle', de: 'kultur unterhaltung', pt: 'cultura espetáculo' },
  cinema:      { en: 'movies cinema', it: 'cinema film', es: 'cine películas', fr: 'cinéma films', de: 'kino filme', pt: 'cinema filmes' },
  music:       { en: 'music artists', it: 'musica artisti', es: 'música artistas', fr: 'musique artistes', de: 'musik künstler', pt: 'música artistas' },
  art:         { en: 'art exhibitions', it: 'arte mostre', es: 'arte exposiciones', fr: 'art expositions', de: 'kunst ausstellungen', pt: 'arte exposições' },
  books:       { en: 'books reading', it: 'libri letture', es: 'libros lecturas', fr: 'livres lectures', de: 'bücher lesen', pt: 'livros leituras' },
  games:       { en: 'video games gaming', it: 'videogiochi gaming', es: 'videojuegos', fr: 'jeux vidéo', de: 'videospiele', pt: 'videogames' },

  lifestyle:   { en: 'lifestyle trends', it: 'lifestyle tendenze', es: 'estilo de vida tendencias', fr: 'style de vie tendances', de: 'lifestyle trends', pt: 'estilo de vida tendências' },
  food:        { en: 'recipes cooking food', it: 'ricette cucina piatti', es: 'recetas cocina', fr: 'recettes cuisine', de: 'rezepte kochen', pt: 'receitas cozinha' },
  travel:      { en: 'travel places to see', it: 'viaggi posti da vedere', es: 'viajes lugares', fr: 'voyages lieux', de: 'reisen orte', pt: 'viagens lugares' },
  fashion:     { en: 'fashion trends style', it: 'moda tendenze stile', es: 'moda tendencias estilo', fr: 'mode tendances style', de: 'mode trends stil', pt: 'moda tendências estilo' },
  wellness:    { en: 'wellness health tips', it: 'benessere salute consigli', es: 'bienestar salud consejos', fr: 'bien-être santé conseils', de: 'wohlbefinden gesundheit', pt: 'bem-estar saúde' },
  health:      { en: 'health medicine', it: 'salute medicina', es: 'salud medicina', fr: 'santé médecine', de: 'gesundheit medizin', pt: 'saúde medicina' },
  curiosities: { en: 'amazing facts you did not know', it: 'curiosità cose che non sapevi', es: 'curiosidades increíbles', fr: 'faits étonnants', de: 'erstaunliche fakten', pt: 'curiosidades incríveis' },
  people:      { en: 'human stories', it: 'storie di persone', es: 'historias de personas', fr: 'histoires de gens', de: 'menschen geschichten', pt: 'histórias de pessoas' },
};

/** La radice di una lingua: «it-IT» e «it» sono la stessa cosa. */
function radice(l) {
  return String(l || '').split('-')[0].toLowerCase();
}

/** Una query ha una sola forma di confronto, indipendente da spazi doppi. */
function chiaveQuery(q) {
  return String(q || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Come si chiede questo topic in questa lingua.
 * Manca la lingua → inglese. Manca il topic → stringa vuota.
 */
export function domandaPer(topic, lingua = 'en') {
  const d = DOMANDE[String(topic || '')];
  if (!d) return '';
  return d[radice(lingua)] || d.en || '';
}

/** Le domande di piu topic, senza vuoti e senza doppioni. */
export function domandePer(topics, lingua = 'en') {
  const visti = new Set();
  const fuori = [];
  for (const t of (Array.isArray(topics) ? topics : [])) {
    const q = domandaPer(t, lingua);
    const k = chiaveQuery(q);
    if (!q || visti.has(k)) continue;
    visti.add(k);
    fuori.push({ topic: t, query: q });
  }
  return fuori;
}

// La UI precedente alla FASE 5 usa ancora queste domande. Non sono una
// seconda tassonomia: sono solo alias di ingresso verso gli stessi ID.
const ALIAS_QUERY_LEGACY = {
  'ultime notizie': 'news',
  'últimas noticias': 'news',
  'dernières nouvelles': 'news',
  'nachrichten heute': 'news',

  'sport': 'sport',
  'sports': 'sport',
  'deportes': 'sport',

  'tecnologia': 'technology',
  'technology': 'technology',
  'tecnología': 'technology',
  'technologie': 'technology',

  'economia': 'economy',
  'economy business': 'economy',
  'economía': 'economy',
  'économie': 'economy',
  'wirtschaft': 'economy',

  'scienza': 'science',
  'science': 'science',
  'ciencia': 'science',
  'wissenschaft': 'science',

  'arte cultura': 'art',
  'art culture': 'art',
  'kunst kultur': 'art',
};

// La strada a ritroso serve solo al ponte con il mondo vecchio. Prima
// si leggono le domande canoniche; poi gli alias espliciti. Una domanda
// libera dell'utente non viene MAI classificata per somiglianza.
const A_RITROSO = (() => {
  const m = {};
  for (const [topic, lingue] of Object.entries(DOMANDE)) {
    for (const q of Object.values(lingue)) {
      const k = chiaveQuery(q);
      if (k && !m[k]) m[k] = topic;
    }
  }
  for (const [q, topic] of Object.entries(ALIAS_QUERY_LEGACY)) {
    const k = chiaveQuery(q);
    if (k && !m[k]) m[k] = topic;
  }
  return m;
})();

/** Il topic di una domanda nostra; una domanda libera resta senza topic. */
export function topicDallaDomanda(query) {
  return A_RITROSO[chiaveQuery(query)] || '';
}
