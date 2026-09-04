// ═══════════════════════════════════════════════════════════════
// DA QUALE PAESE ARRIVA QUESTA NOTIZIA (b.517)
//
// BUG PRE-ESISTENTE, mio, di b.515, trovato rileggendo il lavoro di
// oggi su segnalazione di Luca («globo hai dimenticato le modifiche»).
// La funzione «il pianeta vola verso la notizia prima di mostrarla»
// e stata scritta, spedita e dichiarata fatta — ma non e MAI scattata
// in produzione. In FinestraSulMondo.js il paese della notizia era:
//
//     paeseRicerca: interessi.length ? null : paese
//
// cioe: se l'utente ha degli interessi (il modo normale, a rotazione)
// il paese e `null` e il pianeta non si muove; se NON li ha, il paese
// e quello che l'utente aveva GIA scelto a mano — cioe dove il globo
// si trova gia. In tutti e due i rami il volo non esiste. Una funzione
// viva nel codice e morta all'uso: esattamente la «feature orfana» che
// il protocollo di audit dice di trattare come un bug P0.
//
// La notizia non porta con se' un paese, ma porta le sue FONTI, e una
// fonte ha un dominio. Il dominio, quasi sempre, dice il paese: il
// suffisso nazionale (.it, .fr, .jp) lo dice da solo, e per le grandi
// testate con dominio internazionale (.com) serve un elenco a mano —
// corto, perche' sono poche e cambiano di rado.
//
// Non si indovina mai a caso: se il paese non e riconosciuto si torna
// `null`, e il pianeta resta dov'e. Meglio fermo che nel posto
// sbagliato — un globo che vola in Groenlandia per una notizia di
// Napoli e peggio di un globo che non si muove.
// ═══════════════════════════════════════════════════════════════

// Le grandi testate che NON hanno un suffisso nazionale. Solo quelle
// che compaiono davvero fra le fonti: l'elenco si allunga quando serve,
// non si prova a coprire il mondo in anticipo.
const TESTATE = {
  'bbc.com': 'GB', 'bbc.co.uk': 'GB', 'theguardian.com': 'GB', 'reuters.com': 'GB',
  'ft.com': 'GB', 'independent.co.uk': 'GB', 'telegraph.co.uk': 'GB', 'sky.com': 'GB',
  'cnn.com': 'US', 'nytimes.com': 'US', 'washingtonpost.com': 'US', 'wsj.com': 'US',
  'bloomberg.com': 'US', 'apnews.com': 'US', 'nbcnews.com': 'US', 'cbsnews.com': 'US',
  'abcnews.go.com': 'US', 'foxnews.com': 'US', 'usatoday.com': 'US', 'npr.org': 'US',
  'politico.com': 'US', 'axios.com': 'US', 'time.com': 'US', 'newsweek.com': 'US',
  'forbes.com': 'US', 'cnbc.com': 'US', 'theverge.com': 'US', 'wired.com': 'US',
  'techcrunch.com': 'US', 'espn.com': 'US',
  'lemonde.fr': 'FR', 'lefigaro.fr': 'FR', 'france24.com': 'FR', 'rfi.fr': 'FR', 'afp.com': 'FR',
  'spiegel.de': 'DE', 'zeit.de': 'DE', 'faz.net': 'DE', 'dw.com': 'DE', 'welt.de': 'DE',
  'elpais.com': 'ES', 'elmundo.es': 'ES', 'abc.es': 'ES', 'lavanguardia.com': 'ES',
  'corriere.it': 'IT', 'repubblica.it': 'IT', 'lastampa.it': 'IT', 'ansa.it': 'IT',
  'ilsole24ore.com': 'IT', 'calciomercato.com': 'IT', 'gazzetta.it': 'IT', 'vogue.it': 'IT',
  'aljazeera.com': 'QA', 'alarabiya.net': 'AE', 'timesofindia.indiatimes.com': 'IN',
  'indiatimes.com': 'IN', 'hindustantimes.com': 'IN', 'ndtv.com': 'IN',
  'scmp.com': 'HK', 'japantimes.co.jp': 'JP', 'kyodonews.net': 'JP', 'nhk.or.jp': 'JP',
  'koreaherald.com': 'KR', 'straitstimes.com': 'SG', 'channelnewsasia.com': 'SG',
  'globo.com': 'BR', 'folha.uol.com.br': 'BR', 'uol.com.br': 'BR',
  'clarin.com': 'AR', 'eltiempo.com': 'CO', 'euronews.com': 'BE', 'politico.eu': 'BE',
  'cbc.ca': 'CA', 'abc.net.au': 'AU', 'smh.com.au': 'AU', 'nzherald.co.nz': 'NZ',
  'rt.com': 'RU', 'tass.com': 'RU', 'kyivindependent.com': 'UA', 'haaretz.com': 'IL',
  'timesofisrael.com': 'IL', 'jpost.com': 'IL', 'hurriyetdailynews.com': 'TR',
};

