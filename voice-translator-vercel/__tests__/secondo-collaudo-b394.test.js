// b.394 — i reperti del secondo collaudo dal vivo di Luca.
// Ogni prova qui sotto difende una cosa che si e rotta DAVVERO, non una
// che potrebbe rompersi: il menu illeggibile, il campo commento sotto la
// barra, la pillola audio sempre accesa, TaxiTalk sul tema chiaro, la
// mappa vuota.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// ── il contrasto si CALCOLA, non si giudica a occhio ──
const canale = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const luce = ([r, g, b]) => 0.2126 * canale(r) + 0.7152 * canale(g) + 0.0722 * canale(b);
const sopra = (fg, sfondo, alfa) => [0, 1, 2].map((i) => fg[i] * alfa + sfondo[i] * (1 - alfa));
const contrasto = (a, b) => { const x = luce(a), y = luce(b); const [alto, basso] = x > y ? [x, y] : [y, x]; return (alto + 0.05) / (basso + 0.05); };
const rgba = (s) => (s.match(/[\d.]+/g) || []).map(Number);

describe('il grigio secondario del tema chiaro non si leggeva', () => {
  it('sopra la carta bianca arriva al minimo leggibile', () => {
    const s = leggi('app/lib/styles.js');
    const dawn = s.slice(s.indexOf('dawn: {'));
    const muted = rgba(dawn.match(/textMuted: '(rgba\([^)]*\))'/)[1]);
    const carta = rgba(dawn.match(/cardBg: '(rgba\([^)]*\))'/)[1]);
    const fondo = [247, 248, 252]; // bg del tema
    const cartaPiena = sopra(carta.slice(0, 3), fondo, carta[3]);
    const testo = sopra(muted.slice(0, 3), cartaPiena, muted[3]);
    const r = contrasto(testo, cartaPiena);
    expect(r, `contrasto misurato ${r.toFixed(2)}:1 — il minimo e 4,5`).toBeGreaterThanOrEqual(4.5);
  });

  it('e NESSUN tema lascia indietro il suo grigio secondario', () => {
    // b.395, decisione di Luca: la stessa misura vale per tutti e sei.
    const s = leggi('app/lib/styles.js');
    const temi = [...s.matchAll(/^ {4}([a-z]+): \{([\s\S]*?)^ {4}\},/gm)];
    const esaminati = [];
    for (const [, nome, corpo] of temi) {
      const bg = corpo.match(/\n {6}bg: '(#[0-9a-f]{6})'/i);
      const carta = corpo.match(/cardBg: '(rgba\([^)]*\))'/);
      const muted = corpo.match(/textMuted: '(rgba\([^)]*\))'/);
      if (!bg || !carta || !muted) continue;
      const fondo = [1, 3, 5].map((i) => parseInt(bg[1].substr(i, 2), 16));
      const c = rgba(carta[1]); const m = rgba(muted[1]);
      const cartaPiena = sopra(c.slice(0, 3), fondo, c[3]);
      const r = contrasto(sopra(m.slice(0, 3), cartaPiena, m[3]), cartaPiena);
      esaminati.push(nome);
      expect(r, `tema ${nome}: ${r.toFixed(2)}:1, il minimo e 4,5`).toBeGreaterThanOrEqual(4.5);
    }
    expect(esaminati.length, 'e li ha guardati tutti e sei').toBe(6);
  });

  it('e il 42% di partenza era davvero sotto: la prova sa distinguere', () => {
    const carta = sopra([255, 255, 255], [247, 248, 252], 0.62);
    const vecchio = sopra([16, 19, 28], carta, 0.42);
    expect(contrasto(vecchio, carta), 'com\'era prima').toBeLessThan(4.5);
  });
});

