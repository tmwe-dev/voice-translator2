// ═══════════════════════════════════════════════════════════════
// GUARDIA SULLE STANZE COMMUNITY
//
// Nata da un collaudo dal vivo: compilando il modulo di creazione con
// tipo "Protetto", categoria e 20 partecipanti, nasceva una normalissima
// chat a due e Community restava "Nessuna stanza al momento".
//
// La causa non era nel modulo ne nella rotta: era il collegamento. In
// page.js si passavano avanti solo lingua, modalita e descrizione, e la
// POST di /api/mondo non la chiamava nessuno.
//
// Un test sugli orfani non poteva accorgersene: i file erano tutti
// importati. A mancare era il FILO fra loro.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const APP = path.join(__dirname, '..', 'app');
const leggi = (p) => fs.readFileSync(path.join(APP, p), 'utf8');

const sheet = leggi('components/CreateRoomSheet.js');
const pagina = leggi('page.js');
const rotta = leggi('api/mondo/route.js');
const elenco = leggi('components/MondoView.js');

describe('creazione stanza Community', () => {
  it('il nome e obbligatorio: senza, il pulsante non parte', () => {
    expect(sheet, 'serve un campo nome').toMatch(/Nome o argomento/);
    expect(sheet, 'e una soglia minima').toMatch(/nomeValido/);
    expect(sheet, 'il pulsante deve essere bloccato').toMatch(/disabled=\{creating \|\| !nomeValido\}/);
    expect(sheet, 'e deve dire perche').toMatch(/Dai un nome alla stanza/);
  });

  it('handleCreate non chiama onCreate con un nome vuoto', () => {
    expect(sheet).toMatch(/if \(!nomeValido\) return;/);
  });

  it('la stanza viene davvero pubblicata in Community', () => {
    // Il buco originale: si creava la stanza e ci si fermava li.
    expect(pagina, 'page.js deve chiamare /api/mondo').toMatch(/fetch\('\/api\/mondo'/);
    expect(pagina).toMatch(/method: 'POST'/);
  });

  it('nessun campo del modulo viene piu buttato via', () => {
    // Prima arrivavano solo lang, mode e description.
    for (const campo of ['nome', 'roomType', 'categoria', 'maxPartecipanti', 'hostLang']) {
      expect(pagina, `page.js non manda "${campo}" a /api/mondo`).toMatch(new RegExp(`${campo}:`));
    }
  });

  it('una stanza privata non finisce in vetrina', () => {
    expect(pagina, 'il client non la pubblica').toMatch(/roomConfig\.roomType !== 'private'/);
    expect(rotta, 'e il server la rifiuta comunque').toMatch(/tipo === 'private'/);
  });

  it('la rotta conserva i campi invece di ignorarli', () => {
    for (const campo of ['nome', 'roomType', 'categoria', 'hostLang', 'maxPartecipanti', 'suApprovazione']) {
      expect(rotta, `/api/mondo non salva "${campo}"`).toMatch(new RegExp(campo));
    }
  });

  it('la rotta rifiuta un nome troppo corto', () => {
    expect(rotta).toMatch(/nomePulito\.length < 3/);
  });

  it('l\'elenco mostra il nome della stanza, non solo chi la ospita', () => {
    expect(elenco).toMatch(/room\.nome \|\| room\.host/);
    expect(elenco, 'e la ricerca lo deve trovare').toMatch(/r\.nome\?\.toLowerCase\(\)/);
  });

  it('l\'elenco mostra bandiera e lingua dell\'host', () => {
    expect(elenco).toMatch(/getLangFlag\(room\.hostLang \|\| room\.lang\)/);
    expect(elenco).toMatch(/getLangName\(room\.hostLang \|\| room\.lang\)/);
  });

  it('si vede PRIMA di entrare se la stanza e su approvazione', () => {
    // Altrimenti chi tocca crede che la stanza non risponda.
    expect(elenco).toMatch(/room\.suApprovazione/);
    // b.138 — l'avviso c'e ancora, ma non e piu una scritta italiana nel
    // JSX: passa da L('onApproval'), come tutto il resto della scheda.
    expect(elenco).toMatch(/L\('onApproval'\)/);
  });
});