// b.623 — GLI AGGREGATORI NON SONO TESTATE, E NON DICONO IL PAESE.
// Collaudo dal vivo: un articolo del Corriere della Sera ripubblicato
// su MSN portava la bandiera degli Stati Uniti, perche' 'msn.com' era
// in TESTATE come 'US'. Ma msn.com (come yahoo.com) non e' una
// redazione: e' una vetrina che ospita le altre, e il suo dominio dice
// solo dove l'articolo e' RIPUBBLICATO, mai da dove viene. Sono
// esattamente i «suffissi bugiardi» qui sotto, in forma di dominio: si
// tolgono dalla tabella e si elencano qui, cosi il paese resta null e
// sopra la foto non compare nessuna bandiera. La regola scritta in
// testa a questo file — «mai una bandiera indovinata», «meglio fermo
// che nel posto sbagliato» — vale anche per loro.
const AGGREGATORI = new Set(['msn.com', 'yahoo.com', 'news.google.com', 'flipboard.com']);

// Suffissi nazionali che NON sono il paese che sembrano, o che sono
// generici: si lasciano fuori invece di mandare il globo a caso.
// .tv = Tuvalu ma la usano le televisioni; .io = territorio britannico
// dell'oceano Indiano ma la usano le startup; .me = Montenegro, ecc.
const SUFFISSI_BUGIARDI = new Set(['tv', 'io', 'me', 'co', 'cc', 'ai', 'to', 'ly', 'fm', 'am', 'st', 'sh', 'gg', 'la', 'ws', 'nu']);

// I suffissi validi sono quelli dei paesi che il globo conosce: si
// passa l'elenco dall'esterno (PAESI) per non duplicare la tabella.
export function paeseDaDominio(dominio, codiciNoti) {
  const d = String(dominio || '').trim().toLowerCase().replace(/^www\./, '');
  if (!d) return null;

  // b.623 — prima di tutto: un aggregatore non dice il paese di niente.
  if (AGGREGATORI.has(d)) return null;
  for (const a of AGGREGATORI) {
    if (d.endsWith('.' + a)) return null;
  }

  if (TESTATE[d]) return TESTATE[d];
  // sottodominio di una testata nota (es. edition.cnn.com)
  for (const chiave of Object.keys(TESTATE)) {
    if (d.endsWith('.' + chiave)) return TESTATE[chiave];
  }

  const pezzi = d.split('.');
  const ultimo = pezzi[pezzi.length - 1];
  if (!/^[a-z]{2}$/.test(ultimo)) return null;
  if (SUFFISSI_BUGIARDI.has(ultimo)) return null;

  const codice = ultimo === 'uk' ? 'GB' : ultimo.toUpperCase();
  if (codiciNoti && !codiciNoti.has(codice)) return null;
  return codice;
}

/**
 * Il paese di una notizia, letto dalle sue fonti.
 * Vince la PRIMA fonte riconosciuta: e quella principale del gruppo
 * (vedi raggruppa.js, che mette per prima la fonte piu autorevole).
 */
export function paeseDellaNotizia(argomento, codiciNoti) {
  const fonti = Array.isArray(argomento?.fonti) ? argomento.fonti : [];
  for (const f of fonti) {
    const p = paeseDaDominio(f?.dominio || f?.fonte, codiciNoti);
    if (p) return p;
  }
  // ultimo tentativo: il link dell'articolo stesso
  try {
    return paeseDaDominio(new URL(argomento?.url).hostname, codiciNoti);
  } catch { return null; }
}
