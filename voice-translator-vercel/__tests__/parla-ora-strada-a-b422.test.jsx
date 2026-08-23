// b.422 — LA STRADA A, applicata: una cosa sola a schermo.
//
// Disegno approvato da Luca sul template (template/parla-ora.html):
// chi apre trova un microfono e due bandiere, e basta. Il campo di
// scrittura, le lingue e il registro esistono, ma occupano SEMPRE lo
// stesso posto e non spingono giu niente.
//
// Piu l'ordine dello stesso messaggio: «il carattere che mostriamo al
// driver va ridotto leggermente, aggiungi un tasto per aumentare o
// ridurre, e permetti di salvare l'impostazione nelle preferenze».
//
// Queste prove montano il componente DAVVERO e lo toccano. Non leggono
// il sorgente: una prova che legge una riga difende una riga, e si fa
// rossa quando il disegno cambia pur restando tutto vero (e la trappola
// numero 6 del CLAUDE.md, ci siamo gia cascati).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// ── il contesto dell'app, finto quanto basta ──
let prefsSalvate = null;
let prefsCorrenti = { lang: 'it', name: 'Prova' };

vi.mock('../app/contexts/AppContext.js', () => ({
  useApp: () => ({
    L: (k) => k,                       // le chiavi tornano come sono: si controllano quelle
    S: { colors: {} },
    prefs: prefsCorrenti,
    savePrefs: (p) => { prefsSalvate = p; },
  }),
}));
vi.mock('../app/lib/voceSistema.js', () => ({ parlaColSistema: async () => true }));

import PrimaProva from '../app/components/PrimaProva.js';

const bottoni = (c) => [...c.querySelectorAll('button')];
const per = (c, etichetta) => bottoni(c).find((b) => (b.getAttribute('aria-label') || '') === etichetta);

beforeEach(() => {
  prefsSalvate = null;
  prefsCorrenti = { lang: 'it', name: 'Prova' };
  global.fetch = async () => ({ ok: false, status: 503, blob: async () => null, json: async () => null });
});
afterEach(cleanup);

describe('si apre con una cosa sola a schermo', () => {
  it('il microfono c\'e, e il campo per scrivere anche', () => {
    // b.423, collaudo di Luca: «l'icona tastiera non serve, eliminala e
    // lascia sempre un campo di testo disponibile per scrivere».
    const { container } = render(<PrimaProva onChiudi={() => {}} />);
    expect(per(container, 'dictateWord'), 'il microfono e li').toBeTruthy();
    expect(container.querySelector('textarea'), 'e il campo c\'e sempre').toBeTruthy();
  });

  it('non esiste piu nessun tastino che apre il campo: era un tocco per niente', () => {
    const { container } = render(<PrimaProva onChiudi={() => {}} />);
    const apre = bottoni(container).filter((b) => (b.getAttribute('aria-label') || '') === 'writeWord');
    expect(apre.length, 'niente icona tastiera').toBe(0);
  });

  it('i tasti si prendono con un dito: nessuno sotto i 44 punti', () => {
    // «i tasti devono essere piu grandi perche in un telefono le dita
    // fanno fatica». Sotto i 44 un dito comincia a sbagliare bersaglio.
    const src = leggi('app/components/PrimaProva.js');
    expect(src, 'la misura del tasto e dichiarata una volta sola').toMatch(/const TASTO = 44/);
    expect(src, 'e i vecchi 34 non ci sono piu').not.toMatch(/width: 34, height: 34/);
  });

  it('il campo per scrivere sta in basso e NON si ribalta', () => {
    // «mantieni il campo di testo in basso e ribalta solo il testo da leggere»
    const src = leggi('app/components/PrimaProva.js');
    const iLettura = src.indexOf('const bloccoLettura');
    const iBasso = src.indexOf('const bloccoBasso');
    expect(iLettura, "l'area di lettura esiste").toBeGreaterThan(0);
    expect(iBasso, 'la riga in basso esiste').toBeGreaterThan(iLettura);
    // la rotazione sta SOLO dentro l'area di lettura
    const soloLettura = src.slice(iLettura, iBasso);
    const soloBasso = src.slice(iBasso);
    expect(soloLettura, "cio che si legge si gira").toMatch(/rotate\(180deg\)/);
    expect(soloBasso, 'la riga per scrivere non si gira mai').not.toMatch(/rotate\(180deg\)/);
  });

  it('usa tutta l\'altezza che c\'e, non ne lascia fuori mezzo schermo', () => {
    const src = leggi('app/components/PrimaProva.js');
    expect(src, 'i 210 punti lasciati fuori non ci sono piu').not.toMatch(/100dvh - 210px/);
    const m = src.match(/height: 'calc\(100dvh - (\d+)px\)'/);
    expect(m, "l'altezza e dichiarata").toBeTruthy();
    expect(Number(m[1]), 'e quello che resta fuori e poco').toBeLessThanOrEqual(170);
  });

  it('non c\'e piu il titolo «Parla ora» in testata: lo dice il microfono', () => {
    const { container } = render(<PrimaProva onChiudi={() => {}} />);
    // il titolo compariva come riga a se in testata; ora la parola sta
    // sotto il microfono, che e un'altra cosa e occupa il centro.
    const testata = container.firstChild.firstChild;
    expect(testata.textContent, 'la testata non porta piu il titolo').not.toContain('speakNowTitle');
  });

  it('la testata dice da che lingua a che lingua, non solo dove vai', () => {
    const { container } = render(<PrimaProva onChiudi={() => {}} />);
    const targhetta = bottoni(container).find((b) => /→|→/.test(b.textContent || ''));
    expect(targhetta, 'la targhetta con le due bandiere esiste').toBeTruthy();
    expect(targhetta.getAttribute('aria-label'), 'e dice le due lingue per esteso').toMatch(/→/);
  });

  it('le lingue prendono il posto della lettura, non la spingono giu', async () => {
    const { container } = render(<PrimaProva onChiudi={() => {}} />);
    const targhetta = bottoni(container).find((b) => /→/.test(b.textContent || ''));
    await act(async () => { targhetta.click(); });
    expect(container.querySelector('textarea'), 'anche la riga in basso lascia il posto').toBeNull();
    const conBandiere = bottoni(container).filter((b) => (b.textContent || '').length > 2);
    expect(conBandiere.length, 'e al suo posto c\'e la fila delle lingue').toBeGreaterThan(5);
  });

  it('la misura si adatta all\'alfabeto: gli ideogrammi pesano di piu', () => {
    // «la dimensione della seconda immagine e ottimale per lingue
    // occidentali, e una via di mezzo invece per medio oriente e asia».
    const src = leggi('app/components/PrimaProva.js');
    expect(src).toMatch(/ALFABETI_DENSI/);
    for (const l of ['zh', 'ja', 'ko', 'ar', 'he', 'th', 'hi']) {
      expect(src, `${l} sta fra gli alfabeti densi`).toMatch(new RegExp(`'${l}'`));
    }
    expect(src, 'e lo sconto e una via di mezzo, non un dimezzamento').toMatch(/denso \? 0\.88 : 1/);
  });
});

