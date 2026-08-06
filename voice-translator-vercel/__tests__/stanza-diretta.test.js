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

const app = (p) => fs.readFileSync(path.join(__dirname, '..', 'app', p), 'utf8');
const senzaCommenti = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('la scelta esiste, e spenta di suo', () => {
  it('c\'e un interruttore al momento di creare la stanza', () => {
    const c = app('components/CreateRoomSheet.js');
    expect(c).toMatch(/const \[diretta, setDiretta\] = useState\(false\)/);
    expect(c).toMatch(/Stanza Diretta/);
  });

  it('dice per intero cosa si spegne, non in fondo in piccolo', () => {
    // Una promessa di riservatezza che nasconde il suo prezzo e una
    // promessa che si ritorce contro. Qui il prezzo e la traduzione,
    // cioe il motivo per cui quasi tutti aprono questo programma.
    const c = app('components/CreateRoomSheet.js');
    for (const cosa of ['traduzione', 'trascrizione', 'lettura ad alta voce', 'archivio']) {
      expect(c, `deve dire che si perde: ${cosa}`).toMatch(new RegExp(cosa, 'i'));
    }
    expect(c, 'e anche cosa RESTA, altrimenti sembra che si spenga tutto')
      .toMatch(/Resta la chat scritta/);
  });
});

describe('la scelta diventa effettiva', () => {
  it('creare una Stanza Diretta accende la modalita', () => {
    const p = senzaCommenti(app('page.js'));
    expect(p).toMatch(/cambiaModalitaSessione\(roomConfig\.diretta \? 'direct' : 'translate'\)/);
  });

  it('si accende PRIMA di qualunque altra cosa', () => {
    // Da quell'istante il cancello davanti a fetch deve gia sapere
    // quali rotte lasciar passare.
    const p = app('page.js');
    const accende = p.indexOf("cambiaModalitaSessione(roomConfig.diretta");
    const pubblica = p.indexOf("await fetch('/api/mondo'");
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
    expect(p).toMatch(/cambiaModalitaSessione\(room\?\.diretta \? 'direct' : 'translate'\)/);
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
    expect(r).toMatch(/roomInfo\?\.diretta &&/);
    expect(r).toMatch(/Stanza Diretta\./);
    expect(r, 'ripete cosa manca, non solo cosa si guadagna')
      .toMatch(/non c&apos;è traduzione/);
  });
});
