// ═══════════════════════════════════════════════════════════════
// LA STANZA DIRETTA, SCEGLIBILE DAVVERO (b.113)
//
// In b.112 il meccanismo ha smesso di essere finto: il cancello davanti
// a fetch manda l'intestazione e ferma le rotte vietate. Ma restava un
// vuoto che il referto ha visto subito:
//
//   NESSUNA SCHERMATA POTEVA ACCENDERLO.
//
// Un meccanismo perfettamente funzionante che nessuno puo usare vale
// quanto un meccanismo rotto — anzi meno, perche da l'impressione che
// il problema sia risolto.
//
// Qui si prova che la scelta esiste, che dice il suo prezzo per
// intero, che viaggia con la stanza (chi entra da un invito la eredita)
// e che non si eredita fra una conversazione e l'altra.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import italiano from '../app/lib/locales/it.js';
import { modalitaDiStanza, eDiretta } from '../app/lib/decisioni.js';

const app = (p) => fs.readFileSync(path.join(__dirname, '..', 'app', p), 'utf8');
const senzaCommenti = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('la scelta esiste, e spenta di suo', () => {
  it('c\'e un interruttore al momento di creare la stanza', () => {
    const c = app('components/CreateRoomSheet.js');
    expect(c).toMatch(/const \[diretta, setDiretta\] = useState\(false\)/);
    expect(senzaCommenti(c)).toContain("L('directRoomTitle')");
    expect(italiano.directRoomTitle).toContain('Stanza Diretta');
  });

  it('dice per intero cosa si spegne, non in fondo in piccolo', () => {
    // Una promessa di riservatezza che nasconde il suo prezzo e una
    // promessa che si ritorce contro. Qui il prezzo e la traduzione,
    // cioe il motivo per cui quasi tutti aprono questo programma.
    // b.139 — il testo non e piu nel componente: e nei 15 pacchetti lingua,
    // e nel JSX c'e la chiave. Si prova che la chiave sia usata E che il
    // pacchetto italiano dica ancora ogni singola cosa che si perde: una
    // guardia che smette di leggere il testo vero non guarda piu niente.
    const c = senzaCommenti(app('components/CreateRoomSheet.js'));
    expect(c, 'la scheda deve mostrare il prezzo').toContain("L('directRoomCostBody')");
    expect(c, 'e anche cosa resta').toContain("L('directRoomCostBody2')");
    for (const cosa of ['traduzione', 'trascrizione', 'lettura ad alta voce', 'archivio']) {
      expect(italiano.directRoomCostBody, `deve dire che si perde: ${cosa}`).toMatch(new RegExp(cosa, 'i'));
    }
    expect(italiano.directRoomCostBody2, 'e anche cosa RESTA, altrimenti sembra che si spenga tutto')
      .toContain('Resta la chat scritta');
  });
});

