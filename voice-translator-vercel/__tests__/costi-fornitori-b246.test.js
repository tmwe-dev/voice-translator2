// ═══════════════════════════════════════════════════════════════
// b.246 — controllo costi su TUTTI i fornitori.
//
// Cercando quanto costassero davvero le traduzioni cinese/giapponese per
// decidere su Qwen, ho scoperto che il dato non c'era. Tre buchi, tutti
// verificati sul database vero:
//
//  1. la tabella `translations` NON ESISTEVA, e /api/translate ci scrive a
//     ogni traduzione da mesi: ogni insert falliva dentro `.catch(() => {})`;
//  2. `provider_snapshots` conteneva SOLO ElevenLabs — gli altri fornitori
//     fallivano e venivano saltati con `if (l.errore) continue`, quindi
//     sembravano "senza consumi" mentre erano solo ciechi;
//  3. `wallet_economics` dà il totale del giorno ma non dice CHI l'ha speso.
//
// Un consumo registrato male è peggio di un consumo non registrato: si crede
// di avere uno storico e non si ha niente.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { listinoAttuale } from '../app/wallet/costi-fornitori.js';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');

describe('gli errori di registrazione non spariscono più', () => {
  it('il fallimento dello storico traduzioni ora si vede nei log', () => {
    const s = leggi('app/api/translate/route.js');
    expect(s).toMatch(/log\.warn\('storico traduzione non salvato:'/);
    // Il difetto era esattamente questo: inghiottire l'errore.
    expect(s).not.toMatch(/is_cached: false, context_type: domainContext \|\| 'general',\s*\}\)\.catch\(\(\) => \{\}\)/);
  });

  it('e un fornitore illeggibile viene REGISTRATO, non saltato', () => {
    const s = leggi('app/api/wallet/snapshot/route.js');
    expect(s).not.toMatch(/if \(l\.errore\) continue;/);
    expect(s).toMatch(/anche i fornitori che NON si riescono a leggere/);
  });
});

describe('il quadro costi si costruisce dai NOSTRI conti', () => {
  it('non dipende dal fatto che un fornitore esponga un endpoint di consumo', () => {
    const s = leggi('app/wallet/costi-fornitori.js');
    expect(s).toMatch(/from\('translations'\)/);
    expect(s).toMatch(/cost_usd/);
  });

  it('raggruppa per fornitore E modello: due modelli dello stesso fornitore costano diverso', () => {
    const s = leggi('app/wallet/costi-fornitori.js');
    expect(s).toMatch(/\$\{r\.provider \|\| 'sconosciuto'\}\|\$\{r\.ai_model \|\| '—'\}/);
  });

  it('e dice anche quali coppie di lingue si usano davvero', () => {
    // È la domanda da cui è partito tutto: conviene un fornitore
    // specializzato su CJK? Dipende da quanto CJK si traduce davvero.
    expect(leggi('app/wallet/costi-fornitori.js')).toMatch(/source_lang \|\| '\?'\}→\$\{r\.target_lang/);
  });
});

describe('il listino usato per i conti è ispezionabile', () => {
  const l = listinoAttuale();

  it('espone traduzione, TTS e STT con la loro unità di misura', () => {
    expect(l.traduzione.length).toBeGreaterThan(0);
    expect(l.tts.length).toBeGreaterThan(0);
    expect(l.stt.length).toBeGreaterThan(0);
    expect(l.traduzione[0].unita).toBe('usd/1M caratteri');
    expect(l.stt[0].unita).toBe('usd/minuto');
  });

  it('ogni voce ha un prezzo: un listino con buchi falsa ogni stima a valle', () => {
    for (const v of [...l.traduzione, ...l.tts]) {
      expect(typeof v.usd_per_1m, `${v.id} senza prezzo`).toBe('number');
    }
  });
});

describe('il pannello admin mostra chi spende', () => {
  const a = () => leggi('app/api/wallet/admin/route.js');

  it('costi per fornitore, coppie di lingue e totale a 30 giorni', () => {
    const s = a();
    expect(s).toMatch(/costi_per_fornitore/);
    expect(s).toMatch(/coppie_lingua/);
    expect(s).toMatch(/costo_usd_30gg/);
  });

  it('e soprattutto quali fornitori NON riusciamo a leggere', () => {
    // Un fornitore assente dalle fotografie sembrava "senza consumi".
    expect(a()).toMatch(/fornitori_non_leggibili/);
  });

  it('un guasto del conteggio non deve far cadere tutto il pannello', () => {
    expect(a()).toMatch(/costiPerFornitore\(\{ giorni: 30 \}\)\.catch\(/);
    expect(a()).toMatch(/fornitoriCiechi\(\)\.catch\(\(\) => \[\]\)/);
  });
});
