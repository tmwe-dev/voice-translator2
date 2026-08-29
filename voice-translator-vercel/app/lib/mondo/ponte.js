// ═══════════════════════════════════════════════════════════════
// IL PONTE — IL MOTORE NUOVO TOCCA IL MONDO VECCHIO QUI E BASTA
// (b.577 FASE 5; b.578 coerenza del passaggio)
//
// Due promesse:
//   · ESCONO LE STESSE SCHEDE CHE SONO ENTRATE, in altro ordine.
//     Il ponte puo aggiungere i metadati `motivo` e `reasons`, ma non
//     sostituisce l'oggetto: il resto del giornale usa anche l'identita
//     dell'oggetto per capire se nel frattempo la lista e' cambiata.
//   · PRIMA SI TOGLIE, POI SI ORDINA. Un contenuto nascosto non puo
//     partecipare alla Regia e sparire solo alla fine, perche anche da
//     invisibile altererebbe la posizione delle schede visibili.
//
// Se il motore nuovo fallisce, il giornale resta: ritorna la lista di
// ingresso e l'utente non riceve uno schermo vuoto.
// ═══════════════════════════════════════════════════════════════
import { normalizza } from './normalize.js';
import { rankMondoCandidates } from './ranker.js';
import { mondoDirector } from './director.js';
import { settingsDaPrefs } from './settings.js';
import { profileDaPrefs } from './profile.js';
import { memoryDaPrefs } from './memory.js';
import { topicDallaDomanda } from './queries.js';
import { nascostiDi } from '../bacheca.js';
import { chiaveContenuto } from '../gradimento.js';

/** I motivi nuovi, detti con le parole che la schermata conosce gia. */
export function motivoVecchio(reasons, { internazionale = false } = {}) {
  const primo = (Array.isArray(reasons) ? reasons : [])[0]?.type || '';
  switch (primo) {
    case 'explicit_query': return 'perCercato';
    case 'followed_topic':
    case 'declared_interest':
    case 'learned_affinity':
    case 'followed_source':
    case 'recent_search': return 'perSeme';
    case 'discovery': return internazionale ? 'perMondo' : 'perSorpresa';
    case 'breaking':
    case 'popular_here':
    case 'fresh':
    default: return internazionale ? 'perMondo' : 'perRamo';
  }
}

/** La chiave con cui riconosciamo una scheda fra le due rive. */
function chiaveDi(s) {
  return s?.id || s?.url || s?.titolo || '';
}

/**
 * Le chiavi del modello nuovo da eliminare PRIMA del Ranker, ricavate
 * dalla stessa chiave usata dal vecchio `non mostrare piu`.
 */
function nascostiPerMotore(lista, candidati, originali, prefs) {
  const vecchi = new Set(nascostiDi(prefs).map(String));
  const hidden = [];
  const buttate = new Set();

  for (const c of candidati) {
    const s = originali.get(c.id);
    const k = chiaveContenuto(s?.url || '');
    if (!k || !vecchi.has(k)) continue;
    hidden.push(c.id);
    if (c.url) hidden.push(c.url);
    buttate.add(chiaveDi(s));
  }

  // Una scheda che per qualunque motivo non e' stata normalizzata deve
  // comunque rispettare il comando esplicito dell'utente nel fallback.
  for (const s of lista) {
    const k = chiaveContenuto(s?.url || '');
    if (k && vecchi.has(k)) buttate.add(chiaveDi(s));
  }

  return { hidden, buttate, vecchi };
}

/**
 * ORDINA GLI ARTICOLI col motore nuovo.
 * Riceve le schede di oggi e restituisce QUELLE STESSE ISTANZE.
 */
export function ordinaArticoli(schede, {
  prefs = null,
  miaLingua = 'it',
  query = '',
  adesso = Date.now(),
} = {}) {
  const lista = Array.isArray(schede) ? schede.filter(Boolean) : [];
  if (lista.length < 2) return lista;

  try {
    const candidati = [];
    const originali = new Map();

    for (const s of lista) {
      const topic = topicDallaDomanda(s?.seme || '');
      const [c] = normalizza({ argomenti: [s] }, { topic, query: s?.seme || '' });
      if (!c) continue;
      candidati.push(c);
      originali.set(c.id, s);
    }
    if (candidati.length < 2) return lista;

    const { hidden, buttate, vecchi: nascosti } = nascostiPerMotore(lista, candidati, originali, prefs);

    const classificati = rankMondoCandidates({
      candidates: candidati,
      profile: profileDaPrefs(prefs),
      memory: memoryDaPrefs(prefs),
      settings: settingsDaPrefs(prefs),
      session: { currentQuery: query || null, hidden },
      now: adesso,
    });
    const sequenza = mondoDirector(classificati, { miaLingua, quanti: classificati.length });

    const fuori = [];
    const visti = new Set();

    for (const x of sequenza) {
      const s = originali.get(x.content.id);
      if (!s || visti.has(x.content.id)) continue;

      // Difesa doppia: normalmente il Ranker l'ha gia tolto. Se una
      // futura normalizzazione cambia chiave, il comando dell'utente
      // continua comunque a vincere qui.
      const k = chiaveContenuto(s?.url || '');
      if ((k && nascosti.has(k)) || buttate.has(chiaveDi(s))) continue;

      visti.add(x.content.id);
      const internazionale = !!x.content.language
        && x.content.language !== String(miaLingua || 'it').slice(0, 2).toLowerCase();

      // NON `{ ...s }`: la lista dei segnali collettivi controlla
      // intenzionalmente l'identita degli oggetti per evitare che una
      // risposta asincrona vecchia riordini un giornale nuovo.
      s.motivo = motivoVecchio(x.reasons, { internazionale });
      s.reasons = x.reasons;
      fuori.push(s);
    }

    // Nessuna scheda si perde. Tornano solo quelle che il motore non ha
    // trattato; quelle nascoste restano fuori per decisione esplicita.
    const presenti = new Set(fuori.map(chiaveDi));
    for (const s of lista) {
      const k = chiaveDi(s);
      if (buttate.has(k)) continue;
      const nascosta = chiaveContenuto(s?.url || '');
      if (nascosta && nascosti.has(nascosta)) continue;
      if (!presenti.has(k)) {
        presenti.add(k);
        fuori.push(s);
      }
    }
    return fuori;
  } catch {
    return lista;
  }
}

/**
 * IL VECCHIO ACCANTO AL NUOVO: misura cosa e' cambiato senza scegliere.
 */
export function confronta(vecchio, nuovo) {
  const chiave = (x) => x?.id || x?.url || x?.titolo || '';
  const a = (Array.isArray(vecchio) ? vecchio : []).map(chiave).filter(Boolean);
  const b = (Array.isArray(nuovo) ? nuovo : []).map(chiave).filter(Boolean);
  const posA = new Map(a.map((k, i) => [k, i]));
  const perse = a.filter((k) => !b.includes(k));
  const inventate = b.filter((k) => !posA.has(k));
  let spostamento = 0;
  let mosse = 0;
  b.forEach((k, i) => {
    if (!posA.has(k)) return;
    const d = Math.abs(posA.get(k) - i);
    spostamento += d;
    if (d > 0) mosse += 1;
  });
  return {
    quante: b.length,
    perse: perse.length,
    inventate: inventate.length,
    mosse,
    spostamentoMedio: b.length ? Number((spostamento / b.length).toFixed(2)) : 0,
    stessaTesta: a[0] && a[0] === b[0],
  };
}
