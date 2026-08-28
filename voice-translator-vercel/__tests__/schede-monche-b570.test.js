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
    expect(news).toMatch(/const \[primoIncontro, setPrimoIncontro\] = useState\(null\);/);
    expect(news).toMatch(/\{primoIncontro === true && daChiedere\(prefs\) && \(/);
  });
});

describe('③ il giornale deve poter partire anche DOPO la domanda', () => {
  it('l attesa non e definitiva: l effetto puo ripartire', () => {
    expect(news).toMatch(/if \(primoIncontro === null\) return;/);
    expect(news, 'le dipendenze non sono piu vuote')
      .toMatch(/\}, \[primoIncontro, prefs\?\.interessi, prefs\?\.interessiSaltati, prefs\?\.ricercheRecenti\?\.length\]\);/);
  });

  it('ma la guardia contro la doppia ricerca resta', () => {
    // se no, ad ogni cambio di preferenze partirebbero tre ricerche.
    expect(news).toMatch(/if \(argomenti !== null \|\| cercando\) return;/);
  });
});

// ═══════════════════════════════════════════════════════════════
// b.571 — NESSUN SUONO SENZA IMMAGINE
//
// Collaudo di Luca: «e partito un video non so dove, si sente l'audio ma
// non vedo niente», col feed vuoto a schermo.
//
// Non sono riuscito a riprodurlo — e lo dico invece di far finta di
// aver capito. Ma la regola non ha eccezioni e vale per ogni strada che
// possa produrlo: se non c'e' niente da guardare, non ci deve essere
// niente da sentire. Quindi si parla a TUTTI i player della pagina,
// anche a quelli che non sappiamo di avere.
// ═══════════════════════════════════════════════════════════════
describe('b.571 — nessun suono senza immagine', () => {
  const feed = leggi('app/components/FeedNotizieMondo.js');

  it('quando il feed si chiude o si svuota, tutti i player si fermano', () => {
    expect(feed).toMatch(/if \(aperto && elementi\.length\) return;/);
    expect(feed).toMatch(/pauseVideo/);
  });

  it('si parla a tutti gli iframe di YouTube, non solo a quelli che conosciamo', () => {
    const i = feed.indexOf('NESSUN SUONO SENZA IMMAGINE');
    const blocco = feed.slice(i, i + 1600);
    expect(blocco).toMatch(/document\.querySelectorAll\('iframe'\)/);
    expect(blocco).toMatch(/\/youtube\/\.test\(f\.src \|\| ''\)/);
  });

  it('e un player che non risponde non ferma la pagina', () => {
    const i = feed.indexOf('NESSUN SUONO SENZA IMMAGINE');
    expect(feed.slice(i, i + 1600)).toMatch(/catch \{ \/\* un player che non risponde/);
  });
});

// ═══════════════════════════════════════════════════════════════
// b.572 — LO STESSO SCHIANTO, DUE DITA PIU IN BASSO
//
// Collaudo di Luca, mezz'ora dopo: «hai rotto il codice di nuovo».
// Stesso errore di ieri, «Cannot read properties of undefined», su una
// scheda senza `fonti`. Due colpe distinte, e vanno dette separate:
//
// ① In b.570 ho protetto UNA riga (`t.fonti?.[0]`) e ho lasciato la
//    gemella a due dita di distanza (`t.fonti.slice(0,3)`), sulla
//    stessa scheda, sullo stesso campo. Un difetto non e' una riga: e'
//    un'abitudine, e va cercata dappertutto invece che tappata dove fa
//    male.
//
// ② Peggio: avevo aggiustato solo chi SCRIVE il giornale. Nei telefoni
//    era gia posato quello vecchio, e JSON non salva le chiavi
//    `undefined`: quelle schede tornavano su senza `fonti` del tutto.
//    Aggiustare chi scrive non guarisce cio che e' gia scritto — chi
//    legge da un deposito rimette in forma all'ingresso.
// ═══════════════════════════════════════════════════════════════
describe('b.572 — nessuna scheda puo far cadere il Mondo', () => {
  it('il giornale rimette in forma anche le schede vecchie, senza fonti', () => {
    const vecchio = { quando: Date.now(), argomenti: [{ id: 'a', titolo: 'x', url: 'u' }], video: [] };
    localStorage.setItem('vt-giornale', JSON.stringify(vecchio));
    const letto = giornaleSalvato();
    expect(Array.isArray(letto.argomenti[0].fonti)).toBe(true);
    expect(letto.argomenti[0].fonti).toEqual([]);
  });

  it('e anche la riga gemella che avevo mancato non da niente per scontato', () => {
    const news = leggi('app/components/MondoNews.js');
    expect(news).not.toMatch(/\{t\.fonti\.slice\(/);
    expect(news).not.toMatch(/\{t\.fonti\.length\}/);
    expect(news).toMatch(/\(t\.fonti \|\| \[\]\)\.slice\(0, 3\)/);
  });

  it('la Vita ha la stessa protezione, cercata e non aspettata', () => {
    const life = leggi('app/components/Life/LifeView.js');
    expect(life).not.toMatch(/aperta\.fonti\.length/);
  });
});

// ═══════════════════════════════════════════════════════════════
// b.572 — UN GUARDIANO CHE DICE SEMPRE SI NON E' UN GUARDIANO
//
// «onboarding appare ancora per un istante» (Luca). Il guardiano di
// b.570 contava le chiavi delle preferenze — ma le preferenze NASCONO
// gia piene di valori predefiniti, quindi rispondeva «lo so» dal primo
// istante, per chiunque. L'avevo dedotto invece di verificarlo.
// Ora la domanda si decide all'ingresso guardando le preferenze POSATE,
// e ha tre risposte: non lo so (e allora si tace), ci conosciamo, sei
// nuovo. Il silenzio non si vede; una domanda sbagliata si vede eccome.
// ═══════════════════════════════════════════════════════════════
describe('b.572 — la domanda si decide da cio che e posato', () => {
  it('finche non lo so, non si chiede niente', () => {
    const news = leggi('app/components/MondoNews.js');
    expect(news).toMatch(/const \[primoIncontro, setPrimoIncontro\] = useState\(null\);/);
    expect(news).toMatch(/\{primoIncontro === true && daChiedere\(prefs\) && \(/);
  });

  it('la decisione guarda le preferenze posate sull apparecchio', () => {
    const news = leggi('app/components/MondoNews.js');
    expect(news).toMatch(/JSON\.parse\(memGet\('vt-prefs'\) \|\| 'null'\)/);
  });

  it('rispondere o saltare chiude la porta subito, senza aspettare il giro lungo', () => {
    const news = leggi('app/components/MondoNews.js');
    expect((news.match(/setPrimoIncontro\(false\)/g) || []).length).toBe(2);
  });

  it('e il giornale non resta ostaggio della domanda', () => {
    const news = leggi('app/components/MondoNews.js');
    expect(news).toMatch(/if \(primoIncontro === null\) return;/);
    expect(news).toMatch(/prefs\?\.ricercheRecenti\?\.length\]\);/);
  });
});
