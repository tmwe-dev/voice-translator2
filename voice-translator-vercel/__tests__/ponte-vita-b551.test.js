import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// ═══ b.551 — le ultime voci della lista ═══

describe('b.551 — «Parlane con chi?»: il ponte fra una notizia e Vita', () => {
  it('le quattro strade ci sono tutte', async () => {
    const { MODI } = await import('../app/components/ui/ParlaneCon.js');
    expect(MODI.map((m) => m.id)).toEqual(['persone', 'compagno', 'tavolo', 'podcast']);
    // ognuna dice cosa fa: Luca «le scelte devono essere chiare»
    for (const m of MODI) {
      expect(typeof m.titolo, m.id).toBe('string');
      expect(typeof m.sotto, m.id).toBe('string');
    }
  });
  it('le persone restano la stanza di sempre, le altre tre portano in Vita', () => {
    const n = leggi('app/components/MondoNews.js');
    expect(n).toMatch(/if \(modo === 'persone'\) \{ onParlane\?\.\(contenuto\); return; \}/);
    expect(n).toMatch(/sesSet\('vt-vita-da-mondo'/);
    expect(n).toMatch(/setView\('life'\)/);
    // il velo si chiude in cima a smistaParlane, prima di sapere quale
    // strada si prende: cosi vale per tutte e quattro (b.542 insegna).
    const smista = n.slice(n.indexOf('const smistaParlane'), n.indexOf('const smistaParlane') + 1200);
    expect(smista.indexOf('setFeedAperto(false)'), 'il velo si chiude per primo').toBeLessThan(smista.indexOf("if (modo === 'persone')"));
  });
  it('e Vita raccoglie l\'argomento e atterra sulla scheda giusta', () => {
    const v = leggi('app/components/Life/LifeView.js');
    expect(v).toMatch(/sesGet\('vt-vita-da-mondo'/);
    expect(v, 'si consuma una volta sola').toMatch(/sesDel\('vt-vita-da-mondo'\)/);
    expect(v).toMatch(/\['tavolo', 'podcast', 'amico'\]\.includes\(dono\.scheda\)/);
    expect(v).toMatch(/setTavoloPreset\(dono\.argomento\)/);
  });
});

describe('b.551 — l\'Interprete del video', () => {
  it('le frasi spezzate si ricuciono in frasi compiute', async () => {
    const { frasiCompiute } = await import('../app/lib/interpreteVideo.js');
    const righe = [
      { inizio: 0, fine: 2, testo: 'Both countries accused' },
      { inizio: 2, fine: 4, testo: 'other of firing first.' },
      { inizio: 4, fine: 6, testo: 'Tensions had been rising.' },
    ];
    const frasi = frasiCompiute(righe);
    expect(frasi).toHaveLength(2);
    expect(frasi[0].testo).toBe('Both countries accused other of firing first.');
    expect(frasi[0].inizio).toBe(0);
    expect(frasi[0].fine).toBe(4);
    expect(frasiCompiute([])).toEqual([]);
    expect(frasiCompiute(null)).toEqual([]);
  });
  it('la rincorsa di cinque secondi c\'e davvero', async () => {
    const { RINCORSA_MS, prossimaDaDire, chiaveFrase } = await import('../app/lib/interpreteVideo.js');
    expect(RINCORSA_MS).toBe(5000);
    const frasi = [{ inizio: 10, fine: 12, testo: 'una' }, { inizio: 20, fine: 22, testo: 'due' }];
    // a 6 secondi si prepara gia quella che comincia a 10 (entro i 5 di rincorsa)
    expect(prossimaDaDire(frasi, 6, new Set())?.testo).toBe('una');
    // e non si ripete cio che e gia stato detto
    // la chiave la fa il modulo (chiaveFrase): scriversela a mano qui
    // vorrebbe dire fotografare un dettaglio interno invece di usarlo.
    const dette = new Set([chiaveFrase(frasi[0])]);
    const p = prossimaDaDire(frasi, 6, dette);
    expect(p === null || p.testo !== 'una').toBe(true);
  });
  it('la via asiatica vale per le lingue giuste (ordine permanente di Luca)', async () => {
    const { viaAsiatica } = await import('../app/lib/interpreteVideo.js');
    for (const l of ['zh', 'ja', 'ko', 'th', 'vi']) expect(viaAsiatica(l), l).toBe(true);
    for (const l of ['it', 'en', 'de', 'fr', 'es']) expect(viaAsiatica(l), l).toBe(false);
  });
  it('si offre SOLO dove i sottotitoli esistono', async () => {
    const { disponibile } = await import('../app/lib/interpreteVideo.js');
    expect(disponibile([])).toBe(false);
    expect(disponibile(null)).toBe(false);
    expect(disponibile([{ inizio: 0, fine: 1, testo: 'ciao' }])).toBe(true);
  });
  it('e il feed lo monta, col player che si lascia comandare', () => {
    const f = leggi('app/components/FeedNotizieMondo.js');
    expect(f).toMatch(/<InterpreteVideo videoId=\{el\.dati\.id\}/);
    expect(f, 'senza enablejsapi il player non si silenzia').toMatch(/enablejsapi=1/);
  });
});

describe('b.551 — il «+» della barra non ha piu doppioni', () => {
  it('restano solo le due porte che apre da solo', async () => {
    const n = leggi('app/components/NewConversationSheet.js');
    const ids = [...n.matchAll(/\{ id: '([a-z-]+)'/g)].map((m) => m[1]);
    expect(ids).toEqual(['stanza-community', 'contatti']);
    // «entra col codice» e l'archivio vivono dentro Stanze, da b.537
    const s = leggi('app/components/StanzeView.js');
    expect(s).toMatch(/setView\('join'\)/);
    expect(s).toMatch(/setView\('history'\)/);
  });
});

describe('b.551 — le parole nuove ci sono ovunque', () => {
  it('in tutti e 38 i pacchetti', async () => {
    for (const f of readdirSync(join(process.cwd(), 'app/lib/locales')).filter((x) => x.endsWith('.js'))) {
      const o = (await import(`../app/lib/locales/${f}`)).default;
      for (const k of ['parlaneConTitolo', 'parlaneConTavolo', 'interpreteTitolo', 'interpreteVoce']) {
        expect(typeof o[k], `${f}:${k}`).toBe('string');
      }
    }
  });
});
