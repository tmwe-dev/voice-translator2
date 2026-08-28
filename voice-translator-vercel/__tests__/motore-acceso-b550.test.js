import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// ═══ b.550 — tre voci della lista, chiuse ═══

describe('b.550 — il ventaglio delle reazioni e nel feed', () => {
  const feed = leggi('app/components/FeedNotizieMondo.js');
  it('sta nella colonnina, sotto il cuore, su video e articoli', () => {
    expect(feed).toMatch(/import VentaglioReazioni from '\.\/ui\/VentaglioReazioni\.js'/);
    expect((feed.match(/chiave: 'facce'/g) || []).length, 'una per famiglia').toBe(2);
    // la colonnina sa ospitare un pezzo intero, non solo tasti
    expect(feed).toMatch(/\{v\.nodo \? v\.nodo : null\}/);
  });
  it('la faccia si accende subito e il conto si aggiusta prima della rete', () => {
    const dentro = feed.slice(feed.indexOf('const reagisci = useCallback'));
    expect(dentro.indexOf('setMieFacce('), 'prima si accende').toBeLessThan(dentro.indexOf("fetch('/api/mondo/reazioni'"));
    expect(dentro).toMatch(/if \(esito\.prima\) perChiave\[esito\.prima\] = Math\.max\(0,/);
    expect(dentro).toMatch(/if \(esito\.dopo\) perChiave\[esito\.dopo\] =/);
  });
  it('i conteggi delle facce arrivano insieme a quelli dei cuori', () => {
    expect(feed).toMatch(/fetch\(`\/api\/mondo\/reazioni\?chiavi=/);
    expect(feed).toMatch(/Promise\.all\(\[/);
  });
});

describe('b.550 — «avvisami quando arriva qualcuno» finalmente si vede', () => {
  it('il tasto c\'e nella stanza vuota, e usa le parole gia tradotte', () => {
    const m = leggi('app/components/MessageList.js');
    expect(m).toMatch(/L\('warnMeWord'\)/);
    expect(m).toMatch(/L\('warnMeOn'\)/);
    expect(m).toMatch(/onAvvisami\?\.\(\)/);
  });
  it('e la stanza saluta davvero quando qualcuno entra', () => {
    const r = leggi('app/components/RoomView.js');
    expect(r).toMatch(/const chiediAvviso = useCallback/);
    expect(r).toMatch(/if \(otherMembers\.length === 0\) return;/);
    expect(r).toMatch(/L\('warnMeArrived'\)/);
    expect(r, 'una volta sola, non a ogni ridisegno').toMatch(/avvisatoRef\.current = true/);
    expect(r).toMatch(/onAvvisami=\{chiediAvviso\} avvisoAcceso=\{avvisoAcceso\}/);
  });
  it('la parola nuova c\'e in tutti e 38 i pacchetti', async () => {
    for (const f of readdirSync(join(process.cwd(), 'app/lib/locales')).filter((x) => x.endsWith('.js'))) {
      const o = (await import(`../app/lib/locales/${f}`)).default;
      expect(typeof o.warnMeArrived, f).toBe('string');
      expect(typeof o.warnMeWord, f).toBe('string');
    }
  });
});

describe('b.550 — la card di vetro vale per tutte e tre le sidebar', () => {
  it('vive in un posto solo', () => {
    const c = leggi('app/components/ui/CardSezione.js');
    expect(c).toMatch(/export default function CardSezione/);
    expect(c, 'niente grassetto, come da ordine').not.toMatch(/fontWeight: (600|700)/);
  });
  it('Notizie e Mondo la importano dallo stesso posto', () => {
    for (const f of ['MondoNews', 'MondoView']) {
      expect(leggi(`app/components/${f}.js`), f).toMatch(/import CardSezione from '\.\/ui\/CardSezione\.js'/);
    }
    // e in MondoNews non c'e piu la copia locale
    expect(leggi('app/components/MondoNews.js')).not.toMatch(/function CardSezione\(\{ icona/);
  });
  it('nel Mondo le tre sezioni sono dentro le card', () => {
    const v = leggi('app/components/MondoView.js');
    expect(v).toMatch(/<CardSezione icona="star"/);
    expect(v).toMatch(/<CardSezione icona="globe"/);
    expect(v).toMatch(/<CardSezione icona="settings"/);
    expect(v, 'e i preferiti vanno nudi dentro la card').toMatch(/<PreferitiTemi nudo temi=/);
  });
});
