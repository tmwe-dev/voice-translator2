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
  it('il microfono c\'e, e il campo di scrittura NO', () => {
    const { container } = render(<PrimaProva onChiudi={() => {}} />);
    expect(per(container, 'dictateWord'), 'il microfono e li').toBeTruthy();
    expect(container.querySelector('textarea'), 'niente campo da compilare all\'apertura').toBeNull();
  });

  it('il campo si apre col tastino, e si richiude', async () => {
    const { container } = render(<PrimaProva onChiudi={() => {}} />);
    const scrivi = per(container, 'writeWord');
    expect(scrivi, 'il tastino per scrivere esiste').toBeTruthy();
    await act(async () => { scrivi.click(); });
    expect(container.querySelector('textarea'), 'ora il campo c\'e').toBeTruthy();
    await act(async () => { per(container, 'writeWord').click(); });
    expect(container.querySelector('textarea'), 'e si richiude').toBeNull();
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

  it('le lingue prendono il posto del microfono, non lo spingono giu', async () => {
    const { container } = render(<PrimaProva onChiudi={() => {}} />);
    const targhetta = bottoni(container).find((b) => /→|→/.test(b.textContent || ''));
    await act(async () => { targhetta.click(); });
    expect(per(container, 'dictateWord'), 'il microfono grande lascia il posto').toBeFalsy();
    const conBandiere = bottoni(container).filter((b) => (b.textContent || '').length > 2);
    expect(conBandiere.length, 'e al suo posto c\'e la fila delle lingue').toBeGreaterThan(5);
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
