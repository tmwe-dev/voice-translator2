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

import italiano from '../app/lib/locales/it.js';

const APP = path.join(__dirname, '..', 'app');
const leggi = (p) => fs.readFileSync(path.join(APP, p), 'utf8');

// Un difetto CITATO in un commento non e quel difetto: le frasi italiane
// sopravvivono nelle spiegazioni, e un test che le cerca trova la propria.
const senzaCommenti = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const sheet = leggi('components/CreateRoomSheet.js');
const pagina = leggi('page.js');
const rotta = leggi('api/mondo/route.js');
const elenco = leggi('components/MondoView.js');

describe('creazione stanza Community', () => {
  it('il nome e obbligatorio: senza, il pulsante non parte', () => {
    // b.139 — prima si cercavano le frasi italiane dentro il componente.
    // Ora quelle frasi vivono nei pacchetti lingua, e nel componente c'e la
    // chiave: si controlla la chiave qui e il TESTO nel pacchetto italiano,
    // cosi la guardia resta intera invece di spegnersi con la traduzione.
    expect(senzaCommenti(sheet), 'serve un campo nome').toContain("L('roomNameOrTopic')");
    expect(italiano.roomNameOrTopic, 'la chiave deve avere un testo').toContain('Nome o argomento');
    expect(sheet, 'e una soglia minima').toMatch(/nomeValido/);
    expect(sheet, 'il pulsante deve essere bloccato').toMatch(/disabled=\{creating \|\| !nomeValido\}/);
    expect(senzaCommenti(sheet), 'e deve dire perche').toContain("L('giveRoomAName')");
    expect(italiano.giveRoomAName, 'la chiave deve avere un testo').toContain('Dai un nome alla stanza');
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
    // b.139-bis — il predicato non e piu scritto qui ne li: era la stessa
    // regola in due punti, con due segni opposti (`!== 'private'` sul
    // client, `=== 'private'` sul server), e concordavano per fortuna.
    // Ora tutti e due chiedono `vaInVetrina()` a decisioni.js. Il
    // controllo non cerca piu la frase: cerca che nessuno dei due se la
    // sia riscritta per conto suo.
    expect(pagina, 'il client chiede la regola al file unico').toContain('vaInVetrina(');
    expect(rotta, 'e il server pure').toContain('vaInVetrina(');
    // La citazione si toglie prima di cercare: il commento che spiega la
    // correzione contiene la frase corretta, e un controllo ingenuo
    // troverebbe la propria spiegazione (trappola gia costata tempo).
    expect(senzaCommenti(pagina), 'il client non riscrive il confronto').not.toContain("roomType !== 'private'");
    expect(senzaCommenti(rotta), 'e il server nemmeno').not.toContain("tipo === 'private'");
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