describe('la pillola audio stava accesa in silenzio', () => {
  let audio;
  beforeEach(async () => {
    // ogni prova con lo stato pulito: il modulo tiene i contatori dentro
    vi.resetModules();
    audio = await import('../app/lib/audioLife.js');
  });

  it('aprire una scheda NON accende il telecomando', () => {
    const spegni = audio.suInterruzione(() => {});
    expect(audio.stato().attivo, 'silenzio totale, nessuna pillola').toBe(false);
    spegni();
  });

  it('un giro di voce lo accende, e alla fine si spegne', () => {
    const chiudi = audio.apriCiclo();
    expect(audio.stato().attivo).toBe(true);
    expect(audio.stato().preparando, 'sta preparando la battuta').toBe(true);
    chiudi();
    expect(audio.stato().attivo).toBe(false);
  });

  it('chiudere due volte lo stesso giro non sballa il conto', () => {
    const a = audio.apriCiclo();
    const b = audio.apriCiclo();
    a(); a(); a();
    expect(audio.stato().attivo, 'il secondo giro e ancora vivo').toBe(true);
    b();
    expect(audio.stato().attivo).toBe(false);
  });

  it('Interrompi spegne subito, non al giro dopo', () => {
    audio.apriCiclo(); audio.apriCiclo();
    audio.ferma();
    expect(audio.stato().attivo).toBe(false);
  });

  it('i tre punti che generano voce aprono e chiudono il giro', () => {
    const lv = leggi('app/components/Life/LifeView.js');
    expect(lv, 'il podcast').toMatch(/const chiudiCiclo = apriCiclo\(\)/);
    expect(lv, 'la lezione').toMatch(/const chiudiCicloLezione = apriCiclo\(\)/);
    expect(lv, 'e si chiudono SEMPRE').toMatch(/finally \{ chiudiCiclo\(\)/);
    expect(lv).toMatch(/finally \{ chiudiCicloLezione\(\)/);
    const t = leggi('app/components/Life/Tavolo.js');
    expect(t, 'la tavola rotonda').toMatch(/apriCiclo\(\)/);
    expect(t).toMatch(/finally \{ chiudiCiclo\(\)/);
  });

  it('la riserva in fondo e la misura vera della pillola, non un numero a occhio', () => {
    const lv = leggi('app/components/Life/LifeView.js');
    expect(lv).toMatch(/calc\(60px \+ max\(16px, env\(safe-area-inset-bottom\)\) \+ 12px\)/);
    expect(lv, 'via il 90 cieco').not.toMatch(/padding: '14px 16px 90px'/);
  });

  it('le colonne di conversazione usano la stessa unita del telaio che le ospita', () => {
    for (const f of ['app/components/Life/AmicoChat.js', 'app/components/Life/Tavolo.js']) {
      expect(leggi(f), `${f}: vh su Safari conta le barre nascoste`).not.toMatch(/height: '70vh'/);
      expect(leggi(f)).toMatch(/height: '70dvh'/);
    }
  });
});

describe('il menu ••• era illeggibile e le scritte si accavallavano', () => {
  it('la tendina ha una larghezza vera invece di collassare al minimo', () => {
    const h = leggi('app/components/RoomHeader.js');
    expect(h).toMatch(/width:'min\(304px, calc\(100vw - 20px\)\)'/);
    expect(h, 'minWidth alzava il pavimento ma non dava spazio').not.toMatch(/minWidth:236/);
  });

  it('«In attesa» non e piu scritto due volte nella stessa riga', () => {
    const h = leggi('app/components/RoomHeader.js');
    expect(h, "lo dice gia l'indicatore di segnale").not.toMatch(/L\('waitingDots'\)/);
    expect(h, "via anche la parola fissa 'Partner'").not.toMatch(/partner\?\.name \|\| 'Partner'/);
  });

  it('un nome lungo si tronca invece di mandare la riga a capo', () => {
    const h = leggi('app/components/RoomHeader.js');
    expect(h).toMatch(/textOverflow:'ellipsis', whiteSpace:'nowrap'/);
  });

  it("l'indicatore di segnale segue il tema invece dei bianchi fissi", () => {
    const c = leggi('app/components/ConnectionQuality.js');
    expect(c, 'il grigio fuori dal tema').not.toMatch(/color = '#888'/);
    expect(c).toMatch(/S\.colors\.textTertiary/);
    expect(c, 'il pannellino').not.toMatch(/background: 'rgba\(255,255,255,0\.06\)'/);
    expect(c, 'le barre spente').not.toMatch(/: 'rgba\(255,255,255,0\.1\)'/);
    expect(c, 'e la scritta sta in riga').toMatch(/whiteSpace: 'nowrap'/);
  });
});

describe('il campo per scrivere il commento finiva sotto la barra', () => {
  it('la scheda dei commenti riserva lo spazio della barra, come tutto il resto', () => {
    const d = leggi('app/components/MondoDiscussioni.js');
    expect(d).toMatch(/paddingBottom: 'calc\(106px \+ env\(safe-area-inset-bottom\)\)'/);
    expect(d, 'i 10 pixel di prima non bastavano').not.toMatch(/paddingBottom: 'max\(10px, env\(safe-area-inset-bottom\)\)'/);
  });

  it("anche il lettore dell'articolo, che e l'altra faccia dello stesso foglio", () => {
    const l = leggi('app/components/ui/LettoreArticolo.js');
    expect(l).toMatch(/paddingBottom: 'calc\(106px \+ env\(safe-area-inset-bottom\)\)'/);
    expect(l, 'con la scatola che conta il riempimento').toMatch(/boxSizing: 'border-box'/);
  });

  it('ma NON sul foglio comune, o si sommerebbe a quello della faccia davanti', () => {
    const n = leggi('app/components/MondoNews.js');
    const quanti = (n.match(/106px/g) || []).length;
    expect(quanti, "una volta sola, sull'elenco delle notizie").toBe(1);
  });

  it('106 non e inventato: e la misura che usa gia il resto del progetto', () => {
    const n = leggi('app/components/MondoNews.js');
    expect(n, "la faccia davanti dello stesso ribaltamento").toMatch(/106px/);
  });
});

describe('TaxiTalk sul tema chiaro, la mappa vuota e la voce sbagliata accesa', () => {
  it('nessun colore resta cablato al tema scuro nella tavolozza', () => {
    const t = leggi('app/components/TaxiTalk.js');
    expect(t, 'la didascalia era bianca su bianco').not.toMatch(/faint: 'rgba\(238,242,255,0\.38\)',/);
    expect(t, 'i tasti stampavano nero su blu-notte').not.toMatch(/card2: 'rgba\(20,26,44,0\.7\)',/);
    expect(t, 'e la schermata ribaltata sfumava nel nero fisso').not.toMatch(/#04070f/);
    expect(t).toMatch(/faint: col\.textTertiary/);
    expect(t).toMatch(/card2: col\.toggleOff/);
  });

  it('la mappa dice al suo lavoratore dove sta, perche da solo non lo trova', () => {
    const m = leggi('app/components/TaxiMap.js');
    expect(m).toMatch(/setWorkerUrl\('\/maplibre\/maplibre-gl-worker\.mjs'\)/);
    expect(existsSync(join(process.cwd(), 'public/maplibre/maplibre-gl-worker.mjs')), 'il file c\'e').toBe(true);
    expect(existsSync(join(process.cwd(), 'public/maplibre/maplibre-gl-shared.mjs')), 'e il fratello che importa').toBe(true);
  });

  it('la copia non invecchia da sola a ogni aggiornamento del pacchetto', () => {
    const pkg = JSON.parse(leggi('package.json'));
    expect(pkg.scripts['copia-maplibre']).toBeTruthy();
    expect(pkg.scripts.prebuild, 'prima di ogni compilazione').toMatch(/copia-maplibre/);
    expect(pkg.scripts.postinstall, 'e dopo ogni installazione').toMatch(/copia-maplibre/);
  });

  it('dentro TaxiTalk si accende Home, non Community', () => {
    const b = leggi('app/components/BottomNav.js');
    const home = b.match(/id: 'home'[^\n]*views: \[([^\]]*)\]/)[1];
    const comm = b.match(/id: 'community'[^\n]*views: \[([^\]]*)\]/)[1];
    expect(home, "ci si arriva dalla Home").toMatch(/'speaker'/);
    expect(home, "e la chat del taxi non era in nessun elenco").toMatch(/'taxi-chat'/);
    expect(comm, 'Community non c\'entra').not.toMatch(/'speaker'/);
  });
});

describe('la lingua non e un Paese', () => {
  it('scegliendo una lingua si sceglie il Paese VERO, non il codice in maiuscolo', async () => {
    const { paeseDaLingua } = await import('../app/lib/schedaMondo.js');
    // le sei che erano sbagliate: il codice della lingua non c'entra col posto
    expect(paeseDaLingua('en')).toBe('US');
    expect(paeseDaLingua('zh')).toBe('CN');
    expect(paeseDaLingua('ja')).toBe('JP');
    expect(paeseDaLingua('pt')).toBe('BR');
    expect(paeseDaLingua('ko')).toBe('KR');
    expect(paeseDaLingua('ar')).toBe('AE');
  });

  it('e Mondo non manda piu in giro il codice della lingua al posto del Paese', () => {
    const v = leggi('app/components/MondoView.js');
    expect(v, 'la tendina della lingua').not.toMatch(/setPaeseScelto\(v === 'all' \? null : v\.toUpperCase\(\)\)/);
    expect(v, 'e la ricerca dei paesi').not.toMatch(/setPaeseScelto\(l\.paese \|\| l\.code\.toUpperCase\(\)\)/);
    expect(v).toMatch(/setPaeseScelto\(v === 'all' \? null : paeseDaLingua\(v\)\)/);
    expect(v).toMatch(/setPaeseScelto\(paeseDaLingua\(l\.code\)\)/);
  });

  it("LANGS non ha nessun campo 'paese': il ripiego che ci contava era cieco", async () => {
    const { LANGS } = await import('../app/lib/constants.js');
    expect(LANGS.some((l) => 'paese' in l), 'nessuna lingua porta un paese').toBe(false);
  });
});
