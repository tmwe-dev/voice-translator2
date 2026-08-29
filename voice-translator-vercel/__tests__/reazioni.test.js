import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { rilevanza, TIPI } from '../app/lib/stanze/reazioni.js';
import { siConservanoIMessaggi } from '../app/lib/decisioni.js';

const APP = path.join(__dirname, '..', 'app');
const leggi = (p) => fs.readFileSync(path.join(APP, p), 'utf8');

describe('rilevanza delle reazioni', () => {
  it('nessun gesto vale zero e il disaccordo da solo non premia', () => {
    expect(rilevanza({})).toBe(0);
    expect(rilevanza({ su: 0, giu: 20 })).toBe(0);
  });
  it('il cuore pesa piu del pollice e le risposte piu del cuore', () => {
    expect(rilevanza({ cuore: 1 })).toBeGreaterThan(rilevanza({ su: 1 }));
    expect(rilevanza({ risposte: 1 })).toBeGreaterThan(rilevanza({ cuore: 1 }));
  });
  it('il confronto genera piu rilevanza di un consenso piatto', () => {
    expect(rilevanza({ su: 10, giu: 10 })).toBeGreaterThan(rilevanza({ su: 20, giu: 0 }));
  });
  it('i gesti restano tre', () => expect(TIPI).toEqual(['su', 'giu', 'cuore']));
});

describe('reazioni e cifratura: decide il server', () => {
  const lib = leggi('lib/stanze/reazioni.js');
  const rotta = leggi('api/reazioni/route.js');

  it('su e giu si escludono e un contatore non scende sotto zero', () => {
    expect(lib).toMatch(/delta\[opposto\] = -1/);
    expect(lib).toMatch(/Math\.max\(0, conte\[t\]\)/);
  });

  it('una stanza diretta non conserva messaggi, anche se esposta in vetrina', () => {
    expect(siConservanoIMessaggi({ regole: { hostNome: 'luca' }, stanza: { diretta: true } })).toBe(false);
    expect(siConservanoIMessaggi({ regole: { hostNome: 'luca' }, stanza: { diretta: false } })).toBe(true);
  });

  it('il client non puo imporre la conservazione', () => {
    expect(rotta).toMatch(/if \(!await siConserva\(roomId\)\)/);
    expect(rotta).toMatch(/leggiRegole\(roomId\)/);
    expect(rotta).toMatch(/getRoom\(roomId\)/);
  });

  it('lo storico privato e vuoto e quello conservato resta limitato', () => {
    const salva = rotta.slice(rotta.indexOf("case 'salva'"), rotta.indexOf("case 'storico'"));
    const storico = rotta.slice(rotta.indexOf("case 'storico'"));
    expect(salva).toMatch(/conservato: false/);
    expect(storico).toMatch(/conservazione: false/);
    expect(lib).toMatch(/recenti = 20/);
    expect(lib).toMatch(/inCima = 3/);
    expect(lib).toMatch(/\.slice\(0, recenti\)\.reverse\(\)/);
  });
});

describe('la barra sotto ogni messaggio', () => {
  const barra = leggi('components/BarraReazioni.js');
  const vista = leggi('components/RoomView.js');

  it('i tre gesti sono visibili e gli zeri non fanno rumore', () => {
    expect(barra).toMatch(/GESTI\.map/);
    expect(leggi('components/MessageList.js')).toMatch(/<BarraReazioni/);
    expect(barra).toMatch(/\{n > 0 &&/);
  });

  it('una risposta porta con se la citazione e poi la pulisce', () => {
    expect(barra).toMatch(/onRispondi/);
    expect(vista).toMatch(/\{L\('replyToWord'\)\}\s*\{rispostaA\.nome\}/);
    expect(vista).toMatch(/setRispostaA\(\{ id: msgId, nome:/);
    expect(vista).toMatch(/sendTextMessage\(citato[\s\S]{0,80}setRispostaA\(null\)/);
  });
});

describe('chi e invitato entra senza compilare un modulo', () => {
  const init = leggi('hooks/useInitializeApp.js');
  const pagina = leggi('page.js');

  it('il link porta il codice stanza e il ramo automatico scatta anche per un ospite nuovo', () => {
    expect(pagina).toMatch(/&auto=1/);
    expect(init).not.toMatch(/if \(autoJoin && saved\)/);
    const i = init.indexOf('if (roomParam) {');
    const j = init.indexOf('if (paymentStatus ===', i);
    expect(j).toBeGreaterThan(i);
    expect(init.slice(i, j)).toMatch(/setAutoJoinTriggered\(true\)/);
  });

  it('senza nome assegna un ospite provvisorio e usa la lingua del browser', () => {
    expect(init).toMatch(/'Ospite'/);
    expect(init).toMatch(/linguaBrowser/);
  });
});

describe('regalare minuti si trova dalla Home', () => {
  it('la voce esiste e porta al flusso reale', () => {
    const home = leggi('components/HomeView.js');
    expect(home).toMatch(/id: 'regala'/);
    expect(home).toMatch(/actGiftTitle/);
    expect(home).toMatch(/case 'regala'/);
  });
});