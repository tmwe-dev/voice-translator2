import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// b.523 — Luca: «la disposizione delle icone non deve essere
// influenzata dal testo mai. guarda ad esempio approfondita» e poi
// «metti la descrizione della icona a sinistra sotto il titolo in un
// badge brown» e «non vedo la scelta paese».

describe('b.523 — le icone stanno su una colonna fissa, il testo non le sposta', () => {
  const f = leggi('app/components/ui/PreferenzeMondo.js');

  it('la colonna del comando ha una larghezza FISSA, non un minimo', () => {
    expect(f).toMatch(/const LARGHEZZA_COMANDO = \d+;/);
    expect(f).toMatch(/width: LARGHEZZA_COMANDO, flexShrink: 0/);
  });

  it('nessun comando usa piu minWidth come larghezza (era il bug)', () => {
    // solo nel CODICE: nel commento la vecchia riga resta citata apposta
    expect(f).not.toMatch(/minWidth: 52[,}]/);
  });

  it('dentro il comando non c e piu testo che possa allargarlo', () => {
    // IconeCiclo non riceve piu L: se non traduce, non stampa parole.
    expect(f).toMatch(/function IconeCiclo\(\{ scelte, valore, onCambia, C, etichettaAria \}\)/);
    expect(f).toMatch(/function PassoVerticale\(\{ scelte, valore, onCambia, C \}\)/);
  });
});

describe('b.523 — lo stato attuale e un badge bruno sotto il titolo, a sinistra', () => {
  const f = leggi('app/components/ui/PreferenzeMondo.js');

  it('esiste il badge ed e dello stesso vetro bruno dei preferiti', () => {
    // b.537 — la prova fissava la trasparenza al centesimo (0.34). In
    // b.535 il velo di sfocatura e' stato tolto da questo badge (regola
    // di Luca: niente blur su un elemento RIPETUTO dal .map) e senza il
    // blur dietro il fondo va alzato un po' per restare lo stesso vetro
    // a vedersi: 0.42. Il COLORE non e' cambiato — 140,88,48 e' il bruno
    // dei preferiti, 206,146,92 il suo bordo. Si prova la tinta, che e'
    // cio che Luca ha chiesto, non il centesimo di trasparenza.
    expect(f).toMatch(/function BadgeStato/);
    expect(f).toMatch(/rgba\(140,88,48,0?\.\d+\)/);
    expect(f).toMatch(/rgba\(206,146,92,0\.5\)/);
    // e il velo non deve tornare su una riga ripetuta
    const badge = f.slice(f.indexOf('function BadgeStato'), f.indexOf('function BadgeStato') + 700);
    expect(badge).not.toMatch(/backdropFilter/);
  });

  it('sta nella colonna elastica di sinistra, sotto il nome', () => {
    expect(f).toMatch(/flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column'/);
    expect(f).toMatch(/<BadgeStato testo=\{sceltaAttiva\.numero != null/);
  });

  it('anche il ritmo (numero + min) passa dal badge', () => {
    expect(f).toMatch(/\$\{sceltaAttiva\.numero\} \$\{L\('minShort'\)\}/);
  });
});

describe('b.523 — la scelta del Paese esiste davvero nel pannello', () => {
  const f = leggi('app/components/MondoView.js');

  it('c e una tendina Paese, non solo il commento che la prometteva', () => {
    // b.550 — il titolo ora lo porta la CARD DI VETRO (sbWhereTitle +
    // icona globe), la stessa che le Notizie hanno da b.535: e' lo
    // scheletro unico di b.524, finalmente su tutte e tre le sidebar.
    // Cio che b.523 difendeva — che la scelta del Paese ESISTA e non sia
    // solo un commento che la promette — vale ancora, ed e provato qui
    // sotto dalla tendina vera.
    expect(f).toMatch(/icona="globe" titolo=\{L\('sbWhereTitle'\)\}/);
    // b.529 — la tendina mostra la BOZZA (si applica col tasto Applica)
    expect(f).toMatch(/valore=\{bozzaPaesePanello \|\| 'tutto'\}/);
  });

  it('la prima voce riporta al mondo intero', () => {
    expect(f).toMatch(/valore: 'tutto', etichetta: L\('wholeWorld'\)/);
  });

  it('i paesi arrivano dall elenco vero, ordinati per nome tradotto', () => {
    expect(f).toMatch(/import \{ PAESI \} from '\.\.\/lib\/paesi\.js'/);
    expect(f).toMatch(/nomePaese\(pa\.codice\)/);
    expect(f).toMatch(/\.sort\(\(a, b\) => a\.etichetta\.localeCompare\(b\.etichetta\)\)/);
  });

  it('applicare il paese aggiorna anche il filtro lingua, come faceva il globo (b.529: via Applica)', () => {
    expect(f).toMatch(/setPaeseScelto\(bozzaPaesePanello\);/);
    expect(f).toMatch(/setLangFilter\(bozzaPaesePanello \? \(linguaDelPaese\(bozzaPaesePanello\) \|\| 'all'\) : 'all'\)/);
  });
});
