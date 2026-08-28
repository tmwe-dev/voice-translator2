import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// ═══ b.535 — il grande giro: tendina unica, porte chiuse oneste,
// giornale mai vuoto, sidebar a card, stella dei preferiti. ═══

describe('b.535 — le testate chiuse (regole VERE, con la memoria vera)', () => {
  beforeEach(() => localStorage.clear());
  it('il seme conosce tuttomercatoweb, sottodomini compresi', async () => {
    const { testataChiusa } = await import('../app/lib/testateChiuse.js');
    expect(testataChiusa('https://www.tuttomercatoweb.com/serie-a/x')).toBe(true);
    expect(testataChiusa('https://m.tuttomercatoweb.com/y')).toBe(true);
    expect(testataChiusa('https://www.gazzetta.it/calcio')).toBe(false);
    expect(testataChiusa('non-un-indirizzo')).toBe(false);
  });
  it('un rifiuto visto una volta viene ricordato davvero (localStorage)', async () => {
    const { testataChiusa, imparaChiusa } = await import('../app/lib/testateChiuse.js');
    expect(testataChiusa('https://esempio-chiuso.com/a')).toBe(false);
    imparaChiusa('https://esempio-chiuso.com/a');
    expect(testataChiusa('https://esempio-chiuso.com/altro')).toBe(true);
    expect(JSON.parse(localStorage.getItem('vt-testate-chiuse'))).toContain('esempio-chiuso.com');
    imparaChiusa('https://esempio-chiuso.com/b'); // niente doppioni
    expect(JSON.parse(localStorage.getItem('vt-testate-chiuse')).length).toBe(1);
  });
  it('nel lettore la porta chiusa non offre la scheda «Apri» ne carica la cornice', () => {
    const f = leggi('app/components/ui/LettoreArticolo.js');
    expect(f).toMatch(/chiusaNota\s*\?\s*\[\{ id: 'sintesi'/);
    expect(f).toContain('{url && !chiusaNota && (');
    expect(f).toMatch(/imparaChiusa\(url\)/);
  });
  it('nelle card e nel feed la scelta della faccia guarda la porta', () => {
    const n = leggi('app/components/MondoNews.js');
    expect(n).toMatch(/faccia: testataChiusa\(t\.url\) \? 'sintesi' : 'articolo'/);
    expect(n).toMatch(/faccia: testataChiusa\(d\.url\) \? 'sintesi' : 'articolo'/);
    expect(n).toContain('{!testataChiusa(t.url) && (');
  });
});

describe('b.535 — la stella dei preferiti (regole VERE)', () => {
  it('aggiunge, non duplica, toglie, riconosce senza badare alle maiuscole', async () => {
    const { aggiungiPreferita, togliPreferita, ePreferita, preferitiAggiunti } = await import('../app/lib/preferitiRicerche.js');
    let prefs = { lang: 'it' };
    prefs = aggiungiPreferita(prefs, { q: 'milan ac', etichetta: 'Milan Ac', img: 'x.jpg' });
    expect(preferitiAggiunti(prefs)).toHaveLength(1);
    expect(ePreferita(prefs, 'MILAN AC')).toBe(true);
    prefs = aggiungiPreferita(prefs, { q: 'Milan AC', etichetta: 'Milan Ac' }); // stesso, ricopre
    expect(preferitiAggiunti(prefs)).toHaveLength(1);
    prefs = aggiungiPreferita(prefs, { q: 'politica corea', etichetta: 'Politica Corea' });
    expect(preferitiAggiunti(prefs)[0].q).toBe('politica corea'); // l'ultima in testa
    prefs = togliPreferita(prefs, 'milan ac');
    expect(ePreferita(prefs, 'milan ac')).toBe(false);
    expect(preferitiAggiunti(prefs)).toHaveLength(1);
  });
  it('il tetto tiene: mai piu di 12', async () => {
    const { aggiungiPreferita, preferitiAggiunti } = await import('../app/lib/preferitiRicerche.js');
    let prefs = {};
    for (let i = 0; i < 20; i++) prefs = aggiungiPreferita(prefs, { q: `ricerca ${i}` });
    expect(preferitiAggiunti(prefs)).toHaveLength(12);
  });
  it('la stella sta dopo la riga di ricerca e i badge stanno nei Preferiti', () => {
    const n = leggi('app/components/MondoNews.js');
    expect(n).toMatch(/aggiungiPreferita\(prefs, ultimaRicerca\)/);
    expect(n).toMatch(/aggiunte=\{preferitiAggiunti\(prefs\)\}/);
    const p = leggi('app/components/ui/PreferitiTemi.js');
    expect(p).toMatch(/onScegliAggiunta\?\.\(r\.q\)/);
    expect(p).toContain("L('favEmptyHint')");
  });
});

describe('b.535 — la tendina e una sola (niente piu menu di sistema)', () => {
  it('nessuna <select> nativa resta nei componenti', () => {
    const cartelle = ['app/components', 'app/components/ui', 'app/components/Life'];
    for (const dir of cartelle) {
      for (const f of readdirSync(join(process.cwd(), dir)).filter((x) => x.endsWith('.js'))) {
        const s = leggi(`${dir}/${f}`);
        // "<select" seguita da spazio/новаriga/attributo e' JSX vero; nei
        // commenti compare solo come "<select>" e non conta.
        expect(/<select[\s]/.test(s), `${dir}/${f}`).toBe(false);
      }
    }
  });
  it('TendinaVetro esiste, apre un pannello su body e parla da listbox', () => {
    const t = leggi('app/components/ui/TendinaVetro.js');
    expect(t).toContain('createPortal');
    expect(t).toContain("role=\"listbox\"");
    expect(t).toMatch(/e\.key === 'Escape'/);
    expect(t).toContain('document.body');
  });
  it('le nove famiglie di campi la usano', () => {
    for (const f of ['ui/LettoreArticolo', 'VideoCallOverlay', 'QuickInvite', 'LobbyView', 'JoinView', 'Life/LifeView', 'Life/GestioneCompagni', 'Life/GestioneObiettivi']) {
      expect(leggi(`app/components/${f}.js`), f).toContain('TendinaVetro');
    }
  });
});

describe('b.535 — il giornale non e mai vuoto, e il feed apre le porte giuste', () => {
  it('la gazzetta riparte quando il giornale e vuoto (niente bandierina di sessione)', () => {
    const n = leggi('app/components/MondoNews.js');
    // la STORIA della bandierina resta raccontata nel commento del fix:
    // si controlla che non ci sia piu il MECCANISMO, non la parola.
    expect(n).not.toMatch(/window\.__VT_GAZZETTA = true/);
    expect(n).not.toMatch(/\|\| window\.__VT_GAZZETTA\b/);
    expect(n).toContain('if (argomenti !== null || cercando) return;');
  });
  it('«apri e traduci» dal feed chiude il velo e il back ci riporta', () => {
    const n = leggi('app/components/MondoNews.js');
    expect(n).toMatch(/tornaAlFeedRef\.current = true; setFeedAperto\(false\); setLettura/);
    expect(n).toMatch(/if \(tornaAlFeedRef\.current\) \{ tornaAlFeedRef\.current = false; setFeedAperto\(true\); \}/);
  });
  it('si entra nel Mondo sulla presentazione, non sulle stanze', () => {
    expect(leggi('app/components/MondoView.js')).toContain("useState('news')");
  });
});

describe('b.535 — la sidebar a card di vetro e la Home senza doppioni', () => {
  it('le cinque card hanno icona blu, titolo e didascalia leggibile', () => {
    const n = leggi('app/components/MondoNews.js');
    // b.550 — la card e uscita da MondoNews e vive in ui/CardSezione.js:
    // la usano tutte e tre le sidebar, non piu solo le Notizie.
    expect(n).toMatch(/import CardSezione from '\.\/ui\/CardSezione\.js'/);
    expect(leggi('app/components/ui/CardSezione.js')).toMatch(/export default function CardSezione/);
    for (const icona of ['"star"', '"history"', '"globe"', '"target"', '"settings"']) {
      expect(n, `card ${icona}`).toContain(`icona=${icona}`);
    }
    expect(n).toContain('rgba(255,255,255,0.62)'); // didascalie: mai grigio smorto
    expect(n).toMatch(/disabled=\{!cambiato\}/);   // Applica acceso solo se serve
  });
  it('il paese fuori elenco si mostra onesto, e la fotografia segue il globo', () => {
    const v = leggi('app/components/MondoView.js');
    expect(v).toMatch(/\[strumenti, paeseScelto\]/);
    expect(v).toMatch(/!PAESI\.some\(\(pa\) => pa\.codice === bozzaPaesePanello\)/);
    expect(leggi('app/components/MondoNews.js')).toMatch(/!PAESI\.some\(\(pa\) => pa\.codice === bozzaPaese\)/);
  });
  it('in Home resta UNA coppia di bandiere, e il microfono apre ancora «Parla ora»', () => {
    const h = leggi('app/components/HomeView.js');
    expect(h).not.toContain("position: 'absolute', top: 0, left: 0");
    expect((h.match(/getLang\(metaScelta\(prefs\)\)\?\.flag/g) || []).length).toBe(1);
    expect((h.match(/riapriPrimaProva\(\); setMostraPrimaProva\(true\)/g) || []).length).toBe(1);
  });
  it('le chiavi nuove parlano in tutti e 38 i pacchetti', async () => {
    const { readdirSync: ls } = await import('node:fs');
    for (const f of ls(join(process.cwd(), 'app/lib/locales')).filter((x) => x.endsWith('.js'))) {
      const o = (await import(`../app/lib/locales/${f}`)).default;
      for (const k of ['sbWhereTitle', 'addFavWord', 'linguaOriginale', 'favEmptyHint']) {
        expect(typeof o[k], `${f}:${k}`).toBe('string');
      }
    }
    // b.552 — trenta secondi di respiro: questa prova apre a uno a uno
    // TUTTI e 38 i pacchetti (1736 chiavi l'uno) e sul portatile carico
    // i cinque secondi di prammatica non bastano. Non e' lentezza del
    // codice: e' una prova che legge mezzo megabyte di traduzioni.
  }, 30000);
});
