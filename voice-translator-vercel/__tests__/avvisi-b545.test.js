import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  avvisiNonLetti, quantiNuovi, etichettaPallino, segnaLetti, ultimaLettura,
  unisciAvvisi, raggruppaPerContenuto, TETTO_PALLINO, QUANTI_RICORDO,
} from '../app/lib/campanella.js';

const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// ═══ b.545 — «dobbiamo avvisare l'utente in alto nelle pagine di
// commenti come instagram o facebook, nella sua stanza potra quindi
// aprire il commento/lista direttamente dal pulsante» (Luca) ═══

const avviso = (id, quando, extra = {}) => ({
  id, tipo: 'commento', chiave: 'esempio.it/articolo', titolo: 'una riga', quando, ...extra,
});

beforeEach(() => localStorage.clear());

describe('b.545 — quel che e nuovo davvero', () => {
  it('nuovo e solo quel che e arrivato dopo che ho aperto la campanella', () => {
    const lista = [avviso('a', 100), avviso('b', 500), avviso('c', 900)];
    const nuovi = avvisiNonLetti(lista, 500);
    expect(nuovi.map((a) => a.id)).toEqual(['c']);
  });

  it('senza memoria di letture e tutto nuovo, dal piu recente', () => {
    const lista = [avviso('a', 100), avviso('c', 900), avviso('b', 500)];
    expect(avvisiNonLetti(lista, 0).map((a) => a.id)).toEqual(['c', 'b', 'a']);
  });

  it('un avviso malformato non conta e non fa cadere la campanella', () => {
    const lista = [
      null,
      'non un oggetto',
      { id: 'senza-chiave', tipo: 'commento', quando: 900 },
      { id: 'tipo-inventato', tipo: 'starnuto', chiave: 'x', quando: 900 },
      avviso('buono', 900),
    ];
    expect(avvisiNonLetti(lista, 0).map((a) => a.id)).toEqual(['buono']);
    expect(quantiNuovi(lista, 0)).toBe(1);
  });
});

describe('b.545 — il pallino si ferma a nove, come nei social', () => {
  it('tre avvisi nuovi fanno tre', () => {
    const lista = [avviso('a', 10), avviso('b', 20), avviso('c', 30)];
    expect(quantiNuovi(lista, 0)).toBe(3);
    expect(etichettaPallino(lista, 0)).toBe('3');
  });

  it('quattordici avvisi nuovi si fermano a nove, e si leggono 9+', () => {
    const lista = Array.from({ length: 14 }, (_, i) => avviso(`n${i}`, 100 + i));
    expect(quantiNuovi(lista, 0)).toBe(TETTO_PALLINO);
    expect(quantiNuovi(lista, 0)).toBe(9);
    expect(etichettaPallino(lista, 0)).toBe('9+');
  });

  it('esattamente nove restano nove, senza il piu', () => {
    const lista = Array.from({ length: 9 }, (_, i) => avviso(`n${i}`, 100 + i));
    expect(quantiNuovi(lista, 0)).toBe(9);
    expect(etichettaPallino(lista, 0)).toBe('9');
  });

  it('senza niente di nuovo il pallino non si disegna proprio', () => {
    const lista = [avviso('a', 100), avviso('b', 200)];
    expect(quantiNuovi(lista, 999)).toBe(0);
    expect(etichettaPallino(lista, 999)).toBe('');
    expect(etichettaPallino([], 0)).toBe('');
  });
});

describe('b.545 — il momento in cui ho guardato', () => {
  it('segno di aver guardato e la campanella se lo ricorda', () => {
    const ora = segnaLetti(1717171717000);
    expect(ora).toBe(1717171717000);
    expect(ultimaLettura()).toBe(1717171717000);
    expect(quantiNuovi([avviso('vecchio', 1000)], ultimaLettura())).toBe(0);
  });

  it('memoria illeggibile: si riparte da zero, tutto da leggere', () => {
    localStorage.setItem('vt-avvisi-letti', 'ciao-non-sono-un-numero');
    expect(ultimaLettura()).toBe(0);
    expect(quantiNuovi([avviso('a', 100), avviso('b', 200)], ultimaLettura())).toBe(2);
  });

  it('memoria mai scritta: zero, non NaN', () => {
    expect(ultimaLettura()).toBe(0);
    localStorage.setItem('vt-avvisi-letti', '-5');
    expect(ultimaLettura()).toBe(0);
  });
});

