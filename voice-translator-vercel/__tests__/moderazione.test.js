// ═══════════════════════════════════════════════════════════════
// GUARDIA SULLA MODERAZIONE DELLE STANZE
//
// Tre cose che devono restare vere, altrimenti "Protetto" torna a essere
// un'etichetta e il blocco una finzione:
//
//   1. il controllo avviene PRIMA di entrare, non dopo
//   2. ammettere, rifiutare e bloccare li puo fare SOLO l'host, e solo
//      dimostrandolo con il token di sessione della stanza
//   3. un nome e lo stesso nome anche con le maiuscole e gli spazi
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { normalizza, SOGLIA_SEGNALAZIONI } from '../app/lib/moderazione.js';

const APP = path.join(__dirname, '..', 'app');
const leggi = (p) => fs.readFileSync(path.join(APP, p), 'utf8');

describe('normalizzazione dei nomi', () => {
  it('lo stesso nome scritto in modi diversi e la stessa persona', () => {
    expect(normalizza('Marco')).toBe(normalizza('  marco '));
    expect(normalizza('MARCO')).toBe('marco');
  });

  it('un nome vuoto non diventa un bersaglio valido', () => {
    expect(normalizza('')).toBe('');
    expect(normalizza(null)).toBe('');
    expect(normalizza(undefined)).toBe('');
  });

  it('non si puo sfondare il limite di lunghezza', () => {
    expect(normalizza('x'.repeat(200))).toHaveLength(40);
  });
});

describe('regole della moderazione', () => {
  const rotta = leggi('api/moderazione/route.js');
  const azioni = leggi('lib/roomActions.js');
  const lib = leggi('lib/moderazione.js');

  it('il controllo avviene prima di far entrare, non dopo', () => {
    const posizioneControllo = azioni.indexOf('puoEntrare');
    const posizioneIngresso = azioni.indexOf('await joinRoom(');
    expect(posizioneControllo).toBeGreaterThan(-1);
    expect(posizioneControllo, 'si controlla DOPO essere entrati: inutile')
      .toBeLessThan(posizioneIngresso);
  });

  it('ammettere, rifiutare e bloccare passano da soloHost', () => {
    for (const azione of ['ammetti', 'rifiuta', 'blocca', 'sblocca', 'richieste']) {
      const blocco = rotta.slice(rotta.indexOf(`case '${azione}'`), rotta.indexOf(`case '${azione}'`) + 420);
      expect(blocco, `l'azione "${azione}" non verifica che tu sia l'host`).toMatch(/soloHost/);
    }
  });

  it('il nome scritto nel corpo non basta a farti host', () => {
    // soloHost parte dal token, non da quello che hai scritto.
    expect(rotta).toMatch(/async function soloHost\(roomSessionToken, roomId\)/);
    expect(rotta).toMatch(/verifyRoomSession/);
  });

  it('non ci si puo bloccare da soli, chiudendo la propria stanza', () => {
    expect(rotta).toMatch(/Non puoi bloccare te stesso/);
  });

  it('segnalare richiede di essere dentro la stanza', () => {
    const blocco = rotta.slice(rotta.indexOf("case 'segnala'"), rotta.indexOf("case 'segnala'") + 420);
    expect(blocco).toMatch(/chiSei/);
    expect(blocco).toMatch(/Sessione non valida/);
  });

  it('una persona puo segnalarne un\'altra una volta sola', () => {
    // Senza questo, dieci tocchi affossano chiunque non piaccia.
    expect(lib).toMatch(/giaSegnalato/);
    expect(lib).toMatch(/'NX'/);
  });

  it('non si puo segnalare se stessi', () => {
    expect(lib).toMatch(/n === da/);
  });

  it('la soglia esiste ed e un numero sensato', () => {
    expect(SOGLIA_SEGNALAZIONI).toBeGreaterThan(1);
    expect(SOGLIA_SEGNALAZIONI).toBeLessThan(50);
  });

  it('bloccare toglie anche dalla coda di chi bussa', () => {
    const blocco = lib.slice(lib.indexOf('export async function blocca'), lib.indexOf('export async function sblocca'));
    expect(blocco, 'un bloccato resterebbe in attesa per sempre').toMatch(/SREM/);
  });

  it('l\'host non deve bussare alla propria porta', () => {
    const blocco = lib.slice(lib.indexOf('export async function puoEntrare'));
    expect(blocco).toMatch(/eHost/);
  });
});

describe('il client racconta l\'attesa invece di dire "non funziona"', () => {
  const hook = leggi('hooks/useRoomPolling.js');

  it('un 403 di moderazione non diventa "Room not found"', () => {
    expect(hook).toMatch(/res\.status === 403/);
    expect(hook).toMatch(/Hai bussato/);
    expect(hook).toMatch(/Non puoi entrare in questa stanza/);
  });
});

describe('le regole della stanza arrivano dove servono', () => {
  it('/api/mondo le scrive quando la stanza viene pubblicata', () => {
    expect(leggi('api/mondo/route.js')).toMatch(/salvaRegole/);
  });

  it('il pannello e montato e lo vede chi ospita', () => {
    const pagina = leggi('page.js');
    expect(pagina).toMatch(/PannelloModerazione/);
    expect(pagina).toMatch(/isHostRef/);
  });
});
