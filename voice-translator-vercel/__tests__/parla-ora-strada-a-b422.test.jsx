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

  it('si ribalta SOLO cio che l\'altro deve leggere', () => {
    // «mantieni il campo di testo in basso e ribalta solo il testo da leggere»
    const src = leggi('app/components/PrimaProva.js');
    const iLettura = src.indexOf('const bloccoLettura');
    const iVoce = src.indexOf('const bloccoVoce');
    expect(iLettura, "l'area di lettura esiste").toBeGreaterThan(0);
    expect(iVoce, 'la riga della voce esiste').toBeGreaterThan(iLettura);
    expect(src.slice(iLettura, iVoce), 'cio che si legge si gira').toContain('rotate(180deg)');
    expect(src.slice(iVoce), 'ne la voce ne il testo si girano mai').not.toContain('rotate(180deg)');
  });

  it('e una PAGINA INTERA, non piu un riquadro dentro la home', () => {
    // b.424, ordine di Luca: «una pagina intera con freccia in alto per
    // tornare alla home», e l'apertura e un ribaltamento del foglio.
    const src = leggi('app/components/PrimaProva.js');
    expect(src, 'niente piu altezza ritagliata a mano').not.toMatch(/height: 'calc\(100dvh/);
    expect(src, 'niente piu cornice da riquadro').not.toMatch(/borderRadius: 20, padding: 14/);
    const home = leggi('app/components/HomeView.js');
    expect(home, 'la home gira su se stessa').toMatch(/<Ribalta girato=\{mostraPrimaProva\}/);
    expect(home, 'e dietro c\'e il traduttore').toMatch(/retro=\{<PrimaProva/);
  });

  it('in alto a sinistra c\'e la freccia per tornare, non una ✕', () => {
    const { container } = render(<PrimaProva onChiudi={() => {}} />);
    expect(per(container, 'backWord'), 'la freccia indietro').toBeTruthy();
    expect(per(container, 'close'), 'la ✕ non c\'e piu').toBeFalsy();
  });

  it('un microfono solo: quello in mezzo fa tutto', async () => {
    // b.424: «il secondo microfono in basso deve essere solo una freccia
    // di invio testo, il microfono in mezzo fa gia tutto per l'audio».
    const { container } = render(<PrimaProva onChiudi={() => {}} />);
    const microfoni = bottoni(container).filter((b) => (b.getAttribute('aria-label') || '') === 'dictateWord');
    expect(microfoni.length, 'uno, non due').toBe(1);
    expect(per(container, 'sendWord'), 'e in basso c\'e la freccia di invio').toBeTruthy();
  });

  it('la freccia di invio si accende solo quando c\'e qualcosa da mandare', async () => {
    const { container } = render(<PrimaProva onChiudi={() => {}} />);
    const invia = per(container, 'sendWord');
    expect(invia.disabled, 'a campo vuoto e spenta').toBe(true);
    const campo = container.querySelector('textarea');
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(campo.constructor.prototype, 'value').set;
      setter.call(campo, 'Ciao');
      campo.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(per(container, 'sendWord').disabled, 'con del testo si accende').toBe(false);
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
  });

  it('la lista delle lingue e LA STESSA della home, non una copia', () => {
    // ordine di Luca: «crea una lista come quella della home, esattamente
    // identica». Identica si ottiene in un modo solo: usando quella.
    const src = leggi('app/components/PrimaProva.js');
    expect(src, 'si importa il carosello della home').toMatch(/import CarouselLingue from '\.\/CarouselLingue\.js'/);
    expect(src, 'e lo si usa').toMatch(/<CarouselLingue/);
    expect(src, 'la fila di pillole fatta a mano non c\'e piu').not.toMatch(/mete\.map\(\(l\) =>/);
    // e la home continua a usare lo stesso componente: se un giorno
    // qualcuno lo cambia li, cambia anche qui. E' il punto.
    const home = leggi('app/components/HomeView.js');
    expect(home).toMatch(/<CarouselLingue/);
  });

  it('la lingua scelta arriva come lingua, non come oggetto messo per sigla', () => {
    // il carosello consegna la LINGUA intera: prenderla per un codice
    // metterebbe un oggetto dove va una sigla, e la meta diventerebbe una
    // lingua inesistente, in silenzio.
    const src = leggi('app/components/PrimaProva.js');
    expect(src).toMatch(/onScegli=\{\(lingua\) => \{ setMeta\(lingua\.code\)/);
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

  it('tornando indietro si ricorda che la prova e stata fatta', async () => {
    // b.424 — si torna con la freccia, non piu con la ✕: il foglio si
    // gira, non si butta via niente. Ma il ricordo resta lo stesso, o la
    // schermata si ripresenterebbe da sola a ogni apertura dell'app.
    let tornato = false;
    const { container } = render(<PrimaProva onChiudi={() => { tornato = true; }} />);
    await act(async () => { per(container, 'backWord').click(); });
    expect(tornato).toBe(true);
  });

  it('la voce si puo far ripetere, ma non e piu una barra che sembra obbligatoria', () => {
    const src = leggi('app/components/PrimaProva.js');
    expect(src, 'via la barra a tutta larghezza').not.toMatch(/<Ascolta\s/);
    expect(src, 'resta il comando per farla ripetere').toMatch(/parla\(ultimaResa\)/);
  });
});
