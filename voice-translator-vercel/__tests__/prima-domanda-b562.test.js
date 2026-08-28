// ═══════════════════════════════════════════════════════════════
// b.562 — LA PRIMA DOMANDA
//
// Ordine di Luca: «quando entri la prima volta nella sezione Mondo crea
// una pagina di onboarding semplice con scelta di interessi come su
// Instagram, Facebook, LinkedIn, e su conferma imposta gia la
// piattaforma con contenuti per partire».
//
// PERCHE' TUTTI LO FANNO: un sistema di raccomandazione nasce senza
// semi. Senza, le prime sessioni servono solo a raccogliere segnali —
// cioe a mostrarti roba a caso finche' non sbaglia abbastanza da
// capire. Chiedere e' il modo piu rapido e piu onesto di saltare quel
// giro. E per noi c'era un motivo in piu: il registro delle fonti nasce
// vuoto, e senza semi non impara da niente.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { createElement as e } from 'react';
import fs from 'fs';
import path from 'path';
import { INTERESSI, MINIMO, daChiedere, interessiDi, semiDaInteressi } from '../app/lib/accoglienza.js';
import { semiDi } from '../app/lib/giardino.js';
import SceltaInteressi from '../app/components/ui/SceltaInteressi.js';

afterEach(cleanup);
const leggi = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const C = { bg: '#05070f', accent: '#5b8cff', purple: '#8f6bff', textPrimary: '#fff', textSecondary: '#9aa' };
const L = (k) => k;

describe('il nome del file, che e una lezione', () => {
  it('l accoglienza NON ha rubato il posto a interessi.js', () => {
    // Questo file doveva chiamarsi `interessi.js`, ma quel nome era gia
    // occupato dal pezzo che pesa gli argomenti aperti (b.517). L'ho
    // sovrascritto, e lo scandaglio degli import fantasma e' diventato
    // rosso nel giro di un minuto: e' l'errore di b.545 con
    // `reazioni.js`, quello che tenne morta una rotta per otto
    // versioni. Questa prova esiste perche' non ricapiti una terza volta.
    const vecchio = leggi('app/lib/interessi.js');
    expect(vecchio, 'chi pesa gli argomenti aperti deve essere ancora li').toMatch(/export function segnaApertura/);
    expect(vecchio).toMatch(/export function punteggioArgomento/);
    const nuovo = leggi('app/lib/accoglienza.js');
    expect(nuovo).toMatch(/export const INTERESSI/);
  });
});

describe('l elenco degli interessi', () => {
  it('sono diciotto: una griglia che si legge in un colpo d occhio', () => {
    expect(INTERESSI).toHaveLength(18);
  });

  it('ognuno ha una parola tradotta e un icona vera', () => {
    const icone = leggi('app/components/Icon.js');
    for (const i of INTERESSI) {
      expect(i.chiave, `${i.id} senza chiave`).toBeTruthy();
      expect(icone, `${i.id}: icona "${i.icona}" non esiste`).toMatch(new RegExp(`\\n  ${i.icona}:`));
    }
  });

  it('le parole ci sono in tutte e 38 le lingue', async () => {
    const { readdirSync } = await import('node:fs');
    const dir = path.join(process.cwd(), 'app/lib/locales');
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.js'))) {
      const o = (await import(`../app/lib/locales/${f}`)).default;
      for (const i of INTERESSI) expect(typeof o[i.chiave], `${f}:${i.chiave}`).toBe('string');
      for (const k of ['onbTitolo', 'onbSotto', 'onbAvanti', 'onbSalta', 'onbScelti']) {
        expect(typeof o[k], `${f}:${k}`).toBe('string');
      }
    }
    // b.552 — trenta secondi: apre a uno a uno tutti i pacchetti.
  }, 30000);
});

describe('si chiede UNA volta nella vita', () => {
  it('a chi non ha mai risposto', () => {
    expect(daChiedere({})).toBe(true);
  });

  it('non a chi ha scelto', () => {
    expect(daChiedere({ interessi: ['cinema', 'sport', 'musica'] })).toBe(false);
  });

  it('e nemmeno a chi ha detto «non adesso»', () => {
    // un'applicazione che ripete la stessa domanda ad ogni ingresso ha
    // gia perso.
    expect(daChiedere({ interessiSaltati: true })).toBe(false);
  });

  it('un interesse che non esiste piu non tiene in ostaggio nessuno', () => {
    expect(interessiDi({ interessi: ['cinema', 'fantascienza-inventata'] })).toEqual(['cinema']);
  });
});

describe('da interesse a seme: l etichetta E la domanda', () => {
  it('la parola che leggi e la parola che si cerca', () => {
    const parole = { intCinema: 'Cinéma', catSport: 'Sport' };
    const semi = semiDaInteressi({ interessi: ['cinema', 'sport'] }, (k) => parole[k]);
    expect(semi.map((s) => s.query)).toEqual(['Cinéma', 'Sport']);
    expect(semi.every((s) => s.origine === 'interesse')).toBe(true);
  });

  it('valgono come le ricerche recenti, meno delle salvate con la stella', () => {
    const semi = semiDaInteressi({ interessi: ['cinema'] }, () => 'Cinema');
    expect(semi[0].peso).toBe(2);
  });

  it('e il giardino li pianta davvero', () => {
    const prefs = { semiInteressi: [{ query: 'Cinema' }], ricerchePreferite: [{ q: 'Milan' }] };
    const semi = semiDi(prefs, [{ query: 'ultime notizie' }]);
    expect(semi.map((s) => s.query)).toContain('Cinema');
    expect(semi[0].query, 'la stella resta la prima').toBe('Milan');
  });
});

