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
import { vociDiRicerca, chiaveLista, imparaFonti } from './fonti.js'; // b.543 — la ricerca a piu voci; b.553 — e chi si fa notare si comincia a seguirlo
import { leggiFonti } from './registro.js'; // b.553 — le fonti si SEGUONO: si legge all'origine
import { fontiDelPosto, fontiViste, fontiDaProvare } from './deposito.js'; // b.553 — e il registro ha una casa vera, con la sua storia
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
  // b.543 — il Paese/settore da cui prendere la lista di testate: se c'e
  // una lista viva, la ricerca smette di essere una domanda sola.
  paeseFonti = '', settoreFonti = '',
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
  // Decisione di Luca: «il feed Mondo nasce dalle FONTI, non dai motori
  // di ricerca». Se per questo Paese o questo settore abbiamo delle
  // testate, si va a bussare alle LORO porte — il loro flusso RSS, che
  // pubblicano apposta perche' qualcuno lo legga — invece di chiedere a
  // un intermediario di raccontarci cosa hanno scritto.
  // Non e' solo piu pulito: e' gratis, senza tetti, e non dipende da
  // nessuno. Se le fonti bastano, il motore non si sveglia nemmeno.
  // b.553 — IL REGISTRO VIENE PRIMA DELLA LISTA IN CACHE. Nel deposito
  // (Supabase) le fonti hanno la loro storia: quante volte sono uscite
  // nei risultati, quante volte le abbiamo lette, quanto hanno reso. E'
  // quello l'ordine di merito vero. La lista in Redis resta dietro, per
  // il caso in cui il deposito non ci sia (prove, sviluppo).
  const ambito = { paese: paeseFonti || '', settore: settoreFonti || '' };
  let daSeguire = seguite;
  try {
    const dalRegistro = await fontiDelPosto({ ...ambito, quante: 20 });
    if (dalRegistro.length) {
      daSeguire = dalRegistro;
      racconta('registro', { quante: dalRegistro.length });
    }
    // b.564 — e due mai provate, ad ogni giro: e' l'esplorazione del
    // registro. Senza, una fonte appena scoperta non verrebbe mai
    // interrogata — di merito non ne ha ancora, e senza essere letta non
    // ne fara mai.
    const nuove = await fontiDaProvare({ quante: 2 });
    if (nuove.length) {
      daSeguire = [...daSeguire, ...nuove];
      racconta('registro-nuove', { quante: nuove.length });
    }
  } catch { /* senza deposito si usa la lista che c'e */ }

  let daSeguite = [];
  if (daSeguire.length) {
    // b.564 — QUATTORDICI, non otto. Dal deposito: 71 fonti scoperte, 9
    // con un flusso trovato, e **49 mai nemmeno provate** — perche' ogni
    // giro ne guardava solo otto, sempre le stesse otto (sono ordinate
    // per merito). Il registro cresceva e restava spento.
    // Si leggono in parallelo, quindi quattordici costano quanto otto in
    // attesa; e ogni fonte nuova provata e' un flusso che da domani si
    // legge senza cercare.
    daSeguite = await leggiFonti(daSeguire, { q, quante: 14, perFonte: 5, ambito }).catch(() => []);
    if (daSeguite.length) {
      racconta('fonti-seguite', { quante: daSeguite.length });
      // ═══ b.564 — CIO CHE C'E' GIA SI MANDA SUBITO ═══
      // Misurato: una ricerca completa impiega fra otto e quindici
      // secondi, quasi tutti spesi dal motore e dalla lettura delle
      // pagine. Ma le fonti che SEGUIAMO rispondono in uno o due — sono
      // flussi, non ricerche. Non c'e' nessun motivo per farle aspettare
      // il resto: si mandano avanti, il giornale si apre, e il resto si
      // aggiunge quando arriva. Chi guarda vede qualcosa in due secondi
      // invece che in dodici, ed e' lo stesso lavoro.
      if (daSeguite.length >= 3) racconta('parziale', { argomenti: daSeguite.slice(0, 10) });
    }
  }
  // QUANTE BASTANO. Sotto le sei il giornale sembra vuoto e il motore
  // serve ancora; sopra, la ricerca diventa quello che deve essere —
  // un'eccezione, non l'ossatura.
  const BASTANO = 6;
  const fontiCoprono = daSeguite.length >= BASTANO;

  const [articoli, wiki] = await Promise.all([
    (async () => {
      // b.553 — le fonti hanno gia risposto: il motore resta spento.
      if (fontiCoprono) return daSeguite;
      const generale = await cercaNotizie(q, lingua, { massimo: 20 });
      // e quando non bastano, cio che le fonti hanno dato viene PRIMA:
      // e' roba di casa nostra, letta all'origine.
      if (!voci.length) return [...daSeguite, ...generale.filter((a) => !daSeguite.some((s) => s.url === a.url))];
      // le voci mirate portano poco a testa (3): il punto non e la
      // quantita, e che ci sia dentro anche altro oltre a cio che
      // l'aggregatore avrebbe scelto da solo.
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
  // La ricerca appena fatta ci ha detto DA CHI esce la roba buona su
  // questo argomento. Quelle testate, da domani, non le cerchiamo piu:
  // le leggiamo all'origine. E' il pezzo che fa crescere il patrimonio
  // da solo, e che rende il Mondo piu bravo ogni giorno invece di
  // costare uguale ogni giorno.
  // Si fa DOPO aver risposto e senza far aspettare nessuno: se la
  // scrittura non riesce, la ricerca e' andata bene lo stesso.
  // Nel deposito entra tutto cio che si e visto: li la scoperta non
  // scade, e domani sara il registro a dire chi seguire.
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
