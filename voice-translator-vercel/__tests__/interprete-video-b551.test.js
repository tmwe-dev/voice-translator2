import { describe, it, expect } from 'vitest';
import {
  RINCORSA_MS, TETTO_CARATTERI, TETTO_SECONDI,
  frasiCompiute, prossimaDaDire, viaAsiatica, disponibile, sanaSottotitoli, chiaveFrase,
} from '../app/lib/interpreteVideo.js';

// ═══════════════════════════════════════════════════════════════
// b.551 — L'INTERPRETE DEL VIDEO, provato sui RISULTATI.
//
// Queste prove CHIAMANO le funzioni vere e guardano cosa tornano: non
// leggono il sorgente con un'espressione regolare (il difetto di metodo
// che l'audit di Luca segnala al §9). Se un giorno la ricucitura viene
// riscritta in un altro modo ma continua a ricucire bene, queste prove
// restano verdi — ed e' giusto cosi.
// ═══════════════════════════════════════════════════════════════

const riga = (inizio, fine, testo) => ({ inizio, fine, testo });

describe('b.551 — frasiCompiute: le mezze frasi si ricuciono', () => {
  it('due righe spezzate a meta frase diventano una frase sola', () => {
    // E' IL PUNTO DELL'ORDINE DI LUCA: «diamo modo al sistema di
    // elaborare frasi compiute». «il presidente ha detto che» da solo
    // non si puo tradurre: in mezza lingua del mondo l'ordine delle
    // parole cambierebbe la frase intera.
    const f = frasiCompiute([
      riga(0, 2, 'il presidente ha detto che'),
      riga(2, 4, 'domani si vota.'),
    ]);
    expect(f).toHaveLength(1);
    expect(f[0].testo).toBe('il presidente ha detto che domani si vota.');
    expect(f[0].inizio).toBe(0);
    expect(f[0].fine).toBe(4);
  });

  it('una riga che finisce con il punto resta sola', () => {
    const f = frasiCompiute([
      riga(0, 2, 'Buonasera a tutti.'),
      riga(2, 4, 'Cominciamo.'),
    ]);
    expect(f).toHaveLength(2);
    expect(f[0].testo).toBe('Buonasera a tutti.');
    expect(f[1].testo).toBe('Cominciamo.');
  });

  it('chiudono anche il punto interrogativo e quello ideografico', () => {
    // un interprete che riconosce solo il punto latino ricuce male
    // meta del mondo
    const f = frasiCompiute([
      riga(0, 1, 'e adesso?'),
      riga(1, 2, '今日は雨です。'),
      riga(2, 3, 'poi si vedra'),
    ]);
    expect(f.map((x) => x.testo)).toEqual(['e adesso?', '今日は雨です。', 'poi si vedra']);
  });

  it('il tetto dei caratteri chiude una frase che non finisce mai', () => {
    // i sottotitoli automatici spesso non hanno punteggiatura: senza
    // tetto tutto il video diventerebbe UNA frase lunga un'ora
    const pezzo = 'parola '.repeat(10).trim();   // 69 caratteri, mai chiuso
    const righe = [0, 1, 2, 3, 4, 5].map((i) => riga(i, i + 1, pezzo));
    const f = frasiCompiute(righe);
    expect(f.length).toBeGreaterThan(1);
    for (const x of f) expect(x.testo.length).toBeLessThanOrEqual(TETTO_CARATTERI + pezzo.length);
    expect(f[0].testo.length).toBeLessThanOrEqual(TETTO_CARATTERI);
  });

  it('il tetto dei secondi chiude una frase che dura troppo', () => {
    // righe cortissime ma lentissime: il tetto che scatta e quello del
    // tempo, non quello dei caratteri
    const righe = [0, 5, 10, 15, 20].map((s) => riga(s, s + 5, 'e poi'));
    const f = frasiCompiute(righe);
    expect(f.length).toBeGreaterThan(1);
    for (const x of f) expect(x.fine - x.inizio).toBeLessThanOrEqual(TETTO_SECONDI + 5);
  });

  it('elenco vuoto, null e spazzatura tornano un elenco vuoto', () => {
    expect(frasiCompiute([])).toEqual([]);
    expect(frasiCompiute(null)).toEqual([]);
    expect(frasiCompiute(undefined)).toEqual([]);
    expect(frasiCompiute('ciao')).toEqual([]);
    expect(frasiCompiute([null, 42, {}, { testo: '   ' }])).toEqual([]);
  });

  it('regge un testo lunghissimo senza sfondare', () => {
    const enorme = 'a'.repeat(50000);
    const f = frasiCompiute([riga(0, 3, enorme), riga(3, 6, 'fine.')]);
    expect(f.length).toBeGreaterThanOrEqual(1);
    expect(f[0].testo.length).toBeLessThanOrEqual(1000);
  });
});

