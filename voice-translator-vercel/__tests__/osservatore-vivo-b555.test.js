// ═══════════════════════════════════════════════════════════════
// b.555 — IL SUONO DI UNO, L'IMMAGINE DI UN ALTRO
//
// Collaudo di Luca: «il video non parte piu, lo hai rotto» e poi, piu
// preciso: «lo stesso problema di prima, scrollando non aggiorna e non
// visualizza il video dell'audio che sento».
//
// LA CAUSA, ed e' mia. In b.552 le diapositive hanno smesso di montarsi
// subito: si montano quando il feed e' «pronto» (per non farle saltare
// sotto il dito). Ma l'osservatore che decide QUALE slide stai
// guardando iscriveva le sentinelle che trovava nel momento in cui
// nasceva — e in quel momento, con `pronto` ancora falso, non ce n'era
// nessuna. Poi non veniva piu richiamato, perche' l'elenco non era
// cambiato. Senza sentinelle nessuno diceva mai «adesso stai guardando
// quella dopo»: l'indice restava a zero, il primo video continuava a
// suonare, e tu scorrevi vedendo altro.
//
// E' ESATTAMENTE la trappola di b.546, tornata da una porta che ho
// aperto io tre versioni dopo. Percio' qui si mettono DUE difese, non
// una: un difetto che si e' ripresentato due volte non merita fiducia.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const feed = fs.readFileSync(path.join(__dirname, '..', 'app/components/FeedNotizieMondo.js'), 'utf8');

describe('ogni slide si iscrive da sola quando nasce', () => {
  it('l osservatore vive in un riferimento, non solo dentro il suo effetto', () => {
    expect(feed).toMatch(/const ossRef = useRef\(null\)/);
    expect(feed).toMatch(/ossRef\.current = oss;/);
  });

  it('nascendo si iscrive, morendo si cancella', () => {
    expect(feed).toMatch(/ossRef\.current\?\.observe\(nodo\)/);
    expect(feed).toMatch(/ossRef\.current\?\.unobserve\(vecchio\)/);
    expect(feed, 'e la slide usa quella porta, non due righe scritte a mano')
      .toMatch(/ref=\{\(node\) => prendiSentinella\(el\.chiave, node\)\}/);
  });

  it('e quando l osservatore muore non resta un riferimento a un morto', () => {
    expect(feed).toMatch(/if \(ossRef\.current === oss\) ossRef\.current = null;/);
  });
});

describe('la seconda difesa: l osservatore rinasce quando le slide compaiono', () => {
  it('«pronto» sta fra le dipendenze dell effetto', () => {
    const i = feed.indexOf('new IntersectionObserver');
    const dopo = feed.slice(i, i + 4000);
    expect(dopo).toMatch(/\}, \[aperto, contenitore, elementi, pronto\]\);/);
  });

  it('e «pronto» e dichiarato prima di chi lo guarda (lezione b.546)', () => {
    expect(feed.indexOf('const pronto = visto ||')).toBeLessThan(feed.indexOf('new IntersectionObserver'));
  });
});
