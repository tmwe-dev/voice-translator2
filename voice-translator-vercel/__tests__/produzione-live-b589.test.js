// ═══════════════════════════════════════════════════════════════
// b.589 — riapplicazione del fix b.578 (mai pushato: divergenza fra
// questo ramo e lo sviluppo parallelo fatto con ChatGPT, verificata e
// confermata assente da origin/main al momento di questo intervento)
// + due bug nuovi trovati dall'audit live delle 24h precedenti.
//
// Ogni assert qui sotto e ancorato a un numero reale osservato nei log
// Vercel di produzione, non a un sospetto:
//   · /api/topics/search: 27/123 (22%) di 429 — burst di ricerche
//     automatiche senza pausa.
//   · /api/mondo/avvisi: 553/557 (99%) di 429 — intervallo della
//     campanella ricreato ad ogni crescita del feed.
//   · /api/chat-action: 0 chiamate in 7 giorni nonostante cablata.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');

describe('b.589 — MondoNews: pausa fra ricerche automatiche di ramo (burst 429)', () => {
  const src = leggi('app/components/MondoNews.js');

  it('il giro "Gazzetta" mette in pausa 1500ms prima di ogni ricerca accodata', () => {
    const blocco = src.slice(src.indexOf('const scelti = giri.filter'), src.indexOf('} catch { /* senza default'));
    // due pause: una nel for delle scelti, una prima del giro del mondo
    const occorrenze = (blocco.match(/await new Promise\(\(r\) => setTimeout\(r, 1500\)\);/g) || []).length;
    expect(occorrenze).toBe(2);
  });

  it('il giro dei primi interessi scelti (b.562) mette in pausa allo stesso modo', () => {
    const blocco = src.slice(src.indexOf('const suInteressi = useCallback'), src.indexOf('}, [savePrefs, L, cerca]);'));
    expect(blocco).toContain('await new Promise((r) => setTimeout(r, 1500));');
  });
});

describe('b.589 — MondoNews: una ricerca automatica non si firma mai "perCercato"', () => {
  const src = leggi('app/components/MondoNews.js');

  it('query passata al ponte e vuota quando la ricerca e silenziosa', () => {
    const occorrenze = (src.match(/query: silenziosa \? '' : pulita/g) || []).length;
    expect(occorrenze).toBe(2); // primo mazzo + mazzo pieno
  });
});

describe('b.589 — MondoNews: una ricerca automatica non mostra mai il banner rosso', () => {
  const src = leggi('app/components/MondoNews.js');

  it('la guardia del banner include !silenziosa', () => {
    expect(src).toContain("if (e.name !== 'AbortError' && !dietro && !silenziosa) setErrore('guasto');");
  });
});

describe('b.589 — Campanella: l\'intervallo non si ricrea ad ogni crescita del feed', () => {
  const src = leggi('app/components/ui/Campanella.js');

  it('l\'effetto che monta setInterval dipende solo da "ci sono chiavi", non dal loro contenuto', () => {
    const blocco = src.slice(src.indexOf('const cheHaChiavi ='), src.indexOf('// Esc chiude'));
    expect(blocco).toContain('const t = setInterval(() => caricaRef.current(), OGNI);');
    expect(blocco).toMatch(/\}, \[cheHaChiavi\]\);/);
    // la vecchia forma (dipendenza da carica/chiaviTesto) non deve tornare
    expect(blocco).not.toContain('}, [carica, chiaviTesto]);');
  });

  it('un ref tiene sempre l\'ultima versione di carica(), cosi il timer non deve sapere del contenuto', () => {
    expect(src).toContain('const caricaRef = useRef(carica);');
    expect(src).toContain('useEffect(() => { caricaRef.current = carica; }, [carica]);');
  });
});

describe('b.589 — RoomView: i due bottoni che aprono le Azioni AI hanno l\'etichetta giusta', () => {
  const src = leggi('app/components/RoomView.js');

  it('nessun bottone che apre showChatActions usa piu l\'etichetta "addShort" (foto/file/posizione)', () => {
    expect(src.match(/setShowChatActions\(true\); \}\}\s*\n\s*aria-label=\{L\('chatActionsTitle'\)\}/g)?.length).toBe(2);
    expect(src).not.toMatch(/setShowChatActions\(true\); \}\}\s*\n\s*aria-label=\{L\('addShort'\)\}/);
  });
});