describe('b.551 — prossimaDaDire: la rincorsa di cinque secondi', () => {
  const frasi = frasiCompiute([
    riga(0, 3, 'Prima frase.'),
    riga(10, 13, 'Seconda frase.'),
    riga(30, 33, 'Terza frase.'),
  ]);

  it('la rincorsa vale cinque secondi, come ha chiesto Luca', () => {
    expect(RINCORSA_MS).toBe(5000);
  });

  it('prepara la frase che comincia entro la rincorsa, non quella dopo', () => {
    // a 6 secondi: la seconda comincia a 10, cioe dentro i cinque
    // secondi di vantaggio → si prepara adesso
    const scelta = prossimaDaDire(frasi.slice(1), 6, new Set());
    expect(scelta?.testo).toBe('Seconda frase.');
    // a 6 secondi la terza (a 30) e' ancora lontana: non si tocca
    expect(prossimaDaDire(frasi.slice(2), 6, new Set())).toBeNull();
  });

  it('non ripete cio che e gia stato detto', () => {
    const prima = prossimaDaDire(frasi, 0, new Set());
    expect(prima?.testo).toBe('Prima frase.');
    const dette = new Set([prima.chiave]);
    const poi = prossimaDaDire(frasi, 6, dette);
    expect(poi?.testo).toBe('Seconda frase.');
    // e la targhetta e' quella che la logica stessa sa calcolare
    expect(prima.chiave).toBe(chiaveFrase(frasi[0]));
    dette.add(poi.chiave);
    expect(prossimaDaDire(frasi, 6, dette)).toBeNull();
  });

  it('a fine video non c e piu niente da dire', () => {
    expect(prossimaDaDire(frasi, 100, new Set())).toBeNull();
  });

  it('se si salta avanti col dito le frasi perse restano perse', () => {
    // saltando a 29 secondi la prima e la seconda sono passate: dirle
    // adesso vorrebbe dire parlare sopra a un'altra scena
    const scelta = prossimaDaDire(frasi, 29, new Set());
    expect(scelta?.testo).toBe('Terza frase.');
  });

  it('regge elenco vuoto, null e tempi che non sono numeri', () => {
    expect(prossimaDaDire([], 3, new Set())).toBeNull();
    expect(prossimaDaDire(null, 3, new Set())).toBeNull();
    expect(prossimaDaDire(frasi, NaN, new Set())).toBeNull();
    expect(prossimaDaDire(frasi, 'presto', new Set())).toBeNull();
    expect(prossimaDaDire(frasi, 0, null)?.testo).toBe('Prima frase.');
    // le targhette si accettano anche come elenco, e anche per indice:
    // a 6 secondi, con la prima gia segnata, tocca alla seconda
    expect(prossimaDaDire(frasi, 6, [0])?.testo).toBe('Seconda frase.');
  });
});

describe('b.551 — viaAsiatica: l ordine permanente di Luca', () => {
  it('vero per cinese, giapponese, coreano, thai e vietnamita', () => {
    for (const l of ['zh', 'ja', 'ko', 'th', 'vi']) {
      expect(viaAsiatica(l), l).toBe(true);
    }
  });

  it('vero anche con la regione o le maiuscole: zh-TW, JA, ko_KR', () => {
    expect(viaAsiatica('zh-TW')).toBe(true);
    expect(viaAsiatica('JA')).toBe(true);
    expect(viaAsiatica('ko_KR')).toBe(true);
  });

  it('falso per italiano, inglese, tedesco e francese', () => {
    for (const l of ['it', 'en', 'de', 'fr', 'es', 'pt-BR']) {
      expect(viaAsiatica(l), l).toBe(false);
    }
  });

  it('falso, e non un guasto, quando la lingua non c e', () => {
    expect(viaAsiatica(null)).toBe(false);
    expect(viaAsiatica('')).toBe(false);
    expect(viaAsiatica(42)).toBe(false);
    expect(viaAsiatica({})).toBe(false);
  });
});

describe('b.551 — disponibile: si offre solo dove c e davvero', () => {
  it('vero con sottotitoli veri, sia come elenco sia come risposta', () => {
    const righe = [riga(0, 2, 'ciao')];
    expect(disponibile(righe)).toBe(true);
    expect(disponibile({ disponibili: true, righe })).toBe(true);
  });

  it('falso su vuoto, null, righe vuote e tempi storti', () => {
    expect(disponibile(null)).toBe(false);
    expect(disponibile([])).toBe(false);
    expect(disponibile({ disponibili: false, righe: [] })).toBe(false);
    expect(disponibile({ righe: [riga(0, 2, '   ')] })).toBe(false);
    expect(disponibile({ righe: [riga(5, 2, 'al contrario')] })).toBe(false);
    expect(disponibile('si')).toBe(false);
  });

  it('falso se il server dice di no anche con righe attaccate', () => {
    expect(disponibile({ disponibili: false, righe: [riga(0, 2, 'ciao')] })).toBe(false);
  });
});

describe('b.551 — sanaSottotitoli: la roba di rete e sempre storta', () => {
  it('butta le righe vuote e quelle senza tempi buoni', () => {
    const p = sanaSottotitoli([
      riga(0, 2, 'buona'),
      riga(2, 2, 'finisce quando comincia'),
      riga(5, 3, 'al contrario'),
      riga(-1, 4, 'prima di cominciare'),
      riga('presto', 4, 'tempo che non e un numero'),
      riga(6, 8, '   '),
      null,
      'non un oggetto',
    ]);
    expect(p).toHaveLength(1);
    expect(p[0].testo).toBe('buona');
  });

  it('toglie i tag e scioglie le entita', () => {
    const p = sanaSottotitoli([riga(0, 2, '<i>Ciao</i><br>&amp; <b>arrivederci</b>')]);
    expect(p[0].testo).toBe('Ciao & arrivederci');
  });

  it('rimette in ordine di tempo cio che arriva alla rinfusa', () => {
    const p = sanaSottotitoli([riga(9, 10, 'terza'), riga(0, 1, 'prima'), riga(4, 5, 'seconda')]);
    expect(p.map((x) => x.testo)).toEqual(['prima', 'seconda', 'terza']);
  });

  it('taglia un testo lunghissimo invece di portarselo dietro', () => {
    const p = sanaSottotitoli([riga(0, 2, 'x'.repeat(90000))]);
    expect(p[0].testo.length).toBe(1000);
  });

  it('elenco vuoto, null e spazzatura tornano un elenco vuoto', () => {
    expect(sanaSottotitoli([])).toEqual([]);
    expect(sanaSottotitoli(null)).toEqual([]);
    expect(sanaSottotitoli({ righe: [] })).toEqual([]);
  });
});
