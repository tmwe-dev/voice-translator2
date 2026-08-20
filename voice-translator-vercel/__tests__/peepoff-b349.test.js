import { describe, it, expect } from 'vitest';
import { normalizzaEmail, emailInIndirizzo, normalizzaIndirizzo, indirizzoInEmail } from '../app/lib/peepoff/indirizzo.js';
import { generaIdentita, sigilla, apri, firmaRicevuta, verificaRicevuta, improntaChiave, improntaLeggibile } from '../app/lib/peepoff/busta.js';
import { attesaScalino, voceDovuta, SCALA_MS, SCADENZA_MS } from '../app/lib/peepoff/archivio.js';

describe('b.349 — PeepOff · l\'indirizzo derivato', () => {
  it('l\'email diventa l\'address sostituendo la sola @ con #', () => {
    expect(emailInIndirizzo('Luca@TMWE.it ')).toBe('luca#tmwe.it');
    expect(indirizzoInEmail('luca#tmwe.it')).toBe('luca@tmwe.it');
  });
  it('gli indirizzi storpi vengono rifiutati, non aggiustati', () => {
    expect(normalizzaEmail('doppia@@chiocciola.it')).toBeNull();
    expect(normalizzaEmail('senzadominio@')).toBeNull();
    expect(normalizzaIndirizzo('luca#tmwe')).toBeNull();        // dominio senza punto
    expect(normalizzaIndirizzo('luca#due#canc.it')).toBeNull(); // due cancelletti
    expect(normalizzaIndirizzo('luca@tmwe.it')).toBeNull();     // e un\'email, non un address
  });
});

describe('b.349 — PeepOff · la busta cifrata', () => {
  it('sigilla per il destinatario, si apre solo con la SUA chiave, firma verificata', async () => {
    const mario = await generaIdentita();
    const luca = await generaIdentita();
    const msg = { oggetto: 'Preventivo', corpo: 'Cifre riservate: 12.500', da: 'luca#tmwe.it', a: 'mario#acme.it', quando: 1 };
    const busta = await sigilla(msg, mario.scambioPub, luca.firma.privateKey);
    // il server vedrebbe SOLO questo: niente testo in chiaro dentro la busta
    expect(JSON.stringify(busta)).not.toContain('Preventivo');
    expect(JSON.stringify(busta)).not.toContain('12.500');
    const esito = await apri(busta, mario.scambio.privateKey, luca.firmaPub);
    expect(esito.messaggio).toEqual(msg);
    expect(esito.firmaValida).toBe(true);
  });
  it('un intruso senza la chiave del destinatario NON apre la busta', async () => {
    const mario = await generaIdentita();
    const luca = await generaIdentita();
    const intruso = await generaIdentita();
    const busta = await sigilla({ corpo: 'segreto' }, mario.scambioPub, luca.firma.privateKey);
    await expect(apri(busta, intruso.scambio.privateKey, luca.firmaPub)).rejects.toThrow();
  });
  it('la firma di un impostore risulta NON valida', async () => {
    const mario = await generaIdentita();
    const luca = await generaIdentita();
    const impostore = await generaIdentita();
    const busta = await sigilla({ corpo: 'ciao' }, mario.scambioPub, impostore.firma.privateKey);
    const esito = await apri(busta, mario.scambio.privateKey, luca.firmaPub); // dice di essere Luca
    expect(esito.firmaValida).toBe(false);
  });
  it('la ricevuta firmata dal destinatario si verifica; quella falsa no', async () => {
    const mario = await generaIdentita();
    const luca = await generaIdentita();
    const busta = await sigilla({ corpo: 'documento' }, mario.scambioPub, luca.firma.privateKey);
    const { improntaBusta } = await apri(busta, mario.scambio.privateKey, luca.firmaPub);
    const ricevuta = await firmaRicevuta(improntaBusta, mario.firma.privateKey);
    expect(await verificaRicevuta(ricevuta, busta, mario.firmaPub)).toBe(true);
    // firmata da un ALTRO dispositivo: respinta
    const falsario = await generaIdentita();
    const falsa = await firmaRicevuta(improntaBusta, falsario.firma.privateKey);
    expect(await verificaRicevuta(falsa, busta, mario.firmaPub)).toBe(false);
  });
  it('l\'impronta e stabile e leggibile a gruppi', async () => {
    const io = await generaIdentita();
    expect(io.impronta).toMatch(/^[0-9a-f]{64}$/);
    expect(await improntaChiave(io.firmaPub)).toBe(io.impronta);
    expect(improntaLeggibile(io.impronta)).toMatch(/^([0-9A-F]{4} ){7}[0-9A-F]{4}$/);
  });
});

describe('b.349 — PeepOff · la coda a scalini', () => {
  it('la scala e 5s → 1min → 10min → 1h, poi costante', () => {
    expect(attesaScalino(0)).toBe(SCALA_MS[0]);
    expect(attesaScalino(3)).toBe(SCALA_MS[3]);
    expect(attesaScalino(99)).toBe(SCALA_MS[3]);
  });
  it('una voce consegnata non e mai dovuta; una scaduta e dovuta (va CHIUSA)', () => {
    const ora = 10_000_000_000;
    expect(voceDovuta({ stato: 'consegnato', creato: ora, prossimo: 0 }, ora)).toBe(false);
    expect(voceDovuta({ stato: 'spento', creato: ora - SCADENZA_MS - 1, prossimo: ora + 999999 }, ora)).toBe(true);
    expect(voceDovuta({ stato: 'in_coda', creato: ora, prossimo: ora + 5000 }, ora)).toBe(false);
    expect(voceDovuta({ stato: 'in_coda', creato: ora, prossimo: ora - 1 }, ora)).toBe(true);
  });
});
