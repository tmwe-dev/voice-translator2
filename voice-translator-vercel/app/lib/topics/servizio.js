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
// b.585 — due lavori diversi non devono piu sembrare lo stesso lavoro:
// una RICERCA ESPLICITA puo sempre interrogare il web; la crescita
// AUTOMATICA del giornale prima usa il patrimonio di fonti gia scoperto
// e riapre i motori solo dove quel patrimonio non e ancora sufficiente.
// ═══════════════════════════════════════════════════════════════

import { redis } from '../redis.js';
import { immagineSicura } from './ricerca.js';
import { cercaNotizie, risolviLinkGoogle } from './ricerca.js';
import { cercaWikipedia } from './wikipedia.js';
import { meritaEnciclopedia } from './enciclopediaUtile.js'; // b.541 — l'enciclopedia solo dove c'entra
import { vociDiRicerca, chiaveLista, imparaFonti } from './fonti.js'; // b.543 — la ricerca a piu voci; b.553 — e chi si fa notare si comincia a seguirlo
import { leggiFonti } from './registro.js'; // b.553 — le fonti si SEGUONO: si legge all'origine
import { fontiDelPosto, contaFontiDelPosto, fontiViste, fontiDaProvare } from './deposito.js'; // b.553/b.585 — storia + contatore leggero
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
const BASTANO_DA_FONTI = 6;
// Il nome storico resta: diversi guardrail verificano che «sei pezzi
// bastano» continui a essere una regola leggibile, non nascosta.
const BASTANO = BASTANO_DA_FONTI;

// b.585 — CONTATORI SEMPLICI, non un altro motore di scoring.
// Sono soglie di prodotto in un posto solo e si possono ritoccare
// leggendo i numeri reali. Un Paese maturo non deve essere riscoperto
// per ogni persona che apre Mondo; un settore e piu stretto e gli basta
// un patrimonio piu piccolo.
export const SOGLIE_FONTI = Object.freeze({ paese: 100, settore: 25 });

export function sogliaFonti({ paese = '', settore = '' } = {}) {
  if (settore) return SOGLIE_FONTI.settore;
  if (paese) return SOGLIE_FONTI.paese;
  return Infinity; // senza un ambito non si finge di sapere che il mondo e coperto
}

/**
 * L'unica decisione della discovery automatica.
 * - una richiesta esplicita dell'utente puo sempre cercare;
 * - se le fonti note hanno gia prodotto un giornale, non serve cercare;
 * - se l'ambito ha gia abbastanza fonti registrate, il giro automatico
 *   resta sulle fonti e passa al ramo successivo invece di interrogare
 *   ancora Google/Bing per trovare quasi sempre gli stessi domini.
 */
