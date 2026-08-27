import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// ═══ b.536 — «perche vita ti butta fuori sessione costantemente?» (Luca)
// Tre cause vere, tutte e tre chiuse. Le prime due si provano sui
// RISULTATI (funzioni vere, non forma del codice).

describe('b.536 — l\'interruttore della sessione torna indietro da solo', () => {
  beforeEach(() => vi.resetModules());

  it('un 401 accende l\'avviso, una richiesta riuscita lo spegne', async () => {
    const { segnalaSessioneCaduta, sessioneRipresa, sessioneECaduta, ascoltaSessione } =
      await import('../app/lib/sessioneCaduta.js');
    const visti = [];
    const stop = ascoltaSessione((v) => visti.push(v));
    expect(sessioneECaduta()).toBe(false);
    segnalaSessioneCaduta();
    expect(sessioneECaduta()).toBe(true);
    // PRIMA di b.536 finiva qui: nessuno chiamava sessioneRipresa, e il
    // cartello restava fino al ricaricamento della pagina.
    sessioneRipresa();
    expect(sessioneECaduta()).toBe(false);
    expect(visti).toEqual([false, true, false]); // primo giro + accesa + spenta
    stop();
  });

  it('e chi riceve le risposte la chiama davvero, a ogni richiesta riuscita', () => {
    const c = leggi('app/lib/compagni/cliente.js');
    expect(c).toMatch(/import \{ segnalaSessioneCaduta, sessioneRipresa \}/);
    // la chiamata sta DOPO il blocco d'errore, sulla strada del successo
    const dopoErrore = c.slice(c.indexOf('if (r.status === 401) segnalaSessioneCaduta();'));
    expect(dopoErrore.slice(0, 900)).toMatch(/sessioneRipresa\(\);\s*\n\s*return dati;/);
  });
});

describe('b.536 — la sessione si rinnova mentre la usi', () => {
  it('getSession rimette l\'orologio a sette giorni a ogni uso', async () => {
    const u = leggi('app/lib/users.js');
    // la nascita: scadenza fissa a 7 giorni
    expect(u).toMatch(/createSession[\s\S]{0,400}'EX', 604800/);
    // l'uso: rinnovo della STESSA durata, dentro getSession
    const dentro = u.slice(u.indexOf('export async function getSession'), u.indexOf('export async function getSession') + 2200);
    expect(dentro).toMatch(/redis\('EXPIRE', `session:\$\{token\}`, 604800\)/);
    // e non deve poter far cadere la lettura: sta in un try
    expect(dentro).toMatch(/try \{ await redis\('EXPIRE'/);
  });
});

describe('b.536 — «Rientra» rientra davvero', () => {
  it('butta il gettone morto prima di riaprire', () => {
    const a = leggi('app/components/AvvisoSessione.js');
    expect(a).toContain("memDel('vt-token')");
    const tasto = a.slice(a.indexOf('<button onClick={() => {'));
    expect(tasto.indexOf("memDel('vt-token')")).toBeLessThan(tasto.indexOf('window.location.reload()'));
  });
});

describe('b.536 — scegli una frase, il play ripete QUELLA', () => {
  const f = leggi('app/components/PrimaProva.js');
  it('ogni frase del registro si puo toccare, e la scelta si vede', () => {
    expect(f).toMatch(/const \[sceltaIdx, setSceltaIdx\] = useState\(null\)/);
    expect(f).toMatch(/setSceltaIdx\(scelta \? null : i\)/);       // tocco = scegli / annulla
    expect(f).toMatch(/aria-pressed=\{scelta\}/);                  // lo dice anche a chi non vede
    expect(f).toMatch(/boxShadow: scelta \?/);                     // barra sul fianco
    expect(f).toMatch(/background: scelta \? `\$\{C\.accent/);      // velo di accento
  });
  it('il play legge la frase scelta, nella lingua giusta di chi l\'ha detta', () => {
    const tasto = f.slice(f.indexOf('const rigaScelta = sceltaIdx != null'));
    expect(tasto).toMatch(/const daLeggere = rigaScelta \? rigaScelta\.resa : ultimaResa/);
    // le frasi dell'ospite (inverso) si rileggono nella MIA lingua
    expect(tasto).toMatch(/rigaScelta\.inverso \? miaLingua : meta/);
    expect(tasto).toMatch(/parla\(daLeggere, linguaLettura\)/);
    // senza scelta resta il comportamento di sempre: l'ultima frase
    expect(tasto).toMatch(/linguaLettura = rigaScelta \?[\s\S]{0,60}: undefined/);
  });
});
