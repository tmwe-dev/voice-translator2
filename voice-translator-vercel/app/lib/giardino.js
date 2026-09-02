// ═══════════════════════════════════════════════════════════════
// IL GIARDINO — le ricerche sono semi, e i semi fanno rami.
//
// b.541, dal disegno di Luca:
//   «le mie ricerche devono farti allargare automaticamente le ricerche.
//    e naturalmente includere con priorita in questo caso tom cruise e il
//    chelsea, ma devi allargare a altri attori che magari fanno film
//    simili, altri contenuti sul cinema, su altre squadre in champions
//    league oppure risultati eventi. in sostanza le ricerche sono un seme
//    che fa crescere una pianta in una determinata direzione. la pianta
//    nasce da un seme che sviluppa rami in tutte le direzioni e ogni ramo
//    ne crea altri quando ha esaurito le informazioni e i contenuti,
//    ramificando seguendo logiche che derivano dalle azioni utente e gli
//    interessi globali, separati in ordine per origine e per lingua e
//    posizione geografica.»
//
// b.585 — «Oggi voglio» non crea un altro profilo e non un altro motore.
// E' un seme temporaneo con una scadenza: finche e valido viene prima di
// tutto, poi sparisce da solo e restano preferiti, memoria e mondo.
// ═══════════════════════════════════════════════════════════════

/** Le famiglie di ramo. L'ordine conta: si alterna per non fare monocultura. */
const TIPI_RAMO = ['stesso', 'vicino', 'ambito', 'evento', 'luogo'];

export function normalizza(q) {
  return String(q || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** La richiesta temporanea e viva solo fino alla sua scadenza. */
export function preferenzaOggi(prefs, adesso = Date.now()) {
  const o = prefs?.mondoOggi;
  const q = String(o?.q || '').trim().slice(0, 80);
  const scade = Number(o?.scade) || 0;
  return q && scade > adesso ? q : '';
}

/**
 * I SEMI dell'utente, in ordine di priorita:
 *   0. «Oggi voglio» ancora valido            — vale adesso, non per sempre
 *   1. le ricerche salvate con la stella      — le ha scelte lui
 *   2. le ultime ricerche / interessi         — quello che ha fatto/scelto
 *   3. i giri predefiniti                     — il ripiego per non essere vuoti
 *
 * Niente doppioni: se «musica» e anche un preferito resta una sola volta,
 * con la priorita temporanea piu alta finche dura la richiesta di oggi.
 */
export function semiDi(prefs, predefinite = [], oggi = '') {
  const visti = new Set();
  const fuori = [];
  const aggiungi = (q, origine, peso) => {
    const n = normalizza(q);
    if (!n || visti.has(n)) return;
    visti.add(n);
    fuori.push({ query: String(q).trim(), origine, peso });
  };
  aggiungi(oggi || preferenzaOggi(prefs), 'oggi', 4);
  for (const r of (Array.isArray(prefs?.ricerchePreferite) ? prefs.ricerchePreferite : [])) aggiungi(r?.q, 'preferita', 3);
  for (const r of (Array.isArray(prefs?.ricercheRecenti) ? prefs.ricercheRecenti : [])) aggiungi(r?.q, 'recente', 2);
  // b.562 — GLI INTERESSI SCELTI ALL'INGRESSO sono semi a tutti gli
  // effetti: e' il motivo per cui li chiediamo. Stanno accanto alle
  // ricerche recenti (stesso peso) e prima delle predefinite, che sono
  // il ripiego per chi non ha scelto niente.
  for (const s of (Array.isArray(prefs?.semiInteressi) ? prefs.semiInteressi : [])) aggiungi(s?.query, 'interesse', 2);
  for (const g of predefinite) aggiungi(g?.query, 'predefinita', 1);
  return fuori;
}

/**
 * UN RAMO E' ESAURITO quando non porta piu roba nuova: o non ha dato
 * niente, o quel poco che ha dato lo avevamo gia. La soglia e bassa
 * apposta — meglio ramificare presto che far girare a vuoto lo
 * scorrimento (e' la regola «quando ha esaurito le informazioni»).
 */
export function esaurito({ trovati = 0, nuovi = 0 } = {}) {
  if (trovati === 0) return true;
  return nuovi <= 1;
}

/**
 * LA PIANTA. Dato lo stato del giardino, dice QUALE query si pianta
 * adesso. Le regole, nell'ordine:
 *   1. prima tutti i SEMI dell'utente, per peso;
 *   2. poi i RAMI, alternando le famiglie e il seme di provenienza;
 *   3. mai una query gia usata;
 *   4. i rami di un seme piu importante vengono prima.
 */
export function prossimaQuery({ semi = [], rami = [], usate = [] } = {}) {
  const fatte = new Set(usate.map(normalizza));

  const semiLiberi = [...semi]
    .filter((s) => !fatte.has(normalizza(s.query)))
    .sort((a, b) => (b.peso || 0) - (a.peso || 0));
  if (semiLiberi.length) return { ...semiLiberi[0], livello: 0 };

  const liberi = rami.filter((r) => r && r.query && !fatte.has(normalizza(r.query)));
  if (!liberi.length) return null;

  // quante volte ho gia pescato da ogni famiglia e da ogni seme: si
  // sceglie il ramo che pareggia il conto, non il primo della lista.
  const contaTipo = new Map();
  const contaSeme = new Map();
  for (const u of usate) {
    const r = rami.find((x) => normalizza(x.query) === normalizza(u));
    if (!r) continue;
    contaTipo.set(r.tipo, (contaTipo.get(r.tipo) || 0) + 1);
    contaSeme.set(normalizza(r.seme), (contaSeme.get(normalizza(r.seme)) || 0) + 1);
  }
  const pesoSeme = new Map(semi.map((s) => [normalizza(s.query), s.peso || 0]));

  const punteggio = (r) => {
    const quantoTipo = contaTipo.get(r.tipo) || 0;
    const quantoSeme = contaSeme.get(normalizza(r.seme)) || 0;
    const importanza = pesoSeme.get(normalizza(r.seme)) || 0;
    const profondita = r.livello || 1;
    return (quantoTipo * 10) + (quantoSeme * 6) + (profondita * 3) - (importanza * 2);
  };
  return [...liberi].sort((a, b) => punteggio(a) - punteggio(b) || TIPI_RAMO.indexOf(a.tipo) - TIPI_RAMO.indexOf(b.tipo))[0];
}

/**
 * Ripulisce i rami che tornano dal modello: niente vuoti, niente
 * doppioni, niente query lunghissime, niente famiglie inventate, e mai
 * un ramo uguale al proprio seme (sarebbe girare in tondo).
 */
export function sanaRami(grezzi, seme, livello = 1) {
  const semeN = normalizza(seme);
  const visti = new Set([semeN]);
  const fuori = [];
  for (const r of (Array.isArray(grezzi) ? grezzi : [])) {
    const query = String(r?.query || '').trim().slice(0, 80);
    const n = normalizza(query);
    if (!n || visti.has(n)) continue;
    const tipo = TIPI_RAMO.includes(r?.tipo) ? r.tipo : 'vicino';
    visti.add(n);
    fuori.push({ query, tipo, seme: String(seme || '').trim(), livello });
    if (fuori.length >= 8) break;
  }
  return fuori;
}