export function deveCercareSulWeb({
  ricercaEsplicita = true,
  fontiLette = 0,
  fontiRegistrate = 0,
  soglia = Infinity,
  bastano = BASTANO_DA_FONTI,
} = {}) {
  if (ricercaEsplicita) return true;
  if (fontiLette >= bastano) return false;
  if (Number.isFinite(soglia) && fontiRegistrate >= soglia) return false;
  return true;
}

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
  // b.543 — il Paese/settore da cui prendere la lista di testate: se c'e
  // una lista viva, la ricerca smette di essere una domanda sola.
  paeseFonti = '', settoreFonti = '',
  // b.585 — false solo per i giri che Mondo genera da solo. Una domanda
  // scritta/toccata dall'utente resta sempre esplicita e non viene mai
  // bloccata dal contatore delle fonti.
  ricercaEsplicita = true,
} = {}) {
  const q = normalizzaQuery(query);
  if (!q) return { argomenti: [], stanze: [], daCache: false, quando: Date.now() };

  // LIVELLO 0 — sempre, anche con la cache: le persone prima delle notizie.
  racconta('stanze');
  const stanze = await stanzeCheNeParlano(q);

  // LIVELLO 1 — cache condivisa, ma SEPARATA fra automatico ed esplicito.
  // Una risposta automatica fatta solo dalle fonti note non deve poter
  // impedire a una ricerca esplicita identica di andare sul web.
  const baseChiave = profonda ? `${chiaveCache(q, lingua)}:deep${fonti}` : chiaveCache(q, lingua);
  const chiave = ricercaEsplicita ? baseChiave : `${baseChiave}:auto`;
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
  // b.585 — Wikipedia e un approfondimento richiesto, non una tassa su
  // ogni giro automatico del feed. Nei giri automatici si resta sulle
  // fonti; quando la persona cerca/approfondisce, la porta resta aperta.
  const wikiSensata = ricercaEsplicita && profonda && meritaEnciclopedia(q);
  const wikiMax = wikiSensata ? Math.max(2, Math.min(Math.round(fonti / 2), 6)) : 0;
  // ═══ b.543 — LA RICERCA A PIU VOCI ═══
  // Ordine di Luca sulla pluralita: «probabilmente tu cerchi quasi sempre
  // nelle stesse fonti e in realta devi ampliare in modo intelligente le
  // ricerche». Vero: fino a ieri si faceva UNA domanda a Bing e si
  // prendeva cio che dava. Adesso, se esiste una lista di testate per
  // questo Paese o questo settore (il Fontiere, /api/topics/fonti), alla
  // domanda generale si affiancano quattro domande MIRATE — `q
  // site:testata` — cosi i risultati vengono da posti diversi per
  // costruzione, non per fortuna. Se la lista non c'e, tutto come prima.
  let voci = [];
  let seguite = [];
  try {
    const kf = chiaveLista({ paese: paeseFonti, settore: settoreFonti });
    if (kf) {
      const salvata = await redis('GET', `fonti:${kf}`);
      if (salvata) {
        const lista = JSON.parse(salvata);
        seguite = Array.isArray(lista?.fonti) ? lista.fonti : [];
        voci = vociDiRicerca(q, seguite, { quante: 4 });
      }
    }
  } catch { /* senza lista si cerca come si e sempre cercato */ }
  if (voci.length) racconta('fonti-mirate', { quante: voci.length });

  // ═══ b.553 — PRIMA SI LEGGONO LE FONTI CHE SEGUIAMO ═══
  const ambito = { paese: paeseFonti || '', settore: settoreFonti || '' };
  const soglia = sogliaFonti(ambito);
  let fontiRegistrate = 0;
  let daSeguire = seguite;
  try {
    // La lista viva resta quella storica: venti fonti ordinate per
    // merito. Il contatore 100/25 e una HEAD separata e leggera, non
    // trasforma il registro in un caricamento di cento record.
    const dalRegistro = await fontiDelPosto({ ...ambito, quante: 20 });
    const conteggio = ricercaEsplicita ? dalRegistro.length : await contaFontiDelPosto(ambito);
    fontiRegistrate = Math.max(dalRegistro.length, conteggio);
    if (dalRegistro.length) {
      daSeguire = dalRegistro;
      racconta('registro', { quante: dalRegistro.length });
    }
    // Le fonti gia SCOPERTE ma mai provate continuano a essere aperte a
    // piccoli passi: questo non interroga un motore e fa fruttare il
    // patrimonio che abbiamo gia pagato per scoprire.
    const nuove = await fontiDaProvare({ quante: 2 });
    if (nuove.length) {
      daSeguire = [...daSeguire, ...nuove];
      racconta('registro-nuove', { quante: nuove.length });
    }
  } catch { /* senza deposito si usa la lista che c'e */ }

  let daSeguite = [];
  if (daSeguire.length) {
    daSeguite = await leggiFonti(daSeguire, { q, quante: 14, perFonte: 5, ambito }).catch(() => []);
    if (daSeguite.length) {
      racconta('fonti-seguite', { quante: daSeguite.length });
      if (daSeguite.length >= 3) racconta('parziale', { argomenti: daSeguite.slice(0, 10) });
    }
  }

  // Il guardrail storico resta leggibile: sei articoli dalle fonti sono
  // gia un giornale. b.585 aggiunge soltanto il secondo criterio, il
  // patrimonio maturo 100/25, per i giri automatici.
  const fontiCoprono = daSeguite.length >= BASTANO;
  const cercaWeb = deveCercareSulWeb({
    ricercaEsplicita,
    fontiLette: daSeguite.length,
    fontiRegistrate,
    soglia,
  });

  const [articoli, wiki] = await Promise.all([
    (async () => {
      // ESPLICITO: non entra in questo blocco e puo sempre allargarsi.
      // AUTOMATICO: prima vale il vecchio «sei bastano», poi la nuova
      // soglia del registro. Nessuna delle due regole indebolisce l'altra.
      if (!ricercaEsplicita) {
        if (fontiCoprono) return daSeguite;
        if (!cercaWeb) return daSeguite;
      }
      const generale = await cercaNotizie(q, lingua, { massimo: 20 });
      if (!voci.length) return [...daSeguite, ...generale.filter((a) => !daSeguite.some((s) => s.url === a.url))];
      const mirate = await Promise.all(voci.map((v) => cercaNotizie(v, lingua, { massimo: 3 }).catch(() => [])));
      const visti = new Set(generale.map((a) => a?.url).filter(Boolean));
      const extra = [];
      for (const gruppo of mirate) {
        for (const a of gruppo) {
          if (!a?.url || visti.has(a.url)) continue;
          visti.add(a.url);
          extra.push(a);
        }
      }
      const dalMotore = [...generale, ...extra];
      return [...daSeguite, ...dalMotore.filter((a) => !daSeguite.some((s) => s.url === a.url))];
    })(),
    wikiSensata ? cercaWikipedia(q, lingua, { massimo: wikiMax }).catch(() => []) : Promise.resolve([]),
  ]);
  racconta('fonti', { quante: articoli.length + wiki.length });

  // ═══ b.553 — DISCOVER → FOLLOW ═══
  // Ogni ricerca che ha davvero trovato nuovi domini continua a farli
  // entrare nel patrimonio condiviso; i refresh dalle fonti rafforzano
  // la storia che esiste gia. Se il deposito non risponde, il feed vive.
  try { if (articoli.length) await fontiViste(articoli, ambito); } catch { /* la storia e un di piu, mai una condizione */ }
  try {
    const kf = chiaveLista({ paese: paeseFonti, settore: settoreFonti });
    if (kf && articoli.length) {
      const cresciuta = imparaFonti(seguite, articoli);
      if (cresciuta) {
        await redis('SET', `fonti:${kf}`, JSON.stringify({ fonti: cresciuta, quando: Date.now() }), 'EX', String(30 * 24 * 3600));
        racconta('fonti-imparate', { quante: cresciuta.length - seguite.length });
      }
    }
  } catch { /* imparare e un di piu: non deve mai rompere una ricerca riuscita */ }
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
