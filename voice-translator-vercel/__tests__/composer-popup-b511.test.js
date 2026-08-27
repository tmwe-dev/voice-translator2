// b.511 — «dentro stanze lascia dietro una icona una popup per
// commentare. cosi la interfaccia e pulita. lascia solo cuore e altri
// tasti veloci utili fuori» (Luca): il modulo per scrivere un commento
// (soprannome + testo + invia) non sta piu sempre aperto in fondo alla
// discussione; sta dietro un'icona, e si apre in una popup dal basso.
// I tasti veloci per singolo commento (cuore, traduci, segnala, blocca)
// restano fuori, dove erano.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

describe('b.511 -> b.529 — il modulo per commentare, senza popup', () => {
  // b.546 — ROSSA PRE-ESISTENTE, dichiarata. b.511 aveva messo il modulo
  // dei commenti dentro una popup che si apriva da un'icona, e questa
  // prova difendeva proprio quella. Poi l'ordine di Luca in b.529:
  // «la popup che apri devi eliminarla e inserire in basso direttamente
  // campo testo e pulsanti. inutile ripetere in basso il nome chat».
  // La popup e' stata tolta, e da allora la prova cercava uno stato che
  // non esiste piu: difendeva la forma di ieri contro un ordine di oggi.
  // Cio che b.511 voleva davvero — che si possa commentare, e che il
  // modulo non rubi la pagina — vale ancora: la prova segue quello.
  const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');
  const disc = leggi('app/components/MondoDiscussioni.js');

  it('si commenta da un campo in fondo, non da una finestra che si apre', () => {
    expect(disc, 'il campo per scrivere c\'e').toMatch(/textarea/);
    // b.546 — e lo stato che la apriva e' uscito con lei: era rimasto
    // dichiarato e mai letto, coda di b.529 eseguito a meta.
    expect(disc, 'e non c\'e piu la popup').not.toMatch(/const \[composerAperto/);
  });

  it('e non si ripete il nome della chat sopra il campo (b.529)', () => {
    const fondo = disc.slice(disc.lastIndexOf('textarea') - 2000);
    expect(fondo).not.toMatch(/placeholder=\{L\('yourNickname'\)\}/);
  });
});
