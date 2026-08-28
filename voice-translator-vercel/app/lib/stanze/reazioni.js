// ═══════════════════════════════════════════════════════════════
// lib/stanze/reazioni.js — le reazioni DENTRO le stanze (server, Redis)
//
// b.551 — Questo file esisteva da b.99 come lib/reazioni.js. In b.545,
// costruendo le reazioni del Mondo, gli ho scritto sopra: stesso nome,
// contenuto tutto diverso. Da quel giorno /api/reazioni non partiva
// nemmeno — l'import di `reagisci` puntava al nulla — e nelle stanze
// non si poteva piu mettere un cuore a nessuno. Luca lo aveva detto
// («non si puo dare un mi piace a nessuno»): era questo.
//
// Adesso i due mondi hanno due case separate e nomi che dicono dove
// stanno:
//   lib/reazioni.js         → le facce sui contenuti del Mondo (telefono)
//   lib/stanze/reazioni.js  → su/giu/cuore sui messaggi (Redis, server)
// ═══════════════════════════════════════════════════════════════
import { redis } from '../redis.js';

// ═══════════════════════════════════════════════════════════════
// REAZIONI E RILEVANZA
//
// Tre gesti soli — pollice su, pollice giu, cuore — piu la risposta
// diretta, che non e una reazione ma un messaggio come gli altri.
//
// PERCHE FUNZIONA ANCHE NELLE CHAT CIFRATE. Una reazione e un contatore
// appeso a un identificativo: il server conta, e non sa cosa c'era
// scritto nel messaggio. Quindi le reazioni si possono usare ovunque,
// anche dove il contenuto e cifrato punto a punto.
//
// LA CONSERVAZIONE DEI MESSAGGI, INVECE, NO. Per far vedere a chi entra
// cosa si e detto prima, i messaggi devono stare sul server in chiaro.
// Vale SOLO per le stanze Community, e va detto a chi entra.
// ═══════════════════════════════════════════════════════════════

const ORA = 3600;
const TTL = ORA * 2;        // le reazioni non sopravvivono alla stanza
const MAX_STORICO = 200;    // oltre, si butta il piu vecchio

export const TIPI = ['su', 'giu', 'cuore'];

const chiave = {
  conte: (r, m) => `reaz:${r}:${m}`,
  mio: (r, m, chi) => `reaz:${r}:${m}:di:${chi}`,
  storico: (r) => `msg:${r}`,
  risposte: (r, m) => `risp:${r}:${m}`,
};

const pulisci = (s) => (s || '').trim().toLowerCase().slice(0, 40);

// ── Reagire ──
//
// Su e giu si escludono: sono lo stesso gesto in due direzioni, e chi
// cambia idea non deve restare contato due volte. Il cuore vive per
// conto suo: si puo amare un messaggio e insieme non essere d'accordo.

export async function reagisci(roomId, msgId, tipo, chi) {
  if (!roomId || !msgId || !TIPI.includes(tipo)) return null;
  const io = pulisci(chi);
  if (!io) return null;

  const k = chiave.conte(roomId, msgId);
  const kMio = chiave.mio(roomId, msgId, io);

  const grezzo = await redis('GET', kMio);
  let mie; try { mie = grezzo ? JSON.parse(grezzo) : {}; } catch { mie = {}; }

  const delta = { su: 0, giu: 0, cuore: 0 };

  if (mie[tipo]) {
    // Secondo tocco sullo stesso gesto: si toglie. E come cancellare un voto.
    delta[tipo] = -1;
    delete mie[tipo];
  } else {
    delta[tipo] = 1;
    mie[tipo] = 1;
    // Su e giu non convivono.
    const opposto = tipo === 'su' ? 'giu' : tipo === 'giu' ? 'su' : null;
    if (opposto && mie[opposto]) { delta[opposto] = -1; delete mie[opposto]; }
  }

  for (const t of TIPI) {
    if (delta[t]) await redis('HINCRBY', k, t, delta[t]);
  }
  await redis('EXPIRE', k, TTL);

  if (Object.keys(mie).length) await redis('SET', kMio, JSON.stringify(mie), 'EX', TTL);
  else await redis('DEL', kMio);

  return { conte: await leggiConte(roomId, msgId), mie };
}

