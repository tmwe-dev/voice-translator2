// ═══════════════════════════════════════════════════════════════
// I MARGINI LATERALI SONO UNO SOLO — b.472
//
// Collaudo di Luca: «non stai rispettando le regole e i margini, hai tolto
// i margini orizzontali. Perche non fai le verifiche sempre prima?».
//
// Aveva ragione due volte. Nella chat c'erano QUATTRO rientri diversi
// incolonnati — dieci, dodici, quattordici e venti — e tre elementi uno
// sotto l'altro con tre margini diversi si vedono, anche quando chi guarda
// non sa dire cosa non torna.
//
// E la seconda volta ha ragione sul metodo: la verifica non deve dipendere
// dal fatto che me ne ricordi. Questa prova la fa al posto mio, e diventa
// rossa la prossima volta che qualcuno scrive un margine suo.
//
// Il valore e VENTI: quello della Home (b.451), che viene dal template —
// il quale da il 4,1% di rientro, cioe sedici su un telefono da 390. Venti
// e un filo piu largo, e si sbaglia dalla parte del respiro.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');

describe('i margini laterali sono uno solo, in tutta la chat', () => {
  it('la testata della stanza rientra di venti', () => {
    expect(leggi('app/components/RoomHeader.js')).toMatch(/padding:'8px 20px'/);
  });

  it('la riga di chi c\'e rientra di venti', () => {
    expect(leggi('app/components/RoomView.js')).toMatch(/padding: '8px 20px 2px'/);
  });

  it('il modulo del testo rientra di venti', () => {
    expect(leggi('app/components/RoomView.js'))
      .toMatch(/padding: '8px 20px calc\(10px \+ env\(safe-area-inset-bottom\)\)'/);
  });

  it('e le bolle dei messaggi pure', () => {
    expect(leggi('app/lib/styles.js')).toMatch(/chatArea: \{[^}]*padding:'14px 20px 96px'/);
  });

  it('la Home non e cambiata: venti anche li', () => {
    expect(leggi('app/components/HomeView.js')).toMatch(/paddingLeft: 20, paddingRight: 20/);
  });
});
