// ═══════════════════════════════════════════════════════════════
// IL METODO DELLE SCHEDE DI MONDO — quello che una scheda deve dire
// prima che qualcuno la tocchi.
//
// b.363, dall'analisi chiesta da Luca. L'obiettivo di News e Stanze e
// lo stesso: chi apre deve capire IN TRE SECONDI, senza toccare niente,
// di cosa si parla, se lo riguarda, e se vale la pena entrarci.
//
// Prima una scheda diceva quattro cose — titolo, nome, un numero nudo e
// una freccia — e non bastavano per decidere: bisognava APRIRE per
// sapere se si voleva aprire. Ed e li che una persona si perde.
//
// Le cose che servono ci sono TUTTE gia nei dati; mancava solo che la
// scheda le mostrasse:
//
//   DA DOVE   la bandiera del paese (o della lingua, per le stanze)
//   DI COSA   l'argomento
//   QUANDO    "ora", "3 ore fa", "ieri" — senza data non e una notizia
//   CHI       la fonte per un articolo, chi ospita per una stanza
//   COS'E'    articolo, video, post: un video non si legge, si guarda,
//             e va detto PRIMA di aprire
//   QUANTA VITA  commenti per un articolo, persone dentro per una
//                stanza. E il segnale piu forte per decidere di entrare:
//                dice se dentro c'e una conversazione o un deserto.
//
// Questo file tiene quel metodo in un posto solo, cosi News e Stanze
// sono sorelle e non due cose che si somigliano per caso.
// ═══════════════════════════════════════════════════════════════

/**
 * La bandiera di un paese dal suo codice a due lettere. Si costruisce
 * dalle due lettere stesse: ogni lettera ha una gemella "da bandiera",
 * e messe vicine il telefono le disegna. Nessun elenco da mantenere.
 */
