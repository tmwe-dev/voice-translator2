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
// finche non e stata scelta a mano: appena la scegli tu (in Impostazioni,
// o annullando dall'avviso) diventa tua e nessuno te la tocca piu.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { mapLang } from '../app/lib/i18n.js';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');
const home = () => leggi('app/components/HomeView.js');

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

describe('chi non voleva il cambio se lo riprende in un tocco', () => {
  it('l\'avviso arriva solo quando la lingua dei menu cambia davvero', () => {
    const s = home();
    expect(s).toMatch(/if \(!prefs\.uiLangScelta && dopo !== prima\)/);
  });

  it('ed e scritto nella lingua NUOVA, non in quella che si sta lasciando', () => {
    // Un avviso che annuncia il cambio nella lingua vecchia e inutile
    // proprio a chi il cambio lo ha appena chiesto.
    expect(home()).toMatch(/t\(dopo, 'uiLanguage'\)/);
    expect(home()).toMatch(/t\(dopo, 'cancelWord'\)/);
  });

  it('annullando si torna indietro E la scelta diventa esplicita', () => {
    // Senza `uiLangScelta: true` l'avviso ricomparirebbe al cambio dopo:
    // aver detto "no" una volta deve valere per sempre.
    expect(home()).toMatch(/uiLang: prima, uiLangScelta: true/);
  });

  it('scegliendola dalle Impostazioni vale lo stesso: e tua e resta tua', () => {
    expect(leggi('app/components/SettingsView.js')).toMatch(/uiLang: codice, uiLangScelta: true/);
  });
});

describe('le due chiavi usate esistono in tutte le lingue dell\'interfaccia', () => {
  // Un avviso che ripiega in inglese proprio mentre annuncia il cambio di
  // lingua sarebbe la dimostrazione del contrario di cio che dice.
  const LINGUE = ['it','en','es','fr','de','pt','zh','ja','ko','th','ar','hi','ru','tr','vi'];
  for (const l of LINGUE) {
    it(`${l}: uiLanguage e cancelWord`, () => {
      const dizionario = leggi(`app/lib/locales/${l}.js`);
      expect(dizionario).toContain('"uiLanguage"');
      expect(dizionario).toContain('"cancelWord"');
    });
  }
});

describe('cio che NON deve essersi rotto (b.136)', () => {
  it('L() continua a leggere uiLang, non la lingua parlata', () => {
    const ctx = leggi('app/contexts/AppContext.js');
    expect(ctx).toMatch(/value\.prefs\?\.uiLang \|\| mapLang\(value\.prefs\?\.lang \|\| 'en'\)/);
  });
});
