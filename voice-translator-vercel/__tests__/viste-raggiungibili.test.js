// ═══════════════════════════════════════════════════════════════
// GUARDIA SULLE VISTE IRRAGGIUNGIBILI
//
// Nato da un buco vero: la pagina "Entra con un codice" (view 'join')
// esisteva, era completa e funzionante, ma NESSUN pulsante dell'app la
// apriva. Ci si arrivava solo con un link o un QR: se un amico ti
// dettava il codice a voce, non c'era posto dove scriverlo.
//
// Il test sui file orfani non poteva accorgersene: JoinView.js era
// importato regolarmente. A mancare era la NAVIGAZIONE.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const APP = path.join(__dirname, '..', 'app');

function tuttiISorgenti(dir, trovati = []) {
  for (const voce of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, voce.name);
    if (voce.isDirectory()) {
      if (voce.name === 'attic' || voce.name === 'node_modules') continue;
      tuttiISorgenti(p, trovati);
    } else if (voce.name.endsWith('.js')) {
      trovati.push(fs.readFileSync(p, 'utf8'));
    }
  }
  return trovati;
}

describe('navigazione', () => {
  it('ogni vista gestita in page.js è apribile da qualche parte', () => {
    const pageSrc = fs.readFileSync(path.join(APP, 'page.js'), 'utf8');
    const tutto = tuttiISorgenti(APP).join('\n');

    // Le viste che page.js sa disegnare.
    const viste = [...new Set([...pageSrc.matchAll(/view === '([a-zA-Z-]+)'/g)].map(m => m[1]))];

    // Viste raggiunte per forza di cose, non da un pulsante dell'app:
    //  loading      → stato iniziale
    //  welcome      → primo avvio
    //  room, lobby  → conseguenza dell'entrare in una stanza
    //  taxi-driver  → ci arriva il TASSISTA scansionando il QR (?taxi=...),
    //                 non l'utente dell'app: e un ingresso esterno voluto
    const automatiche = new Set(['loading', 'welcome', 'room', 'lobby', 'taxi-driver']);

    // b.551 — LA BARRA IN BASSO APRE SENZA NOMINARE. BottomNav non scrive
    // `setView('stanze')`: tiene un elenco di viste per ogni voce e apre
    // la prima (`handleTabClick(item.views[0])`). Con la sola ricerca
    // testuale «stanze» risultava irraggiungibile, mentre e' proprio la
    // vista che il tasto «Chat» apre da b.537.
    // Cio che questa prova difende — che nessuna pagina resti orfana —
    // vale ancora: si guarda anche l'elenco della barra.
    const dallaBarra = new Set(
      [...tutto.matchAll(/views: \[([^\]]+)\]/g)]
        .flatMap((m) => [...m[1].matchAll(/'([a-zA-Z-]+)'/g)].map((x) => x[1])),
    );

    const irraggiungibili = viste.filter(v => {
      if (automatiche.has(v)) return false;
      if (dallaBarra.has(v)) return false;
      return !tutto.includes(`setView('${v}')`);
    });

    expect(irraggiungibili,
      `Queste pagine esistono ma nessun pulsante le apre:\n  ${irraggiungibili.join('\n  ')}`
    ).toEqual([]);
  });

  it('il tasto "+" non ripete le voci della Home', () => {
    const home = fs.readFileSync(path.join(APP, 'components', 'HomeView.js'), 'utf8');
    const piu = fs.readFileSync(path.join(APP, 'components', 'NewConversationSheet.js'), 'utf8');
    const vociHome = [...home.matchAll(/id:\s*'([a-z-]+)'/g)].map(m => m[1]);
    const vociPiu = [...piu.matchAll(/id:\s*'([a-z-]+)'/g)].map(m => m[1]);
    const doppioni = vociPiu.filter(v => vociHome.includes(v));
    expect(doppioni,
      `Il tasto piu in vista dell'app non deve ripetere la Home:\n  ${doppioni.join('\n  ')}`
    ).toEqual([]);
  });
});
