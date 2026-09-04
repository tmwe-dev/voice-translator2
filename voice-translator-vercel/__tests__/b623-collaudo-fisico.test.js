import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { paeseDaDominio, paeseDellaNotizia } from '../app/lib/paeseDaFonte.js';
import { APP_VERSION } from '../app/lib/constants.js';

// b.623 — Le quattro cose trovate col collaudo fisico dell'app viva.
// Ogni prova qui sotto fallisce se il difetto torna.

const leggi = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

describe('b.623 — il foglio della stanza sta sopra il lettore delle notizie', () => {
  it('CreateRoomSheet sta piu in alto del pannello a schermo pieno di FinestraSulMondo', () => {
    const foglio = leggi('app/components/CreateRoomSheet.js');
    const finestra = leggi('app/components/FinestraSulMondo.js');
    const quotaFoglio = Number(/position:\s*'fixed',\s*inset:\s*0,\s*zIndex:\s*(\d+)/.exec(foglio)?.[1]);
    const quoteFinestra = [...finestra.matchAll(/zIndex:\s*(\d+)/g)].map((m) => Number(m[1]));
    expect(Number.isFinite(quotaFoglio)).toBe(true);
    expect(quotaFoglio).toBeGreaterThan(Math.max(...quoteFinestra));
  });

  it('e resta sotto il foglio del «+», che si chiude da solo', () => {
    const foglio = leggi('app/components/CreateRoomSheet.js');
    const piu = leggi('app/components/NewConversationSheet.js');
    const quotaFoglio = Number(/position:\s*'fixed',\s*inset:\s*0,\s*zIndex:\s*(\d+)/.exec(foglio)?.[1]);
    const quotaPiu = Number(/position:\s*'fixed',\s*inset:\s*0,\s*zIndex:\s*(\d+)/.exec(piu)?.[1]);
    expect(quotaFoglio).toBeLessThan(quotaPiu);
  });
});

describe('b.623 — la versione mostrata e quella vera', () => {
  it('APP_VERSION e allineata all_ultima riga di CLAUDE.md', () => {
    const claude = leggi('CLAUDE.md');
    const primaVersione = /- Versione: \*\*(b\.\d+)\*\*/.exec(claude)?.[1];
    expect(primaVersione).toBeTruthy();
    expect(APP_VERSION).toBe(primaVersione);
  });
});

describe('b.623 — gli aggregatori non danno il paese', () => {
  it('msn.com e yahoo.com non tornano piu US', () => {
    expect(paeseDaDominio('msn.com')).toBeNull();
    expect(paeseDaDominio('yahoo.com')).toBeNull();
    expect(paeseDaDominio('www.msn.com')).toBeNull();
    expect(paeseDaDominio('it.msn.com')).toBeNull();
  });

  it('un articolo del Corriere ripubblicato su MSN non prende la bandiera sbagliata', () => {
    const notizia = { fonti: [{ fonte: 'Corriere della Sera on MSN', dominio: 'msn.com' }], url: 'https://www.msn.com/it-it/notizie/x' };
    expect(paeseDellaNotizia(notizia)).toBeNull();
  });

  it('le testate vere continuano a funzionare', () => {
    expect(paeseDaDominio('corriere.it')).toBe('IT');
    expect(paeseDaDominio('bbc.com')).toBe('GB');
    expect(paeseDaDominio('lemonde.fr')).toBe('FR');
  });
});

describe('b.623 — il feed non dice due cose opposte insieme', () => {
  it('«sto cercando» e «non c_e niente» stanno su due rami diversi', () => {
    const feed = leggi('app/components/FeedNotizieMondo.js');
    // il ramo del vuoto esiste ed e legato a `pronto`
    expect(feed).toContain('{!pronto ? (');
    // e le due frasi non stanno piu nello stesso blocco senza condizione
    const blocco = feed.slice(feed.indexOf('{(!pronto || !elementi.length) && ('), feed.indexOf('{pronto && !!elementi.length'));
    const primaDelRamo = blocco.slice(0, blocco.indexOf('{!pronto ? ('));
    expect(primaDelRamo).not.toContain("L('growingWord')");
    expect(primaDelRamo).not.toContain("L('feedVuoto')");
  });
});