describe('la schermata', () => {
  it('mostra tutti gli interessi e non fa partire niente sotto i tre', () => {
    render(e(SceltaInteressi, { C, L, onConferma: () => {}, onSalta: () => {} }));
    expect(screen.getAllByRole('button').length).toBe(INTERESSI.length + 2);
    expect(screen.getByText(`0/${MINIMO} onbScelti`)).toBeTruthy();
  });

  it('a tre scelti il tasto si accende e consegna cio che hai scelto', () => {
    let ricevuti = null;
    render(e(SceltaInteressi, { C, L, onConferma: (x) => { ricevuti = x; }, onSalta: () => {} }));
    for (const k of ['catWorld', 'intMusica', 'intViaggi']) fireEvent.click(screen.getByText(k));
    fireEvent.click(screen.getByText('onbAvanti'));
    expect(ricevuti).toEqual(['mondo', 'musica', 'viaggi']);
  });

  it('toccare due volte toglie', () => {
    render(e(SceltaInteressi, { C, L, onConferma: () => {}, onSalta: () => {} }));
    fireEvent.click(screen.getByText('catWorld'));
    fireEvent.click(screen.getByText('catWorld'));
    expect(screen.getByText(`0/${MINIMO} onbScelti`)).toBeTruthy();
  });

  it('«non adesso» si puo sempre fare: un accoglienza obbligatoria e un pedaggio', () => {
    let saltato = false;
    render(e(SceltaInteressi, { C, L, onConferma: () => {}, onSalta: () => { saltato = true; } }));
    fireEvent.click(screen.getByText('onbSalta'));
    expect(saltato).toBe(true);
  });

  it('niente grassetto, nemmeno qui', () => {
    expect(leggi('app/components/ui/SceltaInteressi.js')).not.toMatch(/fontWeight: (6|7|8|9)00/);
  });
});

describe('e nel Mondo si collega dove serve', () => {
  const news = leggi('app/components/MondoNews.js');

  it('la Gazzetta non parte finche la domanda e aperta', () => {
    // partirebbero tre giri (e tre chiamate a pagamento) per un giornale
    // che verrebbe buttato dieci secondi dopo.
    // b.570 — si aspetta anche che le preferenze siano ARRIVATE: un
    // oggetto vuoto non vuol dire «non ha scelto», vuol dire «non lo so
    // ancora». E l'attesa non e' piu definitiva (vedi b.570).
    expect(news).toMatch(/if \(!prefsPronte \|\| daChiedere\(prefs\)\) return;/);
  });

  it('su conferma si semina subito, senza far vedere una pagina vuota', () => {
    expect(news).toMatch(/dopo\.semiInteressi = semiDaInteressi\(dopo, L\)/);
    expect(news).toMatch(/await cerca\(semi\[0\]\.query, 'notizie', false, true\)/);
  });

  it('«non adesso» si ricorda', () => {
    expect(news).toMatch(/interessiSaltati: true/);
  });
});

// ═══════════════════════════════════════════════════════════════
// b.571 — LA DOMANDA SOLO A CHI E' DAVVERO NUOVO
//
// Collaudo di Luca: «quando faccio back da quella pagina mostra il menu
// onboarding». Aveva ragione a lamentarsi, e il caso e' istruttivo: lui
// non aveva mai risposto — la domanda non esisteva quando ha cominciato
// — quindi tecnicamente era «da chiedere», e ricompariva ogni volta.
//
// Ma la domanda serve a UNA cosa: avere dei semi da cui partire. Chi ha
// gia cercato qualcosa o messo una stella i semi ce li ha, e sono
// MIGLIORI di qualunque risposta a un questionario, perche' se li e'
// scelti facendo. Chiedergli gli interessi non e' accogliere: e'
// rifargli compilare un modulo che ha gia riempito vivendo.
// ═══════════════════════════════════════════════════════════════
describe('b.571 — chi ha gia una storia non e nuovo', () => {
  it('a chi ha gia cercato non si chiede niente', () => {
    expect(daChiedere({ ricercheRecenti: [{ q: 'thailandia' }] })).toBe(false);
  });

  it('e nemmeno a chi ha messo una stella', () => {
    expect(daChiedere({ ricerchePreferite: [{ q: 'milan' }] })).toBe(false);
  });

  it('ma a chi arriva davvero da zero si', () => {
    expect(daChiedere({ ricercheRecenti: [], ricerchePreferite: [] })).toBe(true);
    expect(daChiedere({})).toBe(true);
  });

  it('e il Mondo aspetta di sapere chi sei prima di chiedere', () => {
    const news = leggi('app/components/MondoNews.js');
    expect(news).toMatch(/\{prefsPronte && daChiedere\(prefs\) && \(/);
  });
});
