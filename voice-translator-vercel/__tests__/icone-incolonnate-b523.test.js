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
    expect(f).toMatch(/function BadgeStato/);
    expect(f).toMatch(/rgba\(140,88,48,0\.34\)/);
    expect(f).toMatch(/rgba\(206,146,92,0\.5\)/);
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
    expect(f).toMatch(/etichetta=\{L\('countryLabel'\)\}/);
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
