// ═══════════════════════════════════════════════════════════════
// IL SERVIZIO — i tre livelli del costo, dal gratis al pagato
//
// Concordato con Luca (14/8): l'utente il piu delle volte CERCA un
// argomento fra le discussioni esistenti; il motore di notizie e il
// seminatore, non il cuore. Quindi:
//
//   LIVELLO 0 — le stanze pubbliche gia attive che parlano di questo
//               (una query sui dati nostri: gratis)
//   LIVELLO 1 — la cache CONDIVISA fra tutti gli utenti: se qualcuno
//               ha cercato "formula 1" da poco, si riusa (quasi gratis)
//   LIVELLO 2 — la ricerca fresca: RSS + schede articolo + cluster
//               (l'unico livello che tocca il web, e niente AI)
//
// Niente cron, niente aggiornamento automatico: ogni ricerca nasce da
// un gesto dell'utente. Il TTL della cache varia per categoria, come
// da piano: le notizie invecchiano in fretta, l'arte no.
// ═══════════════════════════════════════════════════════════════

import { redis } from '../redis.js';
import { immagineSicura } from './ricerca.js';
import { cercaNotizie, risolviLinkGoogle } from './ricerca.js';
import { cercaWikipedia } from './wikipedia.js';
import { meritaEnciclopedia } from './enciclopediaUtile.js'; // b.541 — l'enciclopedia solo dove c'entra
import { arricchisci } from './estrai.js';
import { raggruppaInArgomenti } from './raggruppa.js';
import { riordina } from './riordino.js';

const TTL_CACHE = {
  notizie: 15 * 60,      // breaking: 15 minuti
  sport: 10 * 60,
  tecnologia: 30 * 60,
  economia: 30 * 60,
  scienza: 6 * 3600,
  arte: 24 * 3600,       // evergreen: un giorno
};
const TTL_PREDEFINITO = 15 * 60;

export function normalizzaQuery(q) {
  return (q || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 120);
}

function chiaveCache(query, lingua) {
  return `topics:${lingua}:${normalizzaQuery(query)}`;
}

/** LIVELLO 0 — le stanze Mondo attive che gia parlano dell'argomento. */
// b.363 — non piu esportata: la usa solo questo file. Era offerta a tutto
// il progetto senza che nessuno la chiedesse.
async function stanzeCheNeParlano(query) {
  try {
    const grezze = await redis('LRANGE', 'mondo:rooms', 0, 29);
    const q = normalizzaQuery(query);
    if (!q) return [];
    const parole = q.split(' ').filter(p => p.length > 2);
    const stanze = (grezze || []).map(s => { try { return JSON.parse(s); } catch { return null; } })
      .filter(Boolean)
      .filter(r => {
        const testo = `${r.nome || ''} ${r.description || ''}`.toLowerCase();
        return parole.some(p => testo.includes(p));
      });
    return stanze.slice(0, 5);
  } catch { return []; }
}

/**
 * La ricerca completa, con il processo dichiarato passo per passo.
 * `racconta(stadio, dati)` e il filo diretto con l'interfaccia: e
 * cio che permette di MOSTRARE il lavoro di Cobra mentre avviene.
 *
 * @returns {{ argomenti, stanze, daCache, quando }}
 */
