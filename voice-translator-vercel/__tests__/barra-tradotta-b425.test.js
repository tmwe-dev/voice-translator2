// ═══════════════════════════════════════════════════════════════
// b.425 — LA BARRA IN BASSO PARLA LA LINGUA DI CHI GUARDA.
//
// TROVATO NEL COLLAUDO FISICO DEL 23/08, non da un audit: messa
// l'interfaccia in turco, tre voci su quattro dicevano «Ana sayfa»,
// «Sohbetler», «Profil» — e la quarta «Community».
//
//   app/components/BottomNav.js:85
//   { id: 'community', label: 'Community', views: ['mondo'] },
//
// Scritta a mano, non una chiave: restava in inglese in TUTTE e
// trentotto le lingue. E' la stessa malattia che b.370 aveva chiuso
// altrove («nessuna lingua di serie B»), sopravvissuta qui perche la
// guardia sulle stringhe cablate non guardava dentro questo file.
//
// Quindi non basta tradurla: serve qualcosa che si accorga della
// PROSSIMA. E' questo file.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { t, preloadLang } from '../app/lib/i18n.js';

const RADICE = process.cwd();
const leggi = (p) => readFileSync(join(RADICE, p), 'utf8');
const LINGUE = readdirSync(join(RADICE, 'app/lib/locales'))
  .filter((f) => f.endsWith('.js')).map((f) => f.replace('.js', '')).sort();

const senzaCommenti = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('nessuna voce della barra e scritta a mano', () => {
  const src = senzaCommenti(leggi('app/components/BottomNav.js'));

  it('ogni voce prende la scritta dal pacchetto lingua', () => {
    // le righe dell'elenco: { id: '...', label: ..., views: [...] }
    const righe = [...src.matchAll(/\{\s*id:\s*'([a-z-]+)'\s*,\s*label:\s*([^,]+),/g)];
    expect(righe.length, 'le voci della barra si trovano').toBeGreaterThanOrEqual(4);
    for (const [, id, etichetta] of righe) {
      expect(etichetta.trim(), [
        `La voce «${id}» ha la scritta cablata: ${etichetta.trim()}`,
        'Resterebbe cosi in tutte e trentotto le lingue.',
        "Usa L('nav...') e aggiungi la chiave a tutti i pacchetti.",
      ].join('\n')).toMatch(/^L\(/);
    }
  });

  it('e in particolare Community, che era quella rotta', () => {
    expect(src).toMatch(/id:\s*'community'[\s\S]{0,40}label:\s*L\('navCommunity'\)/);
  });
});

describe('e la chiave esiste davvero, in tutte le lingue', () => {
  it('nessun pacchetto mostra la chiave grezza', async () => {
    for (const l of LINGUE) {
      await preloadLang(l);
      const v = t(l, 'navCommunity');
      expect(v, `${l}: chiave mancante`).not.toBe('navCommunity');
      expect(String(v).trim(), `${l}: chiave vuota`).not.toBe('');
    }
  });

  it('e la maggior parte delle lingue la traduce davvero', async () => {
    // In alcune lingue «Community» E' la parola giusta (l'italiano e il
    // tedesco la usano tali e quali): non si pretende che TUTTE cambino,
    // si pretende che non sia rimasta uguale dappertutto — che era il
    // difetto.
    let diverse = 0;
    for (const l of LINGUE) { await preloadLang(l); if (t(l, 'navCommunity') !== 'Community') diverse += 1; }
    expect(diverse, 'quasi nessuna lingua la traduce: la chiave e finta').toBeGreaterThan(LINGUE.length / 2);
  });
});
