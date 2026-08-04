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
    expect(leggi('components/LobbyView.js')).toMatch(/Preparo il codice/);
  });

  it('nessuna emoji nell\'interfaccia', () => {
    const cartella = path.join(APP, 'components');
    const colpevoli = [];
    for (const nome of fs.readdirSync(cartella)) {
      if (!nome.endsWith('.js')) continue;
      const src = fs.readFileSync(path.join(cartella, nome), 'utf8');
      // Pittogrammi veri. Restano ammessi i segni tipografici (✓ ✕ ♀ ♂).
      const trovate = src.match(/[\u{1F300}-\u{1FAFF}]/gu);
      if (trovate) colpevoli.push(`${nome} (${[...new Set(trovate)].join('')})`);
    }
    expect(colpevoli, `Usa le icone mono di Icon.js:\n  ${colpevoli.join('\n  ')}`).toEqual([]);
  });
});
