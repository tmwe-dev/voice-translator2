import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { promptTavolo } from '../app/lib/compagni/tavolo.js';
import { promptTurno } from '../app/lib/compagni/podcast.js';
import { temperaturaDibattito, temperaturaLiberta } from '../app/lib/compagni/contratto.js';
import { bloccoRegolaDibattito, kbVoceParlata, regoleDibattito } from '../app/lib/compagni/orchestratore.js';
import { COMPAGNI_PREDEFINITI } from '../app/lib/compagni/catalogo.js';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// b.525 — «RadioChat resta il riferimento, BarTalk riceve il motore»
// (ordine di Luca). Questi test provano i PROMPT VERI in uscita dai
// costruttori puri, non la forma del codice: la lezione del globo.

const COMPAGNO = {
  id: 'x', nome: 'Test', personalita: 'Sei Test.',
  liberta: 'strict',
  regolaDibattito: 'Quando dissenti porti il controesempio.',
};

describe('b.525 — le regole del dibattito sono UNA fonte sola', () => {
  it('il Tavolo non ha piu la copia vecchia («CONVERGERE, insieme»)', () => {
    const { system } = promptTavolo({ compagno: COMPAGNO, ultimoUmano: 'ciao', lingua: 'it' });
    expect(system).not.toContain('CONVERGERE, insieme');
    expect(system).toContain('NON aprire mai dando ragione');
  });
  it('Tavolo e Podcast usano le stesse regole', () => {
    const t = promptTavolo({ compagno: COMPAGNO, ultimoUmano: 'ciao', lingua: 'it' }).system;
    const p = promptTurno({ compagno: COMPAGNO, argomento: 'x', lingua: 'it' }).system;
    expect(t).toContain(regoleDibattito('it').slice(0, 80));
    expect(p).toContain(regoleDibattito('it').slice(0, 80));
  });
});

describe('b.525 — ogni Compagno litiga a modo SUO (la debateRule di RadioChat)', () => {
  it('la regola personale entra nel prompt del Tavolo e del Podcast', () => {
    const t = promptTavolo({ compagno: COMPAGNO, ultimoUmano: 'ciao', lingua: 'it' }).system;
    const p = promptTurno({ compagno: COMPAGNO, argomento: 'x', lingua: 'it' }).system;
    expect(t).toContain('Quando dissenti porti il controesempio.');
    expect(p).toContain('Quando dissenti porti il controesempio.');
  });
  it('senza regola il blocco sparisce senza sporcare', () => {
    expect(bloccoRegolaDibattito({ nome: 'X' })).toBe('');
  });
  it('TUTTI gli 8 predefiniti hanno una regola, e sono tutte diverse', () => {
    const regole = COMPAGNI_PREDEFINITI.map(c => c.regolaDibattito);
    expect(regole.every(r => r && r.length > 30)).toBe(true);
    expect(new Set(regole).size).toBe(regole.length);
  });
});

describe('b.525 — menti davvero diverse: i provider si distribuiscono', () => {
  it('almeno 3 provider diversi fra i predefiniti (come RadioChat)', () => {
    const provider = new Set(COMPAGNI_PREDEFINITI.map(c => c.provider));
    expect(provider.size).toBeGreaterThanOrEqual(3);
    expect(provider.has('anthropic')).toBe(true);
    expect(provider.has('gemini')).toBe(true);
  });
  it('ponte traduce l alias nel modello vero (il bug del ripiego silenzioso)', () => {
    const f = leggi('app/lib/compagni/ponte.js');
    expect(f).toMatch(/MODEL_MAP\[modello\]/);
    expect(f).toMatch(/modello = _mappa\.actual/);
  });
});

describe('b.525 — la temperatura di scena', () => {
  it('strict sale al pavimento 0.8 nel dibattito, in chat resta 0.3', () => {
    expect(temperaturaLiberta('strict')).toBe(0.3);
    expect(temperaturaDibattito('strict')).toBe(0.8);
  });
  it('autonomous non viene abbassato', () => {
    expect(temperaturaDibattito('autonomous')).toBe(0.95);
  });
  it('le route la usano davvero', () => {
    expect(leggi('app/api/compagni/tavolo/route.js')).toMatch(/temperature: temperaturaDibattito/);
    expect(leggi('app/api/compagni/podcast/route.js')).toMatch(/temperature: temperaturaDibattito/);
  });
});

describe('b.525 — si scrive per la voce', () => {
  it('la KB voce entra nei prompt di Tavolo e Podcast', () => {
    const t = promptTavolo({ compagno: COMPAGNO, ultimoUmano: 'ciao', lingua: 'it' }).system;
    const p = promptTurno({ compagno: COMPAGNO, argomento: 'x', lingua: 'it' }).system;
    expect(t).toContain('[VOCE]');
    expect(p).toContain('[VOCE]');
    expect(kbVoceParlata('fr')).toContain('[VOICE]'); // lingue non coperte -> inglese
  });
});

describe('b.525 — il primo giro pianta le bandiere', () => {
  it('con apertura il Tavolo chiede la posizione distintiva', () => {
    const si = promptTavolo({ compagno: COMPAGNO, ultimoUmano: 'ciao', apertura: true, lingua: 'it' }).system;
    const no = promptTavolo({ compagno: COMPAGNO, ultimoUmano: 'ciao', apertura: false, lingua: 'it' }).system;
    expect(si).toContain('pianta la tua bandiera');
    expect(no).not.toContain('pianta la tua bandiera');
  });
  it('la route lo attiva quando nessun agente ha ancora parlato', () => {
    expect(leggi('app/api/compagni/tavolo/route.js')).toMatch(/const apertura = !storia\.some/);
  });
});

describe('b.525 — memoria piu lunga e una sola uscita', () => {
  it('la storia oltre gli 8 non sparisce: viene condensata', () => {
    const storia = Array.from({ length: 20 }, (_, i) => ({ ruolo: i % 2 ? 'persona' : 'Test', testo: `messaggio numero ${i} con abbastanza testo da superare il taglio della riga condensata sicuro` }));
    const { prompt } = promptTavolo({ compagno: COMPAGNO, storia, ultimoUmano: 'ciao', lingua: 'it' });
    expect(prompt).toContain('PRIMA (in breve):');
    expect(prompt).toContain('messaggio numero 8');   // condensato
    expect(prompt).toContain('messaggio numero 19');  // intero
  });
  it('il triplo invito a tacere non c e piu: resta solo il canale esito', () => {
    const { prompt, system } = promptTavolo({ compagno: COMPAGNO, ultimoUmano: 'ciao', lingua: 'it' });
    expect(prompt).not.toContain('SOLO se hai qualcosa di fondato');
    expect(prompt.trim().endsWith('Rispondi come Test.')).toBe(true);
    expect(system).toContain('esito');
  });
});
