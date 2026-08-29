import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { paeseDaDominio, paeseDellaNotizia } from '../app/lib/paeseDaFonte.js';
import { PAESI } from '../app/lib/paesi.js';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');
const NOTI = new Set(PAESI.map((p) => p.codice));

describe('b.517 — il paese si legge dalla fonte senza inventarlo', () => {
  it('riconosce domini nazionali e grandi testate', () => {
    expect(paeseDaDominio('corriere.it', NOTI)).toBe('IT');
    expect(paeseDaDominio('lemonde.fr', NOTI)).toBe('FR');
    expect(paeseDaDominio('independent.co.uk', NOTI)).toBe('GB');
    expect(paeseDaDominio('bbc.com', NOTI)).toBe('GB');
    expect(paeseDaDominio('nytimes.com', NOTI)).toBe('US');
  });
  it('domini ambigui o sconosciuti non producono un paese', () => {
    expect(paeseDaDominio('qualcosa.tv', NOTI)).toBeNull();
    expect(paeseDaDominio('startup.io', NOTI)).toBeNull();
    expect(paeseDaDominio('esempio.qualcosa', NOTI)).toBeNull();
  });
  it('paeseDellaNotizia usa la prima fonte utile e poi il link', () => {
    expect(paeseDellaNotizia({ fonti: [{ dominio: 'sconosciuto.xyz' }, { dominio: 'lastampa.it' }] }, NOTI)).toBe('IT');
    expect(paeseDellaNotizia({ fonti: [], url: 'https://www.elpais.com/x' }, NOTI)).toBe('ES');
    expect(paeseDellaNotizia({}, NOTI)).toBeNull();
  });
});

describe('b.517 → b.580 — il radar Live porta il globo al Paese dell evento', () => {
  const f = leggi('app/components/FinestraSulMondo.js');
  it('non usa piu la vecchia paeseRicerca del polling', () => {
    expect(f).not.toMatch(/paeseRicerca|paeseDelGiro|CODICI_NOTI/);
  });
  it('usa countries/country consegnati dall evento centrale', () => {
    expect(f).toMatch(/const code = \(prossimo\.countries \|\| \[prossimo\.country\]\)\.filter\(Boolean\)\[0\] \|\| null/);
    expect(f).toMatch(/onPuntaGlobo\?\.\(code\)/);
  });
});

describe('b.517 → b.580 — il globo non interrompe quello che sto facendo', () => {
  const f = leggi('app/components/FinestraSulMondo.js');
  const v = leggi('app/components/MondoView.js');
  it('la finestra conserva occupato in un ref', () => {
    expect(f).toMatch(/occupato = false/);
    expect(f).toMatch(/occupatoRef\.current = occupato/);
  });
  it('la coda avanza solo se non ci sono cartello, lettura, volo o occupazione', () => {
    expect(f).toMatch(/!cartelloRef\.current && !apertaRef\.current && !aspettandoRef\.current && !occupatoRef\.current/);
  });
  it('MondoView alimenta occupato', () => {
    expect(v).toMatch(/occupato=\{strumenti \|\| !!schedaPaese\}/);
  });
});

describe('b.517 — installare l app non e un vicolo cieco', () => {
  const f = leggi('app/components/SettingsView.js');
  it('la voce riapre il pannello e sparisce se gia installata', () => {
    expect(f).toMatch(/\{L\('installTheApp'\)\}/);
    expect(f).toMatch(/memDel\('vt-install-dismissed'\)/);
    expect(f).toMatch(/\{!eInstallata\(\) && \(/);
  });
});