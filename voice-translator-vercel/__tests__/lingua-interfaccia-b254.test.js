// ═══════════════════════════════════════════════════════════════
// b.254 — cambiare lingua dalla home cambia anche l'applicazione.
//
// TROVATO DAL VIVO (Luca, collaudo home, due volte): scelto "Dansk" e poi
// "Cestina" dal selettore in alto, TUTTI i testi restavano in italiano.
//
// La causa non era il selettore: era che `prefs.uiLang` — la lingua dei
// menu — veniva scritta UNA VOLTA SOLA, alla scelta del paese iniziale
// (SceltaPaeseView), e da quel momento non si muoveva piu. L'unico modo
// di cambiarla era scavare in Profilo > Impostazioni: chi non lo sapeva
// non poteva cambiarla nemmeno volendo.
//
// La separazione fra lingua PARLATA e lingua dei MENU (b.136) resta e va
// difesa: un italiano che parla con un americano mette "en" per avere le
// TRADUZIONI in inglese, e non vuole ritrovarsi l'applicazione in
// inglese. Per questo la lingua dei menu segue quella parlata SOLO
// finche non e stata scelta a mano: appena la scegli tu in Impostazioni
// diventa tua e nessuno te la tocca piu.
//
// b.363 — L'AVVISO CON IL TASTO "ANNULLA" NON ESISTE PIU (ordine di Luca:
// «elimina il toast di alert che avvisa, non serve»). Al suo posto la
// difesa contro il cambio non voluto e diventata PREVENTIVA: il carosello
// delle bandiere chiede CONFERMA prima di cambiare, invece di scusarsi
// dopo. Le prove che qui sotto guardavano l'avviso e il suo "annulla"
// guardano ora la conferma: e quello, oggi, il percorso vivo.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { mapLang } from '../app/lib/i18n.js';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');
const home = () => leggi('app/components/HomeView.js');
const carosello = () => leggi('app/components/CarouselLingue.js');

describe('la lingua dei menu segue quella che dichiari di parlare', () => {
  it('scegliendo una lingua dalla home si scrive ANCHE uiLang', () => {
    expect(home()).toMatch(/\{ \.\.\.prefs, lang: l\.code, uiLang: dopo \}/);
  });

  it('ma non si tocca se l\'hai gia scelta tu', () => {
    const s = home();
    expect(s).toMatch(/prefs\.uiLangScelta\s*\n?\s*\?\s*\{ \.\.\.prefs, lang: l\.code \}/);
  });

  it('e la lingua dei menu passa sempre da mapLang: solo le 15 che esistono', () => {
    // Il selettore della home elenca 44 lingue (quelle in cui si traduce),
    // l'interfaccia ne ha 15. Senza mappatura si scriverebbe un uiLang che
    // nessun pacchetto lingua conosce, e i menu resterebbero in inglese
    // senza che nessuno capisca perche.
    expect(home()).toMatch(/const dopo = mapLang\(l\.code\);/);
    // b.260 — danese e ceco ORA esistono (mini-pacchetto / pacchetto pieno)
    expect(mapLang('da')).toBe('da');
    expect(mapLang('cs')).toBe('cs');
    expect(mapLang('ja')).toBe('ja');   // giapponese: c'e, resta
  });
});

describe('il cambio non arriva addosso a nessuno: prima si conferma', () => {
  it('scorrere le bandiere NON cambia la lingua', () => {
    // Prima la bandiera che si fermava al centro diventava la lingua da
    // sola: cercando un paese e passandone cinque, la lingua cambiava
    // cinque volte e mezza interfaccia si ricaricava sotto le dita.
    const s = carosello();
    const scorri = s.match(/const scorri = useCallback[\s\S]*?\}, \[totale\]\);/)[0];
    expect(scorri).toBeTruthy();
    expect(scorri).not.toMatch(/scegli|onScegli/);
    // e non c'e nemmeno un ritardo che sceglie da solo dopo un attimo di quiete
    expect(s).not.toMatch(/setTimeout\([\s\S]{0,200}?(scegli|onScegli)\(/);
  });

  it('la lingua la cambia il tasto di conferma, che dice quale lingua sara', () => {
    // "Usa Dansk": si legge PRIMA di premere che cosa si sta per ottenere.
    const s = carosello();
    expect(s).toMatch(/onClick=\{\(\) => scegli\(alCentro\)\}/);
    expect(s).toMatch(/\{L\('useWord'\)\} \{alCentro\.name\}/);
  });

  it('e il tasto SOSTITUISCE il nome: sotto non si sposta niente', () => {
    // Se il tasto si aggiungesse, microfono, QR e sezioni scenderebbero di
    // trenta pixel a ogni bandiera che passa, e il contenuto scapperebbe
    // sotto le dita di chi sta guardando.
    const posto = carosello().match(/<div aria-live="polite"[\s\S]*?<\/div>/)[0];
    expect(posto).toMatch(/height: 30/);                        // il posto e fissato
    expect(posto).toMatch(/alCentro\.code === selezionata \?/); // o il nome O il tasto
    expect(posto).toMatch(/scegli\(alCentro\)/);
  });

  it('ma dall\'elenco completo la scelta e immediata: li si sceglie davvero', () => {
    expect(carosello()).toMatch(/onClick=\{\(\) => \{ setAperto\(false\); scegli\(l\); \}\}/);
  });

  it('e appena si conferma, il pacchetto della lingua nuova parte subito', () => {
    // Senza precaricarlo i menu resterebbero in inglese per qualche istante
    // proprio nel momento in cui si e chiesto di cambiarli.
    expect(home()).toMatch(/if \(!prefs\.uiLangScelta && dopo !== prima\) preloadLang\(dopo\);/);
  });

  it('scegliendola dalle Impostazioni e tua e resta tua', () => {
    expect(leggi('app/components/SettingsView.js')).toMatch(/uiLang: codice, uiLangScelta: true/);
  });
});

describe('le due chiavi usate esistono in tutte le lingue dell\'interfaccia', () => {
  // Un tasto che ripiega in inglese proprio mentre offre di cambiare lingua
  // sarebbe la dimostrazione del contrario di cio che dice.
  // b.363 — `cancelWord` era la parola dell'avviso annullabile: con l'avviso
  // e sparito anche il suo unico uso. La chiave viva ora e `useWord`, quella
  // del tasto di conferma del carosello.
  const LINGUE = ['it','en','es','fr','de','pt','zh','ja','ko','th','ar','hi','ru','tr','vi'];
  for (const l of LINGUE) {
    it(`${l}: uiLanguage e useWord`, () => {
      const dizionario = leggi(`app/lib/locales/${l}.js`);
      expect(dizionario).toContain('"uiLanguage"');
      expect(dizionario).toContain('"useWord"');
    });
  }
});

describe('cio che NON deve essersi rotto (b.136)', () => {
  it('L() continua a leggere uiLang, non la lingua parlata', () => {
    const ctx = leggi('app/contexts/AppContext.js');
    expect(ctx).toMatch(/value\.prefs\?\.uiLang \|\| mapLang\(value\.prefs\?\.lang \|\| 'en'\)/);
  });
});