export async function cercaArgomenti(query, lingua = 'en', {
  categoria = 'notizie', fresca = false, racconta = () => {},
  // b.185 — la seconda modalita, opt-in: piu fonti (oggi Wikipedia
  // accanto alle notizie), i FATTI in testa. `fonti` = quanto
  // approfondire (piu voci enciclopediche). La veloce resta identica.
  profonda = false, fonti = 6,
} = {}) {
  const q = normalizzaQuery(query);
  if (!q) return { argomenti: [], stanze: [], daCache: false, quando: Date.now() };

  // LIVELLO 0 — sempre, anche con la cache: le persone prima delle notizie.
  racconta('stanze');
  const stanze = await stanzeCheNeParlano(q);

  // LIVELLO 1 — la cache condivisa. "Aggiorna" (fresca=true) la salta.
  // b.185 — la cache della profonda e SEPARATA da quella veloce (chiave
  // diversa): due modalita, due risultati, non si sovrascrivono.
  const chiave = profonda ? `${chiaveCache(q, lingua)}:deep${fonti}` : chiaveCache(q, lingua);
  if (!fresca) {
    try {
      const salvato = await redis('GET', chiave);
      if (salvato) {
        const dati = JSON.parse(salvato);
        racconta('cache', { quando: dati.quando });
        return { ...dati, stanze, daCache: true };
      }
    } catch { /* cache rotta = cache assente */ }
  }

  // LIVELLO 2 — il lavoro vero.
  racconta('cerca', { query: q });
  // b.185 — in modalita profonda si aprono PIU porte in parallelo:
  // le notizie (Bing/Google) E l'enciclopedia (Wikipedia). `fonti`
  // decide quante voci enciclopediche (2..6). Nella veloce, wiki = 0.
  // b.541 — L'ENCICLOPEDIA SOLO DOVE C'ENTRA. Collaudo di Luca: cercando
  // «ultime notizie» il giornale apriva con tre OMONIMI — un romanzo di
  // Ballard, un film del 1935, un romanzo di Pennac — perche' Wikipedia
  // risponde per TITOLO e quella e' una richiesta di attualita, non un
  // soggetto. Adesso la porta si apre solo per le domande che hanno
  // davvero un soggetto dietro (enciclopediaUtile.js).
  const wikiSensata = profonda && meritaEnciclopedia(q);
  const wikiMax = wikiSensata ? Math.max(2, Math.min(Math.round(fonti / 2), 6)) : 0;
  const [articoli, wiki] = await Promise.all([
    cercaNotizie(q, lingua, { massimo: 20 }),
    wikiSensata ? cercaWikipedia(q, lingua, { massimo: wikiMax }).catch(() => []) : Promise.resolve([]),
  ]);
  racconta('fonti', { quante: articoli.length + wiki.length });
  // b.150 — se e entrata la riserva Google, i rimbalzi si sbucciano
  // fino al dominio vero: senza questo, niente og:image e card nude.
  await risolviLinkGoogle(articoli, {
    quanti: 10,
    suRisolto: (dominio) => racconta('leggo', { dominio }),
  });

  if (articoli.length > 0) {
    await arricchisci(articoli, {
      quanti: 10,
      suProgresso: (dominio) => racconta('leggo', { dominio }),
    });
  }

  racconta('raggruppo');
  const cardsNotizie = raggruppaInArgomenti(articoli).slice(0, 12);
  // b.185 — le voci enciclopediche diventano card come le altre, ma
  // marcate tipo:'enciclopedia' e messe IN TESTA in modalita profonda:
  // il fatto verificato prima della notizia del giorno.
  const cardsWiki = wiki.map((v, i) => ({
    id: `w${i}`,
    titolo: v.titolo,
    sintesi: v.descrizione || '',
    immagine: immagineSicura(v.immagine || ''),
    url: v.url,
    fonti: [{ dominio: v.dominio, fonte: 'Wikipedia', url: v.url, titolo: v.titolo }],
    pubblicato: null,
    tipo: 'enciclopedia',
  }));
  // b.194 — FASE 2 della ricerca: solo in APPROFONDITA le card passano
  // dal riordino (corroborazione + direttorio fonti di settore +
  // pertinenza + freschezza). La veloce resta identica, ordinata da
  // raggruppaInArgomenti. Il riordino e puro (nessuna rete): l'istante
  // di riferimento glielo passiamo noi.
  let argomenti = profonda ? [...cardsWiki, ...cardsNotizie] : cardsNotizie;
  if (profonda && argomenti.length > 1) {
    racconta('riordino');
    argomenti = riordina(argomenti, { query: q, nowMs: Date.now() });
  }
  if (argomenti.length === 0) {
    return { argomenti: [], stanze, daCache: false, quando: Date.now() };
  }

  const risultato = { argomenti, quando: Date.now() };
  try {
    const ttl = TTL_CACHE[categoria] || TTL_PREDEFINITO;
    await redis('SET', chiave, JSON.stringify(risultato), 'EX', ttl);
  } catch { /* senza cache si vive lo stesso */ }

  return { ...risultato, stanze, daCache: false };
}
