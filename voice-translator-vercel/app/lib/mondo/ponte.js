// ═══════════════════════════════════════════════════════════════
// IL PONTE — FASE 5: SI COLLEGA, ARTICOLI PER PRIMI (b.577)
//
// Documento di Luca, capitolo 40: si procede a fasi, e la 5 dice
// «collegare articoli». Questo file e' l'unico punto in cui il motore
// nuovo tocca il mondo vecchio, ed e' fatto apposta perche' sia
// l'unico: dentro `lib/mondo/` nessuno sa che esistono le `prefs`,
// fuori nessuno sa che esiste un `ContentCandidate`.
//
// COSA GARANTISCE, e sono le due promesse su cui si puo tornare
// indietro in una riga:
//   · ESCONO LE STESSE SCHEDE CHE SONO ENTRATE, in altro ordine.
//     Non oggetti nuovi: le schede vere, con dentro tutto quello che la
//     pagina gia sa disegnare. Il motore ORDINA, non riscrive — e non
//     puo perdere per strada una scheda ne inventarne una.
//   · IL «PERCHE'» PARLA LA LINGUA DI PRIMA. I motivi nuovi
//     (reasons.js) vengono tradotti nei codici che la schermata
//     conosce gia (`perCercato`, `perSeme`, `perMondo`, `perSorpresa`,
//     `perRamo`), cosi la FASE 5 non tocca un solo pixel — che e'
//     esattamente quello che il documento chiede.
//
// Import: i modelli puri di questa cartella, piu i due helper del
// mondo vecchio che sanno cosa hai nascosto. Il ponte puo conoscere
// tutte e due le rive: e' il suo mestiere.
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

/**
 * I motivi nuovi, detti con le parole che la schermata conosce gia.
 * Il primo motivo (il piu forte, ordinato da reasons.js) comanda.
 */
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

/**
 * ORDINA GLI ARTICOLI col motore nuovo.
 *
 * Riceve le schede come sono oggi e le ritorna come sono oggi: stessi
 * oggetti, ordine nuovo, piu il campo `motivo` che la scheda gia sa
 * mostrare. Se qualcosa va storto — QUALSIASI cosa — si ritorna la
 * lista com'era: un motore che si rompe non deve poter svuotare il
 * giornale. E' la regola imparata a caro prezzo oggi: il nero non e'
 * uno stato.
 */
/** La chiave con cui riconosciamo una scheda fra le due rive. */
function chiaveDi(s) {
  return s?.id || s?.url || s?.titolo || '';
}

export function ordinaArticoli(schede, {
  prefs = null,
  miaLingua = 'it',
  query = '',
  adesso = Date.now(),
} = {}) {
  const lista = Array.isArray(schede) ? schede.filter(Boolean) : [];
  if (lista.length < 2) return lista;
  try {
    // ogni scheda porta con se il seme che l'ha prodotta: da li si
    // risale al topic senza indovinare (queries.js, strada a ritroso)
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

    const nascosti = nascostiDi(prefs).map(String);
    const classificati = rankMondoCandidates({
      candidates: candidati,
      profile: profileDaPrefs(prefs),
      memory: memoryDaPrefs(prefs),
      settings: settingsDaPrefs(prefs),
      session: { currentQuery: query || null, hidden: [] },
      now: adesso,
    });
    const sequenza = mondoDirector(classificati, { miaLingua, quanti: candidati.length });

    const fuori = [];
    const visti = new Set();
    // ═══ IL NASCOSTO E' L'UNICA COSA CHE ESCE DAVVERO ═══
    // Regola 9 del documento. E qui c'e' la trappola in cui sono
    // caduto scrivendo questo file: piu sotto c'e' una rete di
    // sicurezza che rimette in coda le schede che il motore non ha
    // trattato («nessuna scheda si perde»). Quella rete, senza questo
    // elenco, ripescava anche le nascoste — che rientravano dalla porta
    // di servizio, in fondo alla pagina.
    // Una rete di sicurezza che non sa cosa e' stato buttato via di
    // proposito non e' una rete: e' un secchio della spazzatura
    // rovesciato all'indietro.
    const buttate = new Set();
    for (const x of sequenza) {
      const s = originali.get(x.content.id);
      if (!s || visti.has(x.content.id)) continue;
      // il nascosto si toglie qui, con la stessa chiave del mondo
      // vecchio: due modi di calcolare la stessa cosa sono due verita,
      // ed e' esattamente cio che il documento vieta (regola 3)
      const k = chiaveContenuto(s?.url || '');
      if (k && nascosti.includes(k)) { buttate.add(chiaveDi(s)); continue; }
      visti.add(x.content.id);
      const internazionale = !!x.content.language
        && x.content.language !== String(miaLingua || 'it').slice(0, 2).toLowerCase();
      fuori.push({ ...s, motivo: motivoVecchio(x.reasons, { internazionale }), reasons: x.reasons });
    }
    // nessuna scheda si perde: quelle che il motore non ha VISTO
    // tornano in coda nell'ordine di prima. Quelle che ha buttato di
    // proposito, no.
    for (const s of lista) {
      const k = chiaveDi(s);
      if (buttate.has(k)) continue;
      const nascosta = chiaveContenuto(s?.url || '');
      if (nascosta && nascosti.includes(nascosta)) continue;
      if (!fuori.some((y) => chiaveDi(y) === k)) fuori.push(s);
    }
    return fuori;
  } catch {
    return lista;   // un motore che si rompe non svuota il giornale
  }
}

/**
 * IL VECCHIO ACCANTO AL NUOVO (capitolo 40: «mantenere temporaneamente
 * il vecchio ranking come confronto»).
 *
 * Non serve a scegliere: serve a poter DIRE cosa e' cambiato, con dei
 * numeri, invece di guardare due liste e farsi un'idea. Quante schede
 * si sono spostate, di quanti posti, e — la domanda che conta — se
 * qualcuna e' sparita o comparsa dal nulla.
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
