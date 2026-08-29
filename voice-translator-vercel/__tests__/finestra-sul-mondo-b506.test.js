import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { settingsDaPrefs, NON_PIU_PREFERENZE } from '../app/lib/mondo/settings.js';

// ═══ b.506 → b.580 — LA FINESTRA SUL MONDO ═══
// La prova originaria descriveva il vecchio client a polling: ritmo
// 2/5/10 minuti, visibilitychange e richiesta "fresca". Da b.580 Mondo
// ha un motore centrale e il browser ascolta il bus SSE. Questo test
// conserva l'intenzione del prodotto, ma verifica l'architettura attuale.

const fin = readFileSync(join(process.cwd(), 'app/components/FinestraSulMondo.js'), 'utf8');
const pref = readFileSync(join(process.cwd(), 'app/components/ui/PreferenzeMondo.js'), 'utf8');
const mondo = readFileSync(join(process.cwd(), 'app/components/MondoView.js'), 'utf8');

describe('la finestra sul mondo', () => {
  it('il ritmo non e piu una preferenza tecnica esposta alla persona', () => {
    expect(NON_PIU_PREFERENZE).toContain('mondoRitmo');
    expect(pref).not.toMatch(/key:\s*['"]mondoRitmo['"]/);

    const conVecchioRitmo = settingsDaPrefs({ mondoRitmo: 'mai' });
    const senzaVecchioRitmo = settingsDaPrefs({});
    expect(conVecchioRitmo).toEqual(senzaVecchioRitmo);
  });

  it('ascolta Mondo Live via SSE e chiude la connessione allo smontaggio', () => {
    expect(fin).toMatch(/new EventSource\(`\/api\/mondo\/live\?/);
    expect(fin).toMatch(/source\.addEventListener\(['"]heartbeat['"]/);
    expect(fin).toMatch(/source\.addEventListener\(['"]events['"]/);
    expect(fin).toMatch(/source\?\.close\(\)/);
  });

  it('non ripristina il vecchio polling a ritmo scelto dal browser', () => {
    expect(fin).not.toMatch(/prefs\?\.mondoRitmo/);
    expect(fin).not.toMatch(/fresca:\s*ritmo\s*===/);
    expect(fin).not.toMatch(/visibilitychange/);
  });

  it('un heartbeat o una riga SSE incompleti non inventano errori visibili', () => {
    expect(fin).toMatch(/Un heartbeat monco non modifica lo stato buono precedente/);
    expect(fin).toMatch(/Una riga SSE incompleta viene ignorata; EventSource prosegue/);
    expect(fin).toMatch(/state:\s*['"]recovering['"]/);
  });

  it('il cartello si apre a tutto schermo e mostra le fonti reali', () => {
    expect(fin).toMatch(/setAperta\(cartello\)/);
    expect(fin).toMatch(/\(aperta\.sources \|\| \[\]\)\.slice\(0, 6\)/);
    expect(fin).toMatch(/href=\{f\.url\}/);
    expect(fin).toMatch(/rel=['"]noopener noreferrer['"]/);
  });

  it('vive nel Mondo come fratello del globo', () => {
    expect(mondo).toMatch(/<FinestraSulMondo/);
  });

  it('la parola breaking resta disponibile in tutte le 38 lingue', () => {
    const cart = join(process.cwd(), 'app/lib/locales');
    const lingue = readdirSync(cart).filter((f) => f.endsWith('.js'));
    expect(lingue.length).toBe(38);
    for (const f of lingue) {
      const s = readFileSync(join(cart, f), 'utf8');
      expect(s.includes('"breakingWord":"'), `${f}/breakingWord`).toBe(true);
    }
  });
});
