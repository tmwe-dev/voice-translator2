// ═══════════════════════════════════════════════════════════════
// b.557 — LE NOTIZIE SONO DI OGGI
//
// Collaudo di Luca, con due fotografie in mano: un video del 2 maggio e
// uno del 24 maggio presentati come attualita, a fine agosto.
//   «Devi tenere una logica. Quando si parla di news devi lavorare
//    sulle 48 ore, breaking news ultim'ora da aggiungere al carosello.»
// E subito dopo: «magari serve aggiungere un setting nel sidebar per
// determinare quanto indietro deve caricare contenuti».
//
// La causa: YouTube ordina per PERTINENZA, e per lui un servizio di tre
// mesi fa resta pertinente per sempre. Nessuno gli aveva mai detto che
// stavamo facendo un giornale.
//
// LA REGOLA, e le sue due eccezioni:
//   · la finestra vale SOLO per le domande di cronaca — su «tom cruise»
//     o «come si fa il pane» il pezzo di tre anni fa puo essere il
//     migliore che esiste;
//   · chi non ha data non si butta: molti flussi non la mettono, e
//     scartare per assenza di prova vorrebbe dire perdere fonti intere.
//     Si ordina, non si filtra — anche col tempo.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { soloRecenti, quantiFreschi, DUE_GIORNI } from '../app/lib/topics/registro.js';
import { eDiCronaca } from '../app/lib/topics/enciclopediaUtile.js';

const leggi = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const ADESSO = Date.UTC(2026, 7, 28, 12, 0, 0);
const oreFa = (n) => ADESSO - n * 3600 * 1000;

describe('la finestra delle 48 ore', () => {
  it('tiene il fresco e lascia fuori il vecchio', () => {
    const dentro = soloRecenti([
      { titolo: 'di maggio', pubblicato: oreFa(24 * 90) },
      { titolo: 'di stamattina', pubblicato: oreFa(4) },
      { titolo: 'di ieri', pubblicato: oreFa(20) },
    ], { adesso: ADESSO });
    expect(dentro.map((v) => v.titolo)).toEqual(['di stamattina', 'di ieri']);
  });

  it('e mette in cima il piu recente: un giornale si legge cosi', () => {
    const dentro = soloRecenti([
      { titolo: 'ieri', pubblicato: oreFa(30) },
      { titolo: 'un ora fa', pubblicato: oreFa(1) },
    ], { adesso: ADESSO });
    expect(dentro[0].titolo).toBe('un ora fa');
  });

  it('chi non dice quando resta, ma dopo chi lo dice', () => {
    const dentro = soloRecenti([
      { titolo: 'senza data' },
      { titolo: 'fresca', pubblicato: oreFa(2) },
      { titolo: 'vecchia', pubblicato: oreFa(500) },
    ], { adesso: ADESSO });
    expect(dentro.map((v) => v.titolo)).toEqual(['fresca', 'senza data']);
  });

  it('quarantotto ore sono quarantotto ore', () => {
    expect(DUE_GIORNI).toBe(48 * 3600 * 1000);
    expect(quantiFreschi([{ pubblicato: oreFa(47) }, { pubblicato: oreFa(49) }], { adesso: ADESSO })).toBe(1);
  });
});

describe('la finestra si applica solo dove ha senso', () => {
  it('«ultime notizie» ha una scadenza, «tom cruise» no', () => {
    expect(eDiCronaca('ultime notizie dal congo')).toBe(true);
    expect(eDiCronaca('tom cruise')).toBe(false);
  });

  it('e nel feed si usa QUEL giudizio, non un secondo che lo contraddica', () => {
    const n = leggi('app/components/MondoNews.js');
    expect(n).toMatch(/if \(oreIndietro > 0 && eDiCronaca\(pulita\)\)/);
    expect(n, 'e se dentro la finestra non resta un giornale, si tiene tutto')
      .toMatch(/if \(quantiFreschi\(puliti, \{ finestra \}\) >= 4\) puliti = soloRecenti\(puliti, \{ finestra \}\)/);
  });
});

describe('anche i video, che era il difetto fotografato', () => {
  const v = leggi('app/lib/topics/videoUfficiale.js');
  const r = leggi('app/api/topics/video/route.js');

  it('si chiede a YouTube una finestra vera, e l ordine per data', () => {
    expect(v).toMatch(/parametri\.publishedAfter = new Date\(da\)\.toISOString\(\)/);
    expect(v).toMatch(/parametri\.order = 'date'/);
    expect(v, 'ma solo quando serve').toMatch(/if \(recenti\) \{/);
  });

  it('se in 48 ore non c e niente si allarga a una settimana, non si torna a maggio', () => {
    expect(r).toMatch(/if \(cronaca && !esito\.video\.length\)/);
    expect(r).toMatch(/7 \* 24 \* 3600 \* 1000/);
  });

  it('e un mazzo di cronaca non resta in cache dodici ore', () => {
    expect(r).toMatch(/'EX', cronaca \? 1800 : TTL/);
    expect(r, 'e non finisce nella stessa casella di una ricerca senza tempo')
      .toMatch(/\$\{cronaca \? `ore\$\{ore\}:` : ''\}/);
  });
});

describe('quanto indietro lo decide chi guarda', () => {
  it('c e la scelta nella barra, e il valore comanda le due meta', () => {
    const n = leggi('app/components/MondoNews.js');
    expect(n).toMatch(/L\('windowTitle'\)/);
    expect(n, 'le quattro scelte').toMatch(/\[\[24, 'window24'\], \[48, 'window48'\], \[168, 'window7d'\], \[0, 'windowAll'\]\]/);
    expect(n, 'e i video ricevono la stessa finestra degli articoli').toMatch(/&ore=\$\{Number\(prefsRef\.current\?\.finestraOre \?\? 48\)\}/);
  });

  it('il server non si fida del numero che arriva', () => {
    // «un mese» e il tetto: oltre, la parola «notizia» non vuol dire piu niente.
    expect(leggi('app/api/topics/video/route.js'))
      .toMatch(/Math\.max\(0, Math\.min\(Number\(url\.searchParams\.get\('ore'\)\) \|\| 48, 720\)\)/);
  });
});