export async function leggiConte(roomId, msgId) {
  const h = await redis('HGETALL', chiave.conte(roomId, msgId));
  const conte = { su: 0, giu: 0, cuore: 0 };
  if (Array.isArray(h)) {
    for (let i = 0; i < h.length; i += 2) conte[h[i]] = Number(h[i + 1]) || 0;
  } else if (h && typeof h === 'object') {
    for (const t of TIPI) conte[t] = Number(h[t]) || 0;
  }
  for (const t of TIPI) conte[t] = Math.max(0, conte[t]);
  return conte;
}

export async function leggiMie(roomId, msgId, chi) {
  const grezzo = await redis('GET', chiave.mio(roomId, msgId, pulisci(chi)));
  try { return grezzo ? JSON.parse(grezzo) : {}; } catch { return {}; }
}

export async function contaRisposte(roomId, msgId) {
  return Number(await redis('GET', chiave.risposte(roomId, msgId))) || 0;
}

// ── Rilevanza ──
//
// Chi entra deve capire il clima in tre secondi. Non basta "il piu
// piaciuto": un messaggio con dieci pollici su e dieci giu racconta molto
// di piu di uno con venti su e zero giu. Quindi il disaccordo NON
// penalizza: alza.
//
//   gradimento  = su + cuore che pesa una volta e mezza
//   discussione = quanto le due parti si sono incontrate (il minimo fra
//                 su e giu, che e alto solo se entrambe sono alte)
//                 piu le risposte, che sono l'impegno piu costoso
//
// Un messaggio ignorato da tutti resta in fondo, come deve.

export function rilevanza({ su = 0, giu = 0, cuore = 0, risposte = 0 } = {}) {
  const gradimento = su + cuore * 1.5;
  const discussione = Math.min(su, giu) * 2 + risposte * 3;
  return gradimento + discussione;
}

// ── Storico dei messaggi (SOLO stanze Community) ──

export async function salvaMessaggio(roomId, messaggio) {
  if (!roomId || !messaggio?.id) return false;
  const magro = {
    id: String(messaggio.id).slice(0, 64),
    nome: String(messaggio.nome || '').slice(0, 40),
    testo: String(messaggio.testo || '').slice(0, 1000),
    lang: String(messaggio.lang || '').slice(0, 10),
    rispostaA: messaggio.rispostaA ? String(messaggio.rispostaA).slice(0, 64) : null,
    ts: Date.now(),
  };
  await redis('LPUSH', chiave.storico(roomId), JSON.stringify(magro));
  await redis('LTRIM', chiave.storico(roomId), 0, MAX_STORICO - 1);
  await redis('EXPIRE', chiave.storico(roomId), TTL);

  if (magro.rispostaA) {
    await redis('INCR', chiave.risposte(roomId, magro.rispostaA));
    await redis('EXPIRE', chiave.risposte(roomId, magro.rispostaA), TTL);
  }
  return true;
}

async function tuttiIMessaggi(roomId) {
  const grezzi = await redis('LRANGE', chiave.storico(roomId), 0, MAX_STORICO - 1);
  return (grezzi || []).map(s => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
}

// Quello che vede chi entra adesso: gli ultimi venti per il filo del
// discorso, e i tre che hanno smosso di piu per il clima.
export async function storico(roomId, { recenti = 20, inCima = 3 } = {}) {
  const tutti = await tuttiIMessaggi(roomId);
  if (!tutti.length) return { recenti: [], rilevanti: [] };

  const conConte = await Promise.all(tutti.map(async m => {
    const [conte, risposte] = await Promise.all([
      leggiConte(roomId, m.id),
      contaRisposte(roomId, m.id),
    ]);
    return { ...m, conte, risposte, punteggio: rilevanza({ ...conte, risposte }) };
  }));

  // LPUSH mette in testa il piu recente: per leggere in ordine si gira.
  const ultimi = conConte.slice(0, recenti).reverse();

  const rilevanti = conConte
    .filter(m => m.punteggio > 0)
    .sort((a, b) => b.punteggio - a.punteggio)
    .slice(0, inCima);

  return { recenti: ultimi, rilevanti };
}