export function bandieraPaese(codice) {
  const c = String(codice || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return '';
  return String.fromCodePoint(...[...c].map((l) => 127397 + l.charCodeAt(0)));
}

/**
 * IL NOME DI UN PAESE, nella lingua di chi guarda.
 *
 * b.398 — non si scrivono duecento nomi di paese per trentotto lingue:
 * li sa gia il telefono, ed e l'unico modo perche un cinese legga
 * «意大利» e un tedesco «Italien» senza che nessuno traduca niente.
 * Se il telefono non sa farlo restano le due lettere, che sono brutte
 * ma vere. Lo stesso trucco e gia usato nelle preferenze di Mondo.
 */
export function nomePaese(codice) {
  const c = String(codice || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return '';
  try { return new Intl.DisplayNames(undefined, { type: 'region' }).of(c) || c; }
  catch { return c; }
}

/**
 * QUANDO, in poche lettere. Non "23/07/2026 14:12": quello si legge, non
 * si capisce. Serve la distanza da adesso, che e l'unica cosa che conta
 * per decidere se una notizia e ancora una notizia.
 */
export function quando(data, L) {
  if (!data) return '';
  const t = new Date(data).getTime();
  if (!Number.isFinite(t)) return '';
  const min = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (min < 2) return L ? L('justNowWord') : 'ora';
  if (min < 60) return `${min}m`;
  const ore = Math.round(min / 60);
  if (ore < 24) return `${ore}h`;
  const giorni = Math.round(ore / 24);
  if (giorni === 1) return L ? L('yesterdayWord') : 'ieri';
  if (giorni < 7) return `${giorni}g`;
  const sett = Math.round(giorni / 7);
  if (sett < 5) return `${sett}sett`;
  return `${Math.round(giorni / 30)}m`;
}

/**
 * COS'E': articolo, video o post. Si guarda prima il tipo dichiarato,
 * poi — se manca — l'indirizzo, che spesso lo dice da solo.
 */
export function tipoContenuto(media) {
  if (!media || !media.url) return null;
  const dichiarato = String(media.tipo || '').toLowerCase();
  if (dichiarato === 'video' || dichiarato === 'articolo' || dichiarato === 'post') return dichiarato;
  const u = String(media.url).toLowerCase();
  if (/youtube\.|youtu\.be|vimeo\.|tiktok\.|\/reel|\/shorts/.test(u)) return 'video';
  if (/instagram\.|facebook\.|x\.com|twitter\.|threads\./.test(u)) return 'post';
  return 'articolo';
}

/** Il nome della fonte: quello dichiarato, o il dominio ripulito. */
export function fonteDi(media) {
  if (!media) return '';
  if (media.source) return String(media.source).slice(0, 40);
  try { return new URL(media.url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

/**
 * QUANTA VITA: il numero, e se merita di essere acceso. Sopra una certa
 * soglia una discussione non e piu "aperta", e "viva": quella e
 * l'informazione, non il numero in se.
 */
export function viva(quanti, soglia = 3) {
  const n = Number(quanti) || 0;
  return { n, accesa: n >= soglia };
}

/** I colori delle etichette, uguali per News e Stanze. */
export function stileEtichetta(C) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    fontSize: 10.5, fontWeight: 500, color: C.textMuted,
    letterSpacing: 0.2, whiteSpace: 'nowrap',
  };
}

/** Il punto separatore fra le etichette: uno solo, sempre uguale. */
export const PUNTO = '·';

/**
 * IL PAESE DA UNA LINGUA — un ripiego, non una verita.
 *
 * b.363. Le stanze portano la LINGUA di chi ospita, non il LUOGO: sono
 * due cose diverse (un giapponese a San Paolo parla giapponese e sta in
 * Brasile). Finche le stanze non porteranno il paese, per disegnare i
 * voli sul pianeta serve un paese qualsiasi, e il piu probabile e quello
 * dove quella lingua e di casa. Vale per i puntini e per le rotte: mai
 * per dire a qualcuno "sei in questo paese".
 */
const PAESE_DI_CASA = {
  it: 'IT', en: 'US', 'en-GB': 'GB', es: 'ES', fr: 'FR', de: 'DE', pt: 'BR',
  ru: 'RU', ja: 'JP', zh: 'CN', ko: 'KR', ar: 'AE', hi: 'IN', tr: 'TR',
  pl: 'PL', nl: 'NL', sv: 'SE', vi: 'VN', th: 'TH', id: 'ID', el: 'GR',
  he: 'IL', uk: 'UA', cs: 'CZ', ro: 'RO', hu: 'HU', da: 'DK', nb: 'NO',
  fi: 'FI', sk: 'SK', bg: 'BG', hr: 'HR', ca: 'ES', ms: 'MY', fil: 'PH',
  sw: 'KE', bn: 'BD', ta: 'IN', af: 'ZA',
};

/**
 * b.386 — LA STRADA INVERSA: dal paese alla lingua che ci si parla.
 *
 * Serve perche le STANZE portano la lingua, non il luogo (e giusto cosi:
 * una stanza in portoghese vale per il Brasile e per il Portogallo). Ma
 * toccando un paese sul pianeta la persona si aspetta di vedere le
 * stanze di quel posto — e l'unico modo onesto di avvicinarsi e la
 * lingua che ci si parla.
 *
 * Dove un paese ne parla piu di una vince quella che si sente di piu:
 * e un'approssimazione, e va detto invece che spacciata per esattezza.
 */
export function linguaDelPaese(codice) {
  if (!codice) return null;
  const c = String(codice).toUpperCase();
  for (const [lingua, paese] of Object.entries(PAESE_DI_CASA)) {
    if (paese === c && !lingua.includes('-')) return lingua;
  }
  return null;
}

export function paeseDaLingua(lingua) {
  if (!lingua) return null;
  const l = String(lingua);
  return PAESE_DI_CASA[l] || PAESE_DI_CASA[l.split('-')[0]] || null;
}
