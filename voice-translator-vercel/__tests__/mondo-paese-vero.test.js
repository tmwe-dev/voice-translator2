import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

describe('il Paese vero viaggia con le stanze', () => {
  it('il telefono manda il Paese del profilo quando crea la stanza', () => {
    expect(leggi('app/page.js')).toMatch(/paese: prefs\.country \|\| ''/);
  });
  it('la rotta accetta solo due lettere e le conserva', () => {
    const r = leggi('app/api/mondo/route.js');
    expect(r).toMatch(/hot, paese,/);
    expect(r).toMatch(/paese: \/\^\[A-Za-z\]\{2\}\$\/\.test/);
  });
  it('Mondo separa Paese e lingua: col Paese scelto usa il Paese vero, le stanze legacy restano visibili', () => {
    const v = leggi('app/components/MondoView.js');
    expect(v).toMatch(/if \(paeseScelto\) list = list\.filter\(\(r\) => !r\.paese \|\| r\.paese === paeseScelto\)/);
    expect(v).toMatch(/else if \(langFilter !== 'all'\) list = list\.filter\(r => r\.lang === langFilter\)/);
    expect(v).toMatch(/\[rooms, langFilter, modeFilter, search, paeseScelto\]/);
  });
});

describe('la vetrina mostra numeri contati, non inventati', () => {
  const r = leggi('app/api/mondo/route.js');
  it('legge le stanze vive e aggiorna i presenti', () => {
    expect(r).toMatch(/redis\('MGET', \.\.\.chiavi\)/);
    expect(r).toMatch(/active\[i\]\.memberCount = stanza\.members\.length/);
  });
  it('non mostra una stanza gia finita come aperta', () => {
    expect(r).toMatch(/active\[i\]\.chiusa = true/);
    expect(r).toMatch(/active\.filter\(r => !r\.chiusa\)/);
  });
});

describe('b.580 — il Mondo apre sul Paese di casa ma permette Mondo intero', () => {
  const v = leggi('app/components/MondoView.js');
  it('deduce il Paese dalla lingua solo all ingresso', () => {
    expect(v).toMatch(/const mio = paeseDaLingua\(prefs\?\.lang\)/);
    expect(v).toMatch(/if \(mio\) setPaeseScelto\(mio\)/);
  });
  it('il ritorno al mondo intero passa dalla scelta Paese delle News', () => {
    expect(v).toMatch(/suPaeseScelto=\{\(codice\) => \{ setPaeseScelto\(codice\)/);
    expect(v).toMatch(/L\('wholeWorld'\)/);
  });
  it('la preferenza tecnica mondoPaese non torna nel pannello', () => {
    const p = leggi('app/components/ui/PreferenzeMondo.js');
    expect(p).not.toMatch(/mondoPaese|opzioniPaese/);
  });
});

describe('b.580 — il globo approvato resta visibile', () => {
  const v = leggi('app/components/MondoView.js');
  it('la sorgente dichiara esplicitamente che non esiste piu il velo scuro sul pianeta', () => {
    expect(v).toMatch(/nessun velo scuro sopra Terra/);
  });
  it('lo scroll puo ancora alimentare la UI senza dipingere un gradiente di oscuramento sul globo', () => {
    expect(v).toMatch(/const \[discesa, setDiscesa\] = useState\(0\)/);
    expect(v).toMatch(/const seguiScorrimento = useCallback/);
    expect(v).not.toMatch(/rgba\(5,7,15,\$\{[^}]*discesa/);
  });
  it('il radar Live usa lo stesso GloboMondo, non una seconda mappa', () => {
    expect(v).toMatch(/<GloboMondo/);
    expect(v).toMatch(/<FinestraSulMondo/);
    expect(v).toMatch(/focusEsterno=\{paeseFocusNotizia\}/);
  });
});

describe('Paese scelto: una sorgente di verita', () => {
  it('News rimanda la scelta a MondoView', () => {
    const n = leggi('app/components/MondoNews.js');
    expect(n).toMatch(/scegliPaese\(paeseFiltro === d\.country \? null : d\.country\)/);
    expect(n).toMatch(/suPaeseScelto\?\.\(codice\)/);
  });
  it('la scheda Paese usa una singola chiamata e non inventa zero', () => {
    const v = leggi('app/components/MondoView.js');
    expect((v.match(/\/api\/mondo\/paese\?code=/g) || []).length).toBe(1);
    expect(v).toMatch(/Number\.isFinite\(schedaPaese\.persone\) && schedaPaese\.persone > 0/);
  });
});

describe('le parole base del Paese restano in tutte le lingue', () => {
  it('wholeWorld e changeWord esistono nei 38 pacchetti', async () => {
    const files = readdirSync(join(process.cwd(), 'app/lib/locales')).filter((f) => f.endsWith('.js'));
    expect(files).toHaveLength(38);
    for (const f of files) {
      const o = (await import(`../app/lib/locales/${f}`)).default;
      expect(typeof o.wholeWorld, f).toBe('string');
      expect(typeof o.changeWord, f).toBe('string');
    }
  }, 30000);
});