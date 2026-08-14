// ═══════════════════════════════════════════════════════════════
// GUARDIA SU REAZIONI, RILEVANZA E INVITI
//
// Due promesse diverse che non devono mai mescolarsi:
//
//   · REAGIRE si puo sempre, anche dove il testo e cifrato: si conta un
//     identificativo, non si legge un messaggio
//   · CONSERVARE i messaggi solo nelle stanze Community, dove e scritto
//
// Piu la regola che chi e invitato ENTRA, non compila un modulo.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { rilevanza, TIPI } from '../app/lib/reazioni.js';

const APP = path.join(__dirname, '..', 'app');
const leggi = (p) => fs.readFileSync(path.join(APP, p), 'utf8');

describe('rilevanza', () => {
  it('un messaggio che nessuno ha toccato resta a zero', () => {
    expect(rilevanza({})).toBe(0);
    expect(rilevanza({ su: 0, giu: 0, cuore: 0, risposte: 0 })).toBe(0);
  });

  it('il cuore pesa piu del pollice', () => {
    expect(rilevanza({ cuore: 1 })).toBeGreaterThan(rilevanza({ su: 1 }));
  });

  it('cio che fa discutere sale piu di cio che piace e basta', () => {
    // La richiesta era esplicita: dare rilevanza ai messaggi che fanno
    // discutere. Dieci contro dieci racconta il clima meglio di venti a zero.
    const litigioso = rilevanza({ su: 10, giu: 10 });
    const pacifico = rilevanza({ su: 20, giu: 0 });
    expect(litigioso).toBeGreaterThan(pacifico);
  });

  it('il disaccordo da solo non fa salire niente', () => {
    // Altrimenti basterebbe farsi odiare per finire in cima.
    expect(rilevanza({ su: 0, giu: 20 })).toBe(0);
  });

  it('le risposte pesano piu di tutto: sono la fatica maggiore', () => {
    expect(rilevanza({ risposte: 1 })).toBeGreaterThan(rilevanza({ cuore: 1 }));
  });

  it('i gesti sono tre, non di piu', () => {
    expect(TIPI).toEqual(['su', 'giu', 'cuore']);
  });
});

describe('reazioni e cifratura', () => {
  const lib = leggi('lib/reazioni.js');
  const rotta = leggi('api/reazioni/route.js');

  it('su e giu si escludono a vicenda', () => {
    expect(lib).toMatch(/opposto/);
    expect(lib, 'chi cambia idea non deve restare contato due volte').toMatch(/delta\[opposto\] = -1/);
  });

  it('il secondo tocco toglie la reazione', () => {
    expect(lib).toMatch(/delta\[tipo\] = -1/);
  });

  it('un contatore non scende sotto zero', () => {
    expect(lib).toMatch(/Math\.max\(0, conte\[t\]\)/);
  });

  it('conservare i messaggi vale SOLO per le stanze Community', () => {
    const blocco = rotta.slice(rotta.indexOf("case 'salva'"), rotta.indexOf("case 'storico'"));
    expect(blocco).toMatch(/eCommunity/);
    expect(blocco, 'la riservatezza delle chat private va rispettata in silenzio')
      .toMatch(/conservato: false/);
  });

  it('lo storico di una chat privata e vuoto, non un errore', () => {
    const blocco = rotta.slice(rotta.indexOf("case 'storico'"));
    expect(blocco).toMatch(/conservazione: false/);
  });

  it('e il SERVER a decidere, non il telefono', () => {
    // Il client manda tutto: se decidesse lui, basterebbe un client
    // modificato per far conservare una chat privata.
    expect(leggi('components/RoomView.js')).toMatch(/reazioni\.conserva/);
    expect(rotta).toMatch(/if \(!await eCommunity\(roomId\)\)/);
  });

  it('lo storico mostra gli ultimi venti e i tre piu rilevanti', () => {
    expect(lib).toMatch(/recenti = 20/);
    expect(lib).toMatch(/inCima = 3/);
  });

  it('i messaggi recenti si leggono nell\'ordine giusto', () => {
    // LPUSH mette in testa il piu nuovo: senza reverse si legge al contrario.
    expect(lib).toMatch(/\.slice\(0, recenti\)\.reverse\(\)/);
  });
});

describe('la barra sotto ogni messaggio', () => {
  const barra = leggi('components/BarraReazioni.js');

  it('i tre gesti sono sempre in vista, non dietro una pressione lunga', () => {
    expect(barra).toMatch(/GESTI\.map/);
    expect(leggi('components/MessageList.js')).toMatch(/<BarraReazioni/);
  });

  it('gli zeri non si mostrano: sarebbero rumore', () => {
    expect(barra).toMatch(/\{n > 0 &&/);
  });

  it('si puo rispondere a un messaggio', () => {
    expect(barra).toMatch(/onRispondi/);
    expect(leggi('components/RoomView.js'), 'la citazione va sopra il campo di scrittura')
      .toMatch(/Rispondi a \{rispostaA\.nome\}/);
  });
});

describe('chi e invitato entra, non compila un modulo', () => {
  const init = leggi('hooks/useInitializeApp.js');
  const pagina = leggi('page.js');

  it('il link di invito porta dentro da solo', () => {
    expect(pagina, 'senza auto=1 il link apre un modulo').toMatch(/&auto=1/);
  });

  it('l\'ingresso automatico non pretende piu una visita precedente', () => {
    // Era `if (autoJoin && saved)`: un ospite nuovo non ha niente di
    // salvato, quindi non scattava MAI proprio per chi ne aveva bisogno.
    expect(init).not.toMatch(/if \(autoJoin && saved\)/);
    // b.133 — e non pretende piu nemmeno `auto=1`, che mettevano solo i
    // nostri QR. Questa riga chiedeva `if (autoJoin) {`: il cancello e
    // caduto del tutto, ora basta il codice stanza. La garanzia e piu
    // forte di prima, non piu debole — si veda
    // invito-si-entra-e-basta.test.js.
    expect(init).not.toMatch(/if \(autoJoin\) \{/);
    // `init` qui e il sorgente COI COMMENTI, e in mezzo ce ne sono molti:
    // la finestra va presa larga o si taglia prima di arrivarci.
    const i = init.indexOf('if (roomParam) {');
    const j = init.indexOf('if (paymentStatus ===', i);
    expect(j, 'il ramo del codice stanza deve chiudersi prima dei pagamenti')
      .toBeGreaterThan(i);
    expect(init.slice(i, j)).toMatch(/setAutoJoinTriggered\(true\)/);
  });

  it('a chi non ha un nome se ne da uno provvisorio', () => {
    expect(init).toMatch(/'Ospite'/);
    expect(init, 'e la lingua la prende dal browser').toMatch(/linguaBrowser/);
  });
});

describe('regalare minuti si trova', () => {
  it('c\'e una voce in Home, non solo in fondo alla pagina del credito', () => {
    const home = leggi('components/HomeView.js');
    expect(home).toMatch(/id: 'regala'/);
    expect(home).toMatch(/actGiftTitle/);
    expect(home, 'e porta dove i minuti si scalano davvero').toMatch(/case 'regala'/);
  });
});

describe('la riservatezza e scritta prima di entrare', () => {
  it('la scheda della stanza dice che i messaggi restano', () => {
    expect(leggi('components/MondoView.js')).toMatch(/openRoomNotice/);
  });
});