describe('la scelta diventa effettiva', () => {
  // b.123 — la riga non e piu qui: e dentro `applicaPoliticaStanza`,
  // la porta unica da cui passano tutti e tre gli ingressi. Prima era
  // scritta in tre punti e a `rejoinRoom` mancava: rientrando, una
  // stanza Diretta ricominciava a passare dai server.
  it('creare una Stanza Diretta accende la modalita', () => {
    // b.605 — la creazione e' in lib/stanze/creaEPubblica.js; la politica
    // le arriva come argomento da page.js, che resta chi la definisce.
    const c = senzaCommenti(app('lib/stanze/creaEPubblica.js'));
    expect(c, 'la creazione applica la politica unica')
      .toMatch(/applicaPoliticaStanza\?\.\(\{ \.\.\.room, diretta: room\?\.diretta \?\? roomConfig\.diretta \}\)/);
    const p = senzaCommenti(app('page.js'));
    expect(p, 'page.js passa la sua politica alla funzione').toMatch(/creaEPubblicaStanza\(\{[\s\S]{0,200}applicaPoliticaStanza,/);
    // b.139 — il ternario e diventato `modalitaDiStanza()`, la stessa
    // funzione che usano il cancello e le rotte: la traduzione da stanza a
    // modalita si fa in un posto solo.
    expect(p, 'e la politica legge diretta dalla stanza')
      .toContain('cambiaModalitaSessione(modalitaDiStanza(room))');
    expect(modalitaDiStanza({ diretta: true })).toBe('direct');
    expect(modalitaDiStanza({ diretta: false })).toBe('translate');
  });

  it('si accende PRIMA di qualunque altra cosa', () => {
    // Da quell'istante il cancello davanti a fetch deve gia sapere
    // quali rotte lasciar passare. Si guarda il CODICE, non i commenti:
    // la vecchia forma della riga e citata qui sopra per spiegarla.
    const p = senzaCommenti(app('lib/stanze/creaEPubblica.js'));   // b.605
    const accende = p.indexOf("applicaPoliticaStanza?.({ ...room");
    const pubblica = p.indexOf("await fetchImpl('/api/mondo'");
    expect(accende).toBeGreaterThan(0);
    expect(accende).toBeLessThan(pubblica);
  });

  it('il ref e il cancello si aggiornano insieme', () => {
    const p = app('page.js');
    expect(p).toMatch(/sessionModeRef\.current = impostaModalita\(modo\)/);
  });
});

describe('chi entra da un invito la eredita', () => {
  it('la scelta viaggia con la stanza, non resta sul telefono dell\'host', () => {
    // Altrimenti chi entra dopo continuerebbe a mandare la propria voce
    // alla nuvola dentro una stanza che si presenta come riservata.
    expect(app('lib/store.js')).toMatch(/diretta: !!diretta/);
    expect(app('lib/roomActions.js')).toMatch(/hostEmail \|\| null, !!diretta/);
    expect(app('api/room/route.js')).toMatch(/diretta: body\.diretta/);
    expect(app('hooks/useRoomPolling.js')).toMatch(/diretta: !!diretta/);
  });

  it('entrando si legge dalla stanza, non si indovina', () => {
    const p = senzaCommenti(app('page.js'));
    // b.123 — vale per l'ingresso da invito E per il rientro: prima
    // erano due percorsi diversi e solo uno leggeva `diretta`.
    expect(p).toContain('cambiaModalitaSessione(modalitaDiStanza(room))');
    const i = p.indexOf('async function rejoinRoom');
    expect(p.slice(i, i + 700), 'anche rientrando').toMatch(/applicaPoliticaStanza\(room\)/);
  });
});

describe('non si eredita fra una conversazione e l\'altra', () => {
  it('uscendo si torna alla modalita normale', () => {
    // Senza, la traduzione risulterebbe rotta nella conversazione dopo,
    // e senza un motivo visibile.
    const p = senzaCommenti(app('page.js'));
    const dentro = p.slice(p.indexOf('function leaveRoomTemporary'), p.indexOf('function leaveRoomTemporary') + 600);
    expect(dentro).toMatch(/cambiaModalitaSessione\('translate'\)/);
  });

  it('e lo stesso chiudendo e salvando', () => {
    const p = senzaCommenti(app('page.js'));
    const dentro = p.slice(p.indexOf('async function endChatAndSave'), p.indexOf('async function endChatAndSave') + 400);
    expect(dentro).toMatch(/cambiaModalitaSessione\('translate'\)/);
  });
});

describe('dentro la stanza si vede sempre', () => {
  it('c\'e una fascia che lo dice, non un simbolino', () => {
    // Se la traduzione non funziona e non si capisce perche, si pensa a
    // un guasto. Qui c'e scritto che e una scelta.
    const r = app('components/RoomView.js');
    // b.139 — `roomInfo?.diretta` e diventato `eDiretta(roomInfo)`: la
    // fascia si accende dalla stessa regola che usa il server.
    expect(r).toContain('eDiretta(roomInfo)');
    expect(eDiretta({ diretta: true })).toBe(true);
    // b.139 — la fascia c'e ancora ma parla la lingua di chi guarda: nel
    // componente ci sono le chiavi, il testo sta nei pacchetti.
    expect(senzaCommenti(r)).toContain("L('directRoomBannerTitle')");
    expect(senzaCommenti(r)).toContain("L('directRoomBannerBody')");
    expect(italiano.directRoomBannerTitle).toContain('Stanza Diretta');
    expect(italiano.directRoomBannerBody, 'ripete cosa manca, non solo cosa si guadagna')
      .toMatch(/non c.è traduzione/);
  });
});