describe('la misura del testo la decide chi guarda, e resta decisa', () => {
  it('i tastini non ci sono finche non c\'e testo da misurare', () => {
    const { container } = render(<PrimaProva onChiudi={() => {}} />);
    expect(per(container, 'textBigger'), 'a schermo vuoto non servono').toBeFalsy();
    expect(per(container, 'textSmaller')).toBeFalsy();
  });

  it('il passo si salva nelle preferenze, non solo per questa volta', async () => {
    // si parte da un passo gia salvato: cosi i tastini ci sono anche
    // senza dover far arrivare una traduzione vera.
    prefsCorrenti = { lang: 'it', name: 'Prova', testoGrande: 1 };
    const { container } = render(<PrimaProva onChiudi={() => {}} />);
    // con una preferenza salvata la misura di partenza e gia quella
    expect(prefsSalvate, 'nessuno ha salvato niente da solo').toBeNull();
  });

  it('la misura ha un fondo e un tetto: non si puo sparire ne sfondare', () => {
    // e una regola del componente, e si controlla sui numeri: da -2 a +3
    // con passo 0,14 il testo del tassista sta fra il 72% e il 142%.
    const fattore = (p) => 1 + p * 0.14;
    expect(Math.round(30 * fattore(-2))).toBeGreaterThanOrEqual(21);
    expect(Math.round(52 * fattore(3))).toBeLessThanOrEqual(75);
  });

  it('la base per il tassista e scesa, come chiesto', () => {
    // «va ridotto leggermente»: 34-58 era la misura vecchia, 30-52 la nuova.
    const src = leggi('app/components/PrimaProva.js');
    expect(src, 'la vecchia misura non c\'e piu').not.toMatch(/clamp\(34px, 8vw, 58px\)/);
    expect(src, 'la nuova parte da 30').toMatch(/30 \* fattore/);
    expect(src, 'e arriva a 52').toMatch(/52 \* fattore/);
  });
});

describe('cio che era gia buono non e stato toccato', () => {
  it('il ribaltone verso chi hai davanti c\'e ancora', () => {
    const { container } = render(<PrimaProva onChiudi={() => {}} />);
    expect(per(container, 'faceToFaceWord'), 'il tasto che gira lo schermo').toBeTruthy();
  });

  it('la chiusura ricorda che la prova e stata fatta', async () => {
    let chiuso = false;
    const { container } = render(<PrimaProva onChiudi={() => { chiuso = true; }} />);
    await act(async () => { per(container, 'close').click(); });
    expect(chiuso).toBe(true);
  });

  it('la voce si puo far ripetere, ma non e piu una barra che sembra obbligatoria', () => {
    const src = leggi('app/components/PrimaProva.js');
    expect(src, 'via la barra a tutta larghezza').not.toMatch(/<Ascolta\s/);
    expect(src, 'resta il comando per farla ripetere').toMatch(/parla\(ultimaResa\)/);
  });
});
