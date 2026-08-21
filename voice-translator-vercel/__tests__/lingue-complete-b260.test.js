import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { t, preloadLang, mapLang } from '../app/lib/i18n.js';

// ═══════════════════════════════════════════════════════════════
// b.370 — QUESTA PROVA DESCRIVEVA IL DIFETTO COME SE FOSSE LA REGOLA.
//
// C'erano due gruppi scritti a mano: i pacchetti "pieni" e i pacchetti
// "mini". Ai mini si CHIEDEVA di ripiegare sull'inglese fuori dalla
// home — cioe la prova pretendeva che sedici lingue restassero
// incomplete, e sarebbe diventata rossa il giorno che qualcuno le
// completava. Una prova cosi non protegge: fa la guardia al difetto.
//
// Luca l'ha scoperto aprendo l'app in thailandese e trovando frasi in
// inglese. Ora i trentotto pacchetti hanno tutti le stesse chiavi, e
// questa prova chiede la cosa vera: NESSUNA LINGUA E' DI SERIE B.
// ═══════════════════════════════════════════════════════════════

const CARTELLA = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app/lib/locales');
const LINGUE = fs.readdirSync(CARTELLA).filter((f) => f.endsWith('.js')).map((f) => f.replace('.js', '')).sort();

describe('nessuna lingua di serie B', () => {
  it('sono trentotto e si caricano tutte', async () => {
    expect(LINGUE.length).toBeGreaterThanOrEqual(38);
    for (const l of LINGUE) expect(await preloadLang(l), l).toBe(true);
  });

  it('nessuna mostra la chiave grezza al posto della parola', async () => {
    for (const l of LINGUE) {
      await preloadLang(l);
      for (const k of ['settings', 'homeTitle', 'actFaceTitle', 'businessSubtitle', 'moreToolsSoon']) {
        expect(t(l, k), `${l}/${k}`).not.toBe(k);
        expect(String(t(l, k)).trim(), `${l}/${k}`).not.toBe('');
      }
    }
  });

  it('hanno parole loro, non la copia dell inglese', async () => {
    for (const l of LINGUE) {
      if (l === 'en') continue;
      await preloadLang(l);
      // homeTitle e la prima frase che si legge: se e ancora inglese,
      // quella lingua non e mai stata tradotta davvero.
      expect(t(l, 'homeTitle'), l).not.toBe(t('en', 'homeTitle'));
    }
  });

  it('mapLang non butta piu nessuno in inglese', () => {
    for (const l of LINGUE) if (l !== 'en') expect(mapLang(l), l).toBe(l);
    expect(mapLang('da-DK')).toBe('da');
  });
});
