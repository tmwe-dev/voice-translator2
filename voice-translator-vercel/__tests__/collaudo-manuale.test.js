// ═══════════════════════════════════════════════════════════════
// GUARDIE NATE DAL COLLAUDO A MANO (b.90)
//
// Ognuna corrisponde a un difetto visto cliccando davvero nel browser.
// Se una di queste fallisce, quel difetto è tornato.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const APP = path.join(__dirname, '..', 'app');
const leggi = (p) => fs.readFileSync(path.join(APP, p), 'utf8');

describe('collaudo manuale — difetti che non devono tornare', () => {
  it('se l\'IA cade, la traduzione ha una rete di sicurezza', () => {
    // Con la chiave OpenAI scaduta ogni traduzione dava 502 e l'app
    // restava muta, pur avendo un traduttore gratuito funzionante.
    const src = leggi('api/translate/route.js');
    expect(src, 'deve ripiegare sul traduttore gratuito').toMatch(/tryGoogleTranslate/);
    expect(src, 'e dichiararlo alla UI').toMatch(/ripiego:\s*true/);
  });

  it('la barra di navigazione segue il tema', () => {
    // Nel tema chiaro restava nera: Home, Chat e Community sparivano.
    const src = leggi('components/BottomNav.js');
    expect(src, 'il fondo deve venire dal tema').toMatch(/backgroundColor:\s*C\.headerBg/);
  });

  it('la barra di scrittura non finisce sotto il menu', () => {
    // Il campo esisteva ma stava sotto i 76px del menu fisso.
    const src = leggi('components/SpeakerView.js');
    expect(src, 'la pagina deve lasciare spazio al menu').toMatch(/paddingBottom:\s*'calc\(76px/);
  });

  it('i comandi al centro di TaxiTalk sono pulsanti veri', () => {
    const src = leggi('components/SpeakerView.js');
    // Prima erano <div> con aria da tasto: si cliccava e non succedeva nulla.
    expect(src).toMatch(/azione:\s*\(\)\s*=>\s*\{[^}]*setMirrorMode\(true\)/);
    expect(src).toMatch(/campoTestoRef\.current\?\.focus\(\)/);
  });

  it('"Videochiamata" non è più identica a "Parla con chi hai davanti"', () => {
    const src = leggi('page.js');
    expect(src, 'la scelta del video va ricordata').toMatch(/setIntentoVideo\(true\)/);
    expect(leggi('components/LobbyView.js'), 'e la sala d\'attesa deve dirlo').toMatch(/perVideo/);
  });

  it('il codice della stanza non è del colore degli errori', () => {
    const src = leggi('components/LobbyView.js');
    expect(src, 'accent3 è il rosso degli errori').not.toMatch(/accent3\}\}>\{roomId\}/);
  });

  it('il QR mostra un segnaposto invece di un rettangolo bianco', () => {
    // b.482 — QUESTA PROVA DIFENDEVA UNA FRASE, NON UN COMPORTAMENTO, ed e
    // la trappola numero 6 per l'ennesima volta: pretendeva di trovare alla
    // lettera l'italiano «Preparo il codice» dentro la sala d'attesa. Ma
    // quella frase era proprio il difetto — una parola scritta a mano in
    // mezzo a una schermata tradotta in trentotto lingue — e la prova la
    // teneva in vita. Adesso chiede la cosa vera: finche il codice non e
    // pronto, al suo posto c'e qualcosa da leggere, e quel qualcosa viene
    // dal pacchetto lingua.
    const src = leggi('components/LobbyView.js');
    expect(src, 'il segnaposto compare solo finche il codice non e pronto').toMatch(/!qrReady/);
    expect(src, 'e cio che si legge viene da una chiave, non da una frase').toMatch(/L\('preparingInvite'\)/);
  });

  it('nessuna emoji nell\'interfaccia', () => {
    // b.482 — QUESTA GUARDIA AVEVA DUE BUCHI, e da tutti e due sono passate
    // emoji vere che Luca ha poi visto sul telefono.
    //   1. Guardava solo i CARATTERI. Un'emoji scritta come sequenza di
    //      scappamento — '\\u{1F3A4}' — nel sorgente non e un carattere di
    //      quell'intervallo, quindi passava. A schermo pero e identica.
    //      Erano scritte cosi in dieci file, microfoni e mappamondi
    //      compresi.
    //   2. Guardava solo la CARTELLA components, senza entrare in ui/,
    //      dove vivono i pezzi condivisi da tutte le schermate.
    // Adesso guarda le due forme e scende nelle sottocartelle.
    // Le DUE eccezioni, scritte qui perche siano discutibili invece che
    // dimenticate. Non sono interfaccia: sono CONTENUTO.
    //   BarraReazioni — le reazioni SONO emoji. Il pollice che scegli
    //     viaggia nel messaggio e lo vede l'altra persona: sostituirlo con
    //     un'icona nostra cambierebbe cosa hai mandato, non come si vede.
    //   AdminWallet — il pacchetto regalo sta dentro il TESTO di un
    //     messaggio che si manda su WhatsApp, non su uno schermo nostro.
    //   VentaglioReazioni — b.546: stessa ragione di BarraReazioni. Le
    //     reazioni SONO le emoji: la faccia che scegli viaggia col
    //     contenuto e la vedono gli altri. Sostituirla con un'icona
    //     nostra cambierebbe cosa hai mandato, non come si vede.
    const CONTENUTO_NON_INTERFACCIA = ['AdminWallet.js', 'BarraReazioni.js', 'VentaglioReazioni.js'];
    const colpevoli = [];
    const guarda = (dir) => {
      for (const voce of fs.readdirSync(dir, { withFileTypes: true })) {
        const q = path.join(dir, voce.name);
        if (voce.isDirectory()) { guarda(q); continue; }
        if (!voce.name.endsWith('.js')) continue;
        if (CONTENUTO_NON_INTERFACCIA.includes(voce.name)) continue;
        const src = fs.readFileSync(q, 'utf8');
        // via i commenti: un'emoji CITATA per spiegare non e un'emoji usata
        const codice = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        const scritte = codice.match(/[\u{1F300}-\u{1FAFF}]/gu) || [];
        // le sequenze di scappamento: stessa emoji, un'altra grafia
        const scappate = (codice.match(/\\u\{1F[0-9A-Fa-f]{3}\}/g) || []);
        // le bandiere restano: sono un DATO (la lingua di una persona),
        // non un ornamento, e le usa tutta l'applicazione.
        const vere = [...scritte, ...scappate].filter(
          (e) => !/[\u{1F1E6}-\u{1F1FF}]/u.test(e));
        if (vere.length) {
          colpevoli.push(`${path.relative(APP, q)} (${[...new Set(vere)].join(' ')})`);
        }
      }
    };
    guarda(path.join(APP, 'components'));
    expect(colpevoli, `Usa le icone mono di Icon.js:\n  ${colpevoli.join('\n  ')}`).toEqual([]);
  });
});
