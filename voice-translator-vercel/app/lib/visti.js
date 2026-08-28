// ═══════════════════════════════════════════════════════════════
// QUELLO CHE HAI GIA VISTO (b.558)
//
// Collaudo di Luca: «quando rientro nel sistema mi riproponi in serie
// video. Non devi. Altrimenti ogni volta che entro vedo Beethoven».
//
// LA CAUSA. La memoria dei contenuti gia mostrati viveva dentro la
// pagina (`vistiRef`): serviva a non ripetere due volte la stessa cosa
// DENTRO una sessione, e faceva bene il suo lavoro. Ma ricaricando
// l'applicazione quella memoria nasceva vuota, la ricerca d'ingresso
// era la stessa e il motore — giustamente — rispondeva le stesse cose,
// nello stesso ordine. Risultato: Beethoven ogni volta.
//
// LA DIFFERENZA CON «NON MOSTRARE PIU» (bacheca.js), che e' importante:
//   · «non mostrare piu» e' una TUA decisione, vale per sempre, e quel
//     contenuto sparisce;
//   · «gia visto» e' un fatto, dura una settimana, e non fa sparire
//     niente: manda in fondo. Fra sette giorni quel video puo tornare,
//     ed e' giusto — un servizio che ti e' piaciuto a maggio puo
//     rivederlo a settembre.
//
// E NON SVUOTA MAI IL GIORNALE. Se hai visto tutto, rivedi tutto: una
// pagina vuota e' peggio di una ripetizione. Si ORDINA, non si filtra —
// la regola di casa, applicata anche qui.
//
// Vive sul telefono (non nelle preferenze che viaggiano): e' un fatto
// di questo apparecchio, cambia dieci volte al giorno, e non vale la
// pena mandarlo avanti e indietro dal server ad ogni scorrimento.
// ═══════════════════════════════════════════════════════════════
import { chiaveContenuto } from './gradimento.js';

const CASSETTO = 'vt-gia-visti';
export const VITA_VISTO = 7 * 24 * 3600 * 1000;   // una settimana, poi puo tornare
export const TETTO_VISTI = 600;

function leggi() {
  try {
    const grezzo = localStorage.getItem(CASSETTO);
    const dentro = grezzo ? JSON.parse(grezzo) : {};
    return dentro && typeof dentro === 'object' ? dentro : {};
  } catch { return {}; }   // senza memoria si ricomincia, non si rompe niente
}

function scrivi(mappa) {
  try { localStorage.setItem(CASSETTO, JSON.stringify(mappa)); } catch { /* memoria piena o negata */ }
}

/** Toglie cio che ha piu di una settimana e taglia i piu vecchi oltre il tetto. */
export function ripulisci(mappa, adesso = Date.now()) {
  const vivi = Object.entries(mappa || {}).filter(([, quando]) => adesso - quando < VITA_VISTO);
  vivi.sort((a, b) => b[1] - a[1]);
  return Object.fromEntries(vivi.slice(0, TETTO_VISTI));
}

/** La chiave di un contenuto, articolo o video che sia. */
export function chiaveDi(x) {
  if (!x) return '';
  const url = x.url || (x.id ? `youtube.com/watch?v=${x.id}` : '');
  return chiaveContenuto(url) || '';
}

/** L'hai guardato: si annota, con l'ora. */
export function segnaVisto(contenuto, adesso = Date.now()) {
  const k = chiaveDi(contenuto);
  if (!k) return;
  const mappa = leggi();
  mappa[k] = adesso;
  scrivi(ripulisci(mappa, adesso));
}

/** Le chiavi viste di recente. */
export function vistiDiRecente(adesso = Date.now()) {
  return new Set(Object.keys(ripulisci(leggi(), adesso)));
}

/**
 * IN FONDO, NON FUORI.
 * Cio che hai gia visto scivola in coda; il resto tiene il suo ordine.
 * Se hai visto tutto, torna tutto — nell'ordine di prima.
 */
export function primaIlNuovo(lista, visti) {
  const gia = visti instanceof Set ? visti : new Set(visti || []);
  if (!gia.size) return Array.isArray(lista) ? lista : [];
  const nuovi = [];
  const rivisti = [];
  for (const x of (Array.isArray(lista) ? lista : [])) {
    const k = chiaveDi(x);
    (k && gia.has(k) ? rivisti : nuovi).push(x);
  }
  return [...nuovi, ...rivisti];
}
