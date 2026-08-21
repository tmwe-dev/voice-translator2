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
    fontSize: 10.5, fontWeight: 700, color: C.textMuted,
    letterSpacing: 0.2, whiteSpace: 'nowrap',
  };
}

/** Il punto separatore fra le etichette: uno solo, sempre uguale. */
export const PUNTO = '·';
