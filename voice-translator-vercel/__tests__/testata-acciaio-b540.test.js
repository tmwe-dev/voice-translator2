import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');
const mondo = leggi('app/components/MondoView.js');
const news = leggi('app/components/MondoNews.js');
const stanze = leggi('app/components/StanzeView.js');

// ═══ b.540 — il giro di ordini di Luca sulla testata e sul feed ═══

describe('b.540 — l\'icona in acciaio al centro, con le frecce', () => {
  it('le due voci scritte sono sparite: restano icona e frecce', () => {
    // niente piu linguette con la parola dentro
    expect(mondo).not.toMatch(/role="tablist" aria-label=\{L\('worldNowTitle'\)\}/);
    expect(mondo).toMatch(/acciaio: '\/sezioni\/sez-news\.webp'/);
    expect(mondo).toMatch(/acciaio: '\/sezioni\/sez-mondo\.webp'/);
    expect(mondo).toMatch(/name=\{verso < 0 \? 'chevLeft' : 'chevRight'\}/);
    // e le parole restano per chi legge con lo schermo
    expect(mondo).toMatch(/aria-label=\{SCHEDE\[i\]\.parola\}/);
  });

  it('le frecce girano nei due versi senza uscire dall\'elenco (regola vera)', () => {
    const SCHEDE = ['news', 'mondo'];
    const gira = (i, passo) => SCHEDE[(i + passo + SCHEDE.length) % SCHEDE.length];
    expect(gira(0, 1)).toBe('mondo');
    expect(gira(1, 1)).toBe('news');    // dopo l'ultima si torna alla prima
    expect(gira(0, -1)).toBe('mondo');  // e prima della prima c'e l'ultima
    expect(gira(1, -1)).toBe('news');
  });

  it('la freccia a sinistra esiste come icona', () => {
    expect(leggi('app/components/Icon.js')).toMatch(/chevLeft: 'M15 18l-6-6 6-6'/);
  });
});

describe('b.540 — si parte dal feed, e la riga «Stanze» e uscita', () => {
  it('il feed si apre a ogni ingresso, non una volta per sessione', () => {
    expect(news).toMatch(/useEffect\(\(\) => \{ setFeedAperto\(true\); \}, \[\]\)/);
    expect(news).not.toMatch(/window\.__VT_FEED_VISTO = true/);
  });
  it('il pulsante «Vista feed» non c\'e piu', () => {
    expect(news).not.toMatch(/L\('feedApri'\)/);
  });
  it('la riga «Stanze» a tutta larghezza e uscita dal Mondo', () => {
    expect(mondo).not.toMatch(/setView\('stanze'\)/);
    // ma la porta resta: e' il tasto «Chat» della barra (b.537)
    expect(leggi('app/components/BottomNav.js')).toMatch(/views: \['stanze'/);
  });
  it('e la linguetta per cercare senza uscire dal feed c\'e', () => {
    expect(news).toMatch(/onStrumenti=\{suApriStrumenti\}/);
    expect(leggi('app/components/FeedNotizieMondo.js')).toMatch(/onStrumenti && \(/);
  });
});

describe('b.540 — le icone non finiscono piu sotto la batteria', () => {
  it('la testata delle Stanze chiede lo spazio al righello, non a mano', () => {
    expect(stanze).toMatch(/import \{ riservaADestra \} from '\.\.\/lib\/righello\.js'/);
    expect(stanze).toMatch(/paddingRight: riservaADestra\(1\)/);
  });
  it('e il righello riserva davvero abbastanza per una pila di icone (regola vera)', async () => {
    const { riservaADestra } = await import('../app/lib/righello.js');
    const uno = riservaADestra(1);
    const due = riservaADestra(2);
    expect(uno).toBeGreaterThan(40);        // almeno la larghezza di un tasto
    expect(due).toBeGreaterThan(uno);       // due elementi occupano piu di uno
  });
});

describe('b.540 — la bandiera dice da dove viene la notizia', () => {
  it('e grande abbastanza da vedersi sulla foto', () => {
    const blocco = news.slice(news.indexOf('evidenzia con una'), news.indexOf('evidenzia con una') + 1200);
    const m = blocco.match(/fontSize: (\d+), lineHeight: 1, cursor: 'pointer'/);
    expect(m, 'la bandiera della card').toBeTruthy();
    expect(Number(m[1]), 'era 14: troppo piccola per dire l\'origine').toBeGreaterThanOrEqual(20);
  });
});