describe('b.545 — la fusione, senza doppioni', () => {
  it('lo stesso avviso che torna due volte resta una riga sola', () => {
    const uniti = unisciAvvisi([avviso('a', 100), avviso('b', 200)], [avviso('b', 200), avviso('c', 300)]);
    expect(uniti.map((a) => a.id)).toEqual(['c', 'b', 'a']);
    expect(uniti).toHaveLength(3);
  });

  it('a parita di id vince la copia con l ora buona, non quella monca', () => {
    const uniti = unisciAvvisi([avviso('a', 900)], [avviso('a', 0)]);
    expect(uniti).toHaveLength(1);
    expect(uniti[0].quando).toBe(900);
  });

  it('si tengono i cinquanta piu recenti, i vecchi cadono', () => {
    const tanti = Array.from({ length: 80 }, (_, i) => avviso(`n${i}`, 1000 + i));
    const uniti = unisciAvvisi([], tanti);
    expect(uniti).toHaveLength(QUANTI_RICORDO);
    expect(uniti).toHaveLength(50);
    expect(uniti[0].id).toBe('n79');
    expect(uniti.map((a) => a.id)).not.toContain('n0');
  });

  it('elenchi vuoti o storti non rompono niente', () => {
    expect(unisciAvvisi([], [])).toEqual([]);
    expect(unisciAvvisi(null, undefined)).toEqual([]);
    expect(unisciAvvisi('niente', [avviso('a', 5)]).map((a) => a.id)).toEqual(['a']);
  });
});

describe('b.545 — tre commenti sullo stesso articolo sono UNA riga', () => {
  it('una riga con il conteggio a tre, datata all ultimo arrivato', () => {
    const righe = raggruppaPerContenuto([
      avviso('c1', 100, { titolo: 'primo' }),
      avviso('c2', 200, { titolo: 'secondo' }),
      avviso('c3', 300, { titolo: 'terzo' }),
    ]);
    expect(righe).toHaveLength(1);
    expect(righe[0].quanti).toBe(3);
    expect(righe[0].quando).toBe(300);
    expect(righe[0].titolo).toBe('terzo');
    expect(righe[0].chiave).toBe('esempio.it/articolo');
  });

  it('contenuti diversi restano righe diverse, dal piu recente', () => {
    const righe = raggruppaPerContenuto([
      avviso('a1', 100, { chiave: 'uno.it/x' }),
      avviso('b1', 700, { chiave: 'due.it/y' }),
      avviso('a2', 200, { chiave: 'uno.it/x' }),
    ]);
    expect(righe.map((r) => r.chiave)).toEqual(['due.it/y', 'uno.it/x']);
    expect(righe.map((r) => r.quanti)).toEqual([1, 2]);
  });

  it('commenti e reazioni sullo stesso contenuto sono due notizie diverse', () => {
    const righe = raggruppaPerContenuto([
      avviso('c1', 100),
      avviso('r1', 400, { tipo: 'reazione' }),
      avviso('c2', 200),
    ]);
    expect(righe).toHaveLength(2);
    expect(righe[0].tipo).toBe('reazione');
    expect(righe[0].quanti).toBe(1);
    expect(righe[1].tipo).toBe('commento');
    expect(righe[1].quanti).toBe(2);
  });

  it('lo stesso avviso ripetuto conta una volta sola', () => {
    const righe = raggruppaPerContenuto([avviso('c1', 100), avviso('c1', 100), avviso('c2', 200)]);
    expect(righe[0].quanti).toBe(2);
  });

  it('elenco vuoto: nessuna riga, nessun errore', () => {
    expect(raggruppaPerContenuto([])).toEqual([]);
    expect(raggruppaPerContenuto(null)).toEqual([]);
    expect(raggruppaPerContenuto([null, 'boh', {}])).toEqual([]);
  });
});

describe('b.545 — la campanella sullo schermo', () => {
  const sorgente = leggi('app/components/ui/Campanella.js');

  it('e un tasto da 44, come tutti i tasti di questa applicazione', () => {
    expect(sorgente).toMatch(/width: 44, height: 44/);
  });

  it('toccando una riga si apre il contenuto, non una pagina di avvisi', () => {
    expect(sorgente).toMatch(/onApriContenuto\?\.\(riga\.chiave\)/);
  });

  it('aprendo la campanella si segna letto: il pallino si spegne', () => {
    expect(sorgente).toMatch(/segnaLetti\(Date\.now\(\)\)/);
  });

  it('i conti non sono riscritti qui: vengono da lib/campanella.js', () => {
    expect(sorgente).toMatch(/from '\.\.\/\.\.\/lib\/campanella\.js'/);
  });
});
