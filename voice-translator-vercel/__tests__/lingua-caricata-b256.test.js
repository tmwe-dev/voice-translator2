// ═══════════════════════════════════════════════════════════════
// b.256 — «non riesci neanche a tradurre la lingua del menu».
//
// Aveva ragione. Dentro il programma ci sono SOLO inglese e italiano: le
// altre tredici lingue dell'interfaccia si caricano a parte, quando
// servono. Finche il pacchetto non c'e, `t()` ripiega sull'inglese — ed e
// la cosa giusta da fare.
//
// Il difetto e cosa succedeva DOPO: il pacchetto arrivava, entrava in
// memoria, e nessuno lo veniva a sapere. React aveva gia disegnato col
// ripiego e non aveva alcun motivo per rifarlo. Chi sceglieva tedesco o
// spagnolo restava con i menu in inglese finche non capitava, per altri
// motivi, un nuovo disegno.
//
// Perche alla scelta del paese non si notava: subito dopo si cambia
// schermata, e il cambio di schermata ridisegna tutto. Il difetto si
// vedeva solo cambiando lingua a schermata ferma — cioe dalla home.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { t, preloadLang, ascoltaLingueCaricate, linguaPronta } from '../app/lib/i18n.js';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');

describe('un pacchetto lingua che arriva si fa sentire', () => {
  it('il tedesco NON e in memoria all\'avvio: prima si ripiega, e giusto cosi', () => {
    // Se un giorno lo si mettesse dentro il programma questo test cadrebbe,
    // ed e bene che cada: vorrebbe dire che il primo caricamento e piu pesante.
    expect(linguaPronta('de')).toBe(false);
    // Ripiego sull'inglese, non la chiave grezza in faccia all'utente.
    expect(t('de', 'settings')).toBe(t('en', 'settings'));
  });

  it('quando arriva, chi disegna viene svegliato — e col codice giusto', async () => {
    const svegliate = [];
    const stop = ascoltaLingueCaricate((codice) => svegliate.push(codice));
    const esito = await preloadLang('de');
    stop();
    expect(esito).toBe(true);
    expect(svegliate).toContain('de');
  });

  it('e da quel momento traduce davvero', async () => {
    await preloadLang('de');
    expect(linguaPronta('de')).toBe(true);
    const tedesco = t('de', 'settings');
    expect(tedesco).not.toBe(t('en', 'settings'));
    expect(tedesco.length).toBeGreaterThan(0);
  });

  it('una lingua gia in memoria non sveglia nessuno due volte', async () => {
    await preloadLang('de');
    const svegliate = [];
    const stop = ascoltaLingueCaricate((c) => svegliate.push(c));
    await preloadLang('de');   // gia dentro: esce subito
    stop();
    expect(svegliate).toEqual([]);
  });

  it('una lingua che non esiste non rompe niente', async () => {
    const svegliate = [];
    const stop = ascoltaLingueCaricate((c) => svegliate.push(c));
    // 'da' (danese) non e fra le 15: non c'e nessun pacchetto da caricare.
    expect(await preloadLang('da')).toBe(false);
    stop();
    expect(svegliate).toEqual([]);
  });

  it('un ascoltatore che scoppia non zittisce gli altri', async () => {
    const arrivate = [];
    const stopRotto = ascoltaLingueCaricate(() => { throw new Error('rotto'); });
    const stopSano = ascoltaLingueCaricate((c) => arrivate.push(c));
    await preloadLang('fr');
    stopRotto(); stopSano();
    expect(arrivate).toContain('fr');
  });
});

describe('il contesto dell\'applicazione ridisegna quando la lingua e pronta', () => {
  const ctx = () => leggi('app/contexts/AppContext.js');

  it('chiede il pacchetto della lingua che sta mostrando', () => {
    expect(ctx()).toMatch(/useEffect\(\(\) => \{ preloadLang\(linguaInterfaccia\); \}, \[linguaInterfaccia\]\)/);
  });

  it('si iscrive agli arrivi e si ridisegna SOLO per la lingua a schermo', () => {
    const s = ctx();
    expect(s).toMatch(/ascoltaLingueCaricate\(\(codice\) => \{/);
    expect(s).toMatch(/if \(codice === linguaInterfaccia\) setVersioneLingua/);
  });

  it('e L() rinasce quando il pacchetto arriva', () => {
    // Senza `versioneLingua` fra le dipendenze, L() resterebbe la stessa
    // funzione e nessuno ridisegnerebbe: e tutto il difetto, in una riga.
    expect(ctx()).toMatch(/const L = useCallback\(\(key\) => t\(linguaInterfaccia, key\), \[linguaInterfaccia, versioneLingua\]\)/);
  });

  it('e L viaggia nelle dipendenze del contesto, altrimenti il ridisegno si ferma qui', () => {
    expect(ctx()).toMatch(/\}\), \[\s*\n?\s*L, linguaInterfaccia/);
  });
});
