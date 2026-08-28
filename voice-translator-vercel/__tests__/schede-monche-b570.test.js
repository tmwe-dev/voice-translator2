// ═══════════════════════════════════════════════════════════════
// b.570 — «È APPARSA PER UN ISTANTE, POI SI È ROTTO TUTTO»
//
// Collaudo di Luca sull'applicazione vera, e sono tre difetti uno
// dentro l'altro — tutti nati dal lavoro di oggi.
//
// ① LO SCHERMO ROSSO: «Cannot read properties of undefined (reading
//    '0')». La riga colpevole era `t.fonti[0]?.fonte` — col punto
//    interrogativo sul SECONDO passo ma non sul primo. Ha retto per
//    mesi perche' tutte le schede avevano `fonti`... finche' il giornale
//    salvato (b.564) non ha cominciato a produrne senza, per non
//    riempire la memoria del telefono.
//    LEZIONE: quando si introduce una forma NUOVA di un dato che gia
//    circola, si guarda chi lo legge. Il difetto non e' dove esplode.
//
// ② IL LAMPEGGIO: l'accoglienza compariva un istante anche a chi
//    l'aveva gia fatta. Al primo disegno le preferenze non sono ancora
//    arrivate dal server, e un oggetto vuoto SEMBRA uno che non ha mai
//    scelto niente. «Non lo so ancora» e «non ha scelto» sono due cose
//    diverse, e confonderle si vede a schermo.
//
// ③ IL FEED CHE NON TORNAVA PIU: l'effetto che fa partire la Gazzetta
//    girava UNA volta sola (dipendenze vuote). Chi vedeva la domanda
//    usciva da quel giro con `return` e non ne rientrava mai — nemmeno
//    dopo aver risposto. Ecco il «poi si e' rotto tutto».
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { salvaGiornale, giornaleSalvato } from '../app/lib/giornaleSalvato.js';

const leggi = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const news = leggi('app/components/MondoNews.js');

describe('① una scheda non deve mai uscire monca', () => {
  it('il giornale salvato consegna sempre un elenco di fonti, anche vuoto', () => {
    salvaGiornale([{ id: 'v1', titolo: 'Senza fonti', url: 'https://a.it/1' }], []);
    const scheda = giornaleSalvato().argomenti[0];
    expect(Array.isArray(scheda.fonti), 'un elenco vuoto, non il nulla').toBe(true);
    expect(scheda.fonti).toEqual([]);
  });

  it('e chi le legge si difende comunque dal primo passo', () => {
    // la difesa a valle serve lo stesso: domani arrivera un'altra
    // strada che produce schede diverse, e non si puo rincorrere ogni
    // punto del codice ogni volta.
    expect(news, 'niente t.fonti[0] senza punto interrogativo').not.toMatch(/t\.fonti\[0\]/);
    expect(news).toMatch(/t\.fonti\?\.\[0\]\?\.fonte \|\| '·'/);
  });

  it('nessun altro punto legge un elenco senza difendersi', () => {
    const nudi = [];
    for (const f of ['app/components/MondoNews.js', 'app/components/FeedNotizieMondo.js']) {
      const s = leggi(f);
      for (const m of s.matchAll(/(\w+)\.(fonti|video|argomenti|righe)\[0\]/g)) {
        nudi.push(`${f}: ${m[0]}`);
      }
    }
    expect(nudi, `letture senza difesa:\n  ${nudi.join('\n  ')}`).toEqual([]);
  });
});

describe('② «non lo so ancora» non e «non ha scelto»', () => {
  it('finche le preferenze non sono arrivate, non si chiede niente', () => {
    expect(news).toMatch(/const prefsPronte = !!prefs && Object\.keys\(prefs\)\.length > 0;/);
    expect(news).toMatch(/\{prefsPronte && daChiedere\(prefs\) && \(/);
  });
});

describe('③ il giornale deve poter partire anche DOPO la domanda', () => {
  it('l attesa non e definitiva: l effetto puo ripartire', () => {
    expect(news).toMatch(/if \(!prefsPronte \|\| daChiedere\(prefs\)\) return;/);
    expect(news, 'le dipendenze non sono piu vuote')
      .toMatch(/\}, \[prefsPronte, prefs\?\.interessi, prefs\?\.interessiSaltati\]\);/);
  });

  it('ma la guardia contro la doppia ricerca resta', () => {
    // se no, ad ogni cambio di preferenze partirebbero tre ricerche.
    expect(news).toMatch(/if \(argomenti !== null \|\| cercando\) return;/);
  });
});
