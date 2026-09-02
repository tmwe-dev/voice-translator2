// ═══════════════════════════════════════════════════════════════
// LA BACHECA E I CONTENUTI NASCOSTI (b.552)
//
// Due ordini di Luca, arrivati insieme e legati dalla stessa idea:
//
//   «attiva un tasto NON MOSTRARE PIU CONTENUTO all'utente, perche gia
//    visto e non si desidera rivederlo. Oppure un tasto PREFERITO, da
//    tenere in una BACHECA che devi mettere nella sidebar. Ordinabile e
//    con miniatura.»
//
// Sono i due pollici del feed: uno butta via, l'altro mette da parte.
// Senza il primo il giornale ripropone in eterno cio che hai gia
// scartato; senza il secondo, cio che ti interessa scorre via e non
// torna piu.
//
// DOVE VIVONO: nelle preferenze della persona (`prefs`), che e' gia il
// posto dove vivono le ricerche recenti e i temi preferiti — quindi
// seguono la persona da un apparecchio all'altro senza inventare una
// tabella nuova. La chiave e' quella di `gradimento.js`
// (`chiaveContenuto`): lo stesso indirizzo con o senza i codici di
// tracciamento e' lo stesso contenuto, e non deve tornare due volte.
//
// I TETTI: la bacheca tiene 60 schede, i nascosti 400 indirizzi. Non
// per avarizia: le preferenze viaggiano ad ogni salvataggio, e una
// lista che cresce senza fine finirebbe per rallentare tutto il resto.
// Oltre il tetto esce il piu vecchio — e nella bacheca, dove l'ordine
// lo decide la persona, esce l'ultimo della fila.
// ═══════════════════════════════════════════════════════════════
import { chiaveContenuto } from './gradimento.js';

export const TETTO_BACHECA = 60;
const TETTO_NASCOSTI = 400;

const elenco = (x) => (Array.isArray(x) ? x : []);

/** Le schede messe da parte, nell'ordine deciso dalla persona. */
export function bachecaDi(prefs) {
  return elenco(prefs?.bacheca).filter((v) => v && v.chiave);
}

/** Gli indirizzi che non si vogliono piu vedere. */
export function nascostiDi(prefs) {
  return elenco(prefs?.nascosti).filter(Boolean);
}

/** Vera se questo contenuto e' gia in bacheca. */
export function inBacheca(prefs, url) {
  const k = chiaveContenuto(url);
  return !!k && bachecaDi(prefs).some((v) => v.chiave === k);
}

/** Vera se questo contenuto e' stato messo via per sempre. */
export function eNascosto(prefs, url) {
  const k = chiaveContenuto(url);
  return !!k && nascostiDi(prefs).includes(k);
}

/**
 * Mette da parte una scheda (o la toglie, se c'e' gia).
 * Ritorna le preferenze NUOVE: chi chiama le salva come vuole.
 */
export function giraBacheca(prefs, scheda) {
  const k = chiaveContenuto(scheda?.url);
  if (!k) return prefs;
  const ora = bachecaDi(prefs);
  if (ora.some((v) => v.chiave === k)) {
    return { ...prefs, bacheca: ora.filter((v) => v.chiave !== k) };
  }
  const voce = {
    chiave: k,
    url: scheda.url || '',
    titolo: String(scheda.titolo || '').slice(0, 160),
    img: scheda.immagine || scheda.miniatura || '',
    fonte: scheda.fonte || scheda.canale || scheda.fonti?.[0]?.fonte || '',
    tipo: scheda.tipo || (scheda.canale ? 'video' : 'articolo'),
    quando: Date.now(),
  };
  // in cima: l'ultima cosa messa da parte e' quella che si cerca per prima
  return { ...prefs, bacheca: [voce, ...ora].slice(0, TETTO_BACHECA) };
}

/** Sposta una scheda in su o in giu nella bacheca (ordinabile, come chiesto). */
export function spostaInBacheca(prefs, chiave, verso) {
  const ora = [...bachecaDi(prefs)];
  const i = ora.findIndex((v) => v.chiave === chiave);
  const j = i + (verso === 'su' ? -1 : 1);
  if (i < 0 || j < 0 || j >= ora.length) return prefs;
  [ora[i], ora[j]] = [ora[j], ora[i]];
  return { ...prefs, bacheca: ora };
}

/** Toglie una scheda dalla bacheca. */
export function togliDaBacheca(prefs, chiave) {
  return { ...prefs, bacheca: bachecaDi(prefs).filter((v) => v.chiave !== chiave) };
}

/**
 * «Non mostrarmelo piu».
 * Nasconde anche cio che e' in bacheca? No: se una cosa l'hai messa da
 * parte e poi la nascondi, esce dalla bacheca — altrimenti resterebbe
 * appesa in un elenco che non puoi piu aprire dal feed.
 */
export function nascondi(prefs, url) {
  const k = chiaveContenuto(url);
  if (!k) return prefs;
  const ora = nascostiDi(prefs);
  const nuovi = ora.includes(k) ? ora : [k, ...ora].slice(0, TETTO_NASCOSTI);
  return { ...prefs, nascosti: nuovi, bacheca: bachecaDi(prefs).filter((v) => v.chiave !== k) };
}

/** Ci ripenso: torna a mostrarmelo. */
export function rimostra(prefs, chiave) {
  return { ...prefs, nascosti: nascostiDi(prefs).filter((k) => k !== chiave) };
}

/**
 * Toglie dal mazzo cio che e' stato nascosto.
 * SI FILTRA QUI E SOLO QUI: il feed non deve sapere come sono fatti i
 * nascosti, e chi cerca non deve ricordarsi di filtrare.
 */
export function senzaNascosti(lista, prefs) {
  const via = new Set(nascostiDi(prefs));
  if (!via.size) return Array.isArray(lista) ? lista : [];
  return (Array.isArray(lista) ? lista : []).filter((x) => {
    const k = chiaveContenuto(x?.url || (x?.id ? `youtube.com/watch?v=${x.id}` : ''));
    return !k || !via.has(k);
  });
}
