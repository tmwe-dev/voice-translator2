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
import { cercaNotizie } from './ricerca.js';
import { arricchisci } from './estrai.js';
import { raggruppaInArgomenti } from './raggruppa.js';

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
export async function stanzeCheNeParlano(query) {
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
} = {}) {
  const q = normalizzaQuery(query);
  if (!q) return { argomenti: [], stanze: [], daCache: false, quando: Date.now() };

  // LIVELLO 0 — sempre, anche con la cache: le persone prima delle notizie.
  racconta('stanze');
  const stanze = await stanzeCheNeParlano(q);

  // LIVELLO 1 — la cache condivisa. "Aggiorna" (fresca=true) la salta.
  const chiave = chiaveCache(q, lingua);
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
  const articoli = await cercaNotizie(q, lingua, { massimo: 20 });
  racconta('fonti', { quante: articoli.length });
  if (articoli.length === 0) {
    return { argomenti: [], stanze, daCache: false, quando: Date.now() };
  }

  await arricchisci(articoli, {
    quanti: 10,
    suProgresso: (dominio) => racconta('leggo', { dominio }),
  });

  racconta('raggruppo');
  const argomenti = raggruppaInArgomenti(articoli).slice(0, 12);

  const risultato = { argomenti, quando: Date.now() };
  try {
    const ttl = TTL_CACHE[categoria] || TTL_PREDEFINITO;
    await redis('SET', chiave, JSON.stringify(risultato), 'EX', ttl);
  } catch { /* senza cache si vive lo stesso */ }

  return { ...risultato, stanze, daCache: false };
}
