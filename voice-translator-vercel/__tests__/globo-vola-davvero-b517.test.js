import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { paeseDaDominio, paeseDellaNotizia } from '../app/lib/paeseDaFonte.js';
import { PAESI } from '../app/lib/paesi.js';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');
const NOTI = new Set(PAESI.map((p) => p.codice));

// b.517 — Luca: «globo hai dimenticato le modifiche».
// BUG PRE-ESISTENTE (mio, b.515): il volo del pianeta verso la notizia
// era scritto ma non scattava MAI, perche il paese della notizia era
// `interessi.length ? null : paese` — null col modo normale, e il paese
// gia scelto (dove il globo sta gia) senza interessi.

describe('b.517 — il paese si legge dal dominio della fonte', () => {
  it('suffisso nazionale', () => {
    expect(paeseDaDominio('corriere.it', NOTI)).toBe('IT');
    expect(paeseDaDominio('lemonde.fr', NOTI)).toBe('FR');
    expect(paeseDaDominio('www.spiegel.de', NOTI)).toBe('DE');
    expect(paeseDaDominio('asahi.co.jp', NOTI)).toBe('JP');
  });
  it('.uk diventa GB, che e il codice che il globo conosce', () => {
    expect(paeseDaDominio('independent.co.uk', NOTI)).toBe('GB');
  });
  it('le grandi testate senza suffisso nazionale', () => {
    expect(paeseDaDominio('bbc.com', NOTI)).toBe('GB');
    expect(paeseDaDominio('nytimes.com', NOTI)).toBe('US');
    expect(paeseDaDominio('aljazeera.com', NOTI)).toBe('QA');
    expect(paeseDaDominio('edition.cnn.com', NOTI)).toBe('US');
  });
  it('i suffissi bugiardi non mandano il globo a caso', () => {
    expect(paeseDaDominio('qualcosa.tv', NOTI)).toBeNull();  // Tuvalu, ma e una tv
    expect(paeseDaDominio('startup.io', NOTI)).toBeNull();
    expect(paeseDaDominio('tale.me', NOTI)).toBeNull();
  });
  it('meglio fermo che nel posto sbagliato: sconosciuto -> null', () => {
    expect(paeseDaDominio('esempio.qualcosa', NOTI)).toBeNull();
    expect(paeseDaDominio('', NOTI)).toBeNull();
    expect(paeseDaDominio(null, NOTI)).toBeNull();
  });
  it('vince la prima fonte riconosciuta', () => {
    expect(paeseDellaNotizia({ fonti: [{ dominio: 'sconosciuto.xyz' }, { dominio: 'lastampa.it' }] }, NOTI)).toBe('IT');
  });
  it('se le fonti non dicono niente, prova il link dell articolo', () => {
    expect(paeseDellaNotizia({ fonti: [], url: 'https://www.elpais.com/x' }, NOTI)).toBe('ES');
  });
  it('niente fonti e niente link: null, non un paese inventato', () => {
    expect(paeseDellaNotizia({}, NOTI)).toBeNull();
  });
});

describe('b.517 — FinestraSulMondo usa davvero il paese della notizia', () => {
  const f = leggi('app/components/FinestraSulMondo.js');
  it('la riga morta di b.515 non c e piu', () => {
    expect(f).not.toMatch(/paeseRicerca: interessi\.length \? null : paese \}\)\)\)/);
  });
  it('il paese arriva dalla notizia, col vecchio come ripiego', () => {
    // b.523 — il ripiego non e piu il paese scelto ma quello del giro (casa / dove sono)
    expect(f).toMatch(/paeseRicerca: paeseDellaNotizia\(t, CODICI_NOTI\) \|\| \(interessi\.length \? null : paeseDelGiro\)/);
  });
  it('vola solo verso paesi che il globo conosce', () => {
    expect(f).toMatch(/const CODICI_NOTI = new Set\(PAESI\.map/);
  });
});

describe('b.517 — il globo sta fermo mentre l utente sta facendo qualcosa', () => {
  const f = leggi('app/components/FinestraSulMondo.js');
  const v = leggi('app/components/MondoView.js');
  it('la finestra accetta occupato e lo legge da un ref', () => {
    expect(f).toMatch(/occupato = false \}\)/);
    expect(f).toMatch(/occupatoRef\.current = occupato/);
  });
  it('la guardia lo include', () => {
    expect(f).toMatch(/!apertaRef\.current && !occupatoRef\.current\) avanza\(\)/);
  });
  it('MondoView lo alimenta col pannello aperto e la scheda paese', () => {
    expect(v).toMatch(/occupato=\{strumenti \|\| !!schedaPaese\}/);
  });
});

describe('b.517 — installare l app non e piu un vicolo cieco', () => {
  const f = leggi('app/components/SettingsView.js');
  it('la voce esiste in Strumenti e riapre il pannello', () => {
    expect(f).toMatch(/\{L\('installTheApp'\)\}/);
    expect(f).toMatch(/memDel\('vt-install-dismissed'\)/);
  });
  it('sparisce se l app e gia installata', () => {
    expect(f).toMatch(/\{!eInstallata\(\) && \(/);
  });
});
