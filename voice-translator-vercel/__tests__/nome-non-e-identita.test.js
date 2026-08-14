// ═══════════════════════════════════════════════════════════════
// IL NOME NON E UN'IDENTITA (b.123)
//
// Due buchi trovati da un audit esterno, verificati riga per riga e
// confermati. Non li avevo visti io, in nessuno dei giri precedenti, e
// vale la pena dire perche: cercavo difetti dentro i singoli file. Qui
// ogni file, preso da solo, sembra ragionevole. E la CATENA fra i due
// che apre la porta.
//
// ── 1. L'ELENCO SI OTTENEVA CON UN NOME ──
//
// In /api/conversation, azione `list`:
//
//     if (!resolvedName) resolvedName = sanitizeName(userName);
//     const convs = await getUserConversations(resolvedName);
//
// Nessun gettone. Bastava mandare `userName: "Mario"` e si riceveva
// l'elenco delle conversazioni di Mario, con i loro identificativi.
//
// ── 2. IL GETTONE DI STANZA NON ERA LEGATO ALLA STANZA ──
//
// Nella GET c'era scritto, come scelta consapevole:
//
//     "verify the token is valid but don't check room ID
//      (the conversation may be from an archived room)"
//
// Buon motivo — la stanza non esiste piu — e porta aperta lo stesso,
// perche l'unico controllo rimasto era `m.name === resolvedName`. E un
// gettone di stanza lo ottiene chiunque: si crea una stanza QUALSIASI
// e ci si sceglie il nome che si vuole.
//
//     so che Mario ha parlato in una conversazione
//       -> chiedo la lista di Mario           (buco 1)
//       -> mi creo una stanza, mi chiamo "Mario"
//       -> il gettone non viene confrontato   (buco 2)
//       -> leggo la conversazione di Mario
//
// ── 3. E IL RIASSUNTO NON CHIEDEVA SE C'ERI ──
//
// /api/summary chiedeva "sei autenticato?" e non "sei stato in QUESTA
// conversazione?". Poi costruiva la trascrizione integrale e la
// mandava al modello. Da solo bisognava indovinare un identificativo;
// col buco 1 non c'era piu niente da indovinare.
//
// ── COSA LO CHIUDE ──
//
// In `saveConversation`: `const id = roomId.toUpperCase()`. L'id della
// conversazione E il codice della stanza. Quindi il gettone si puo
// legare: deve essere nato PER QUELLA stanza. Senza migrare un dato.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');
const senzaCommenti = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('l\'elenco dell\'archivio non si ottiene con un nome', () => {
  const c = () => senzaCommenti(leggi('app/api/conversation/route.js'));

  it('il ripiego sul nome non c\'e piu', () => {
    expect(c(), 'era la riga che regalava gli identificativi')
      .not.toMatch(/resolvedName = sanitizeName\(userName\)/);
  });

  it('senza gettone si viene respinti prima di leggere qualsiasi cosa', () => {
    const s = c();
    const i = s.indexOf("action === 'list'");
    const corpo = s.slice(i, i + 700);
    expect(corpo).toMatch(/if \(!userToken\)[\s\S]{0,240}status: 401/);
    expect(corpo.indexOf('getUserConversations'),
      'il rifiuto deve venire prima della lettura').toBeGreaterThan(corpo.indexOf('if (!userToken)'));
  });

  it('e il nome si ricava dalla sessione, non da cio che si dichiara', () => {
    const s = c();
    const i = s.indexOf("action === 'list'");
    expect(s.slice(i, i + 700)).toMatch(/await getSession\(userToken\)/);
  });

  it('nemmeno il client lo manda piu, perche sarebbe una richiesta gia persa', () => {
    const p = senzaCommenti(leggi('app/page.js'));
    expect(p).not.toMatch(/listBody\.userName = prefs\.name/);
    expect(p, 'senza account non si chiede niente al server').toMatch(/if \(!token\) \{ setConvHistory\(\[\]\)/);
  });

  it('e all\'ospite si spiega dov\'e la sua cronologia, invece di mostrargli il vuoto', () => {
    // Un elenco vuoto senza spiegazione sembra "le mie conversazioni
    // sono sparite". Sono sul suo telefono, ed e giusto dirlo.
    const h = leggi('app/components/HistoryView.js');
    expect(h).toMatch(/archivioSoloLocale/);
    expect(h).toMatch(/archiveLocalDesc/);
  });
});

describe('un gettone di stanza vale solo per la sua stanza', () => {
  const c = () => senzaCommenti(leggi('app/api/conversation/route.js'));

  it('la conversazione si carica PRIMA di decidere chi sei', () => {
    // Serve per avere con cosa confrontare il gettone: era questo il
    // motivo per cui il controllo mancava.
    const s = c();
    expect(s.indexOf('const conv = await getConversation(id)'),
      'prima la conversazione').toBeLessThan(s.indexOf('verifyRoomSession(rst)'));
  });

  it('e il gettone si confronta con l\'identificativo della conversazione', () => {
    expect(c()).toMatch(/session\.roomId[\s\S]{0,80}===[\s\S]{0,80}conv\.id/);
  });

  it('la vecchia scelta di NON confrontare non e tornata', () => {
    // Si guarda il CODICE, non la citazione: quella frase compare nel
    // commento che spiega il difetto, ed e giusto che ci resti. E la
    // terza volta in questa base di codice che ci inciampo — un difetto
    // citato non e quel difetto.
    expect(c(), 'nel codice non deve esserci un ramo che salta il confronto')
      .not.toMatch(/don't check room ID/);
    const s = c();
    const i = s.indexOf('verifyRoomSession(rst)');
    expect(s.slice(i, i + 260), 'ogni uso del gettone di stanza passa dal confronto')
      .toMatch(/session\.roomId/);
  });

  it('il controllo sui partecipanti resta come seconda rete', () => {
    // Da solo non bastava. Insieme al vincolo sopra, si tengono.
    expect(c()).toMatch(/conv\.members\?\.some\(m => m\.name === resolvedName\)/);
  });

  it('e l\'id di una conversazione E il codice della stanza: e cio che rende possibile il confronto', () => {
    const store = leggi('app/lib/store.js');
    const i = store.indexOf('export async function saveConversation');
    expect(store.slice(i, i + 120)).toMatch(/const id = roomId\.toUpperCase\(\)/);
  });
});

describe('il riassunto chiede se c\'eri', () => {
  const s = () => senzaCommenti(leggi('app/api/summary/route.js'));

  it('esiste il controllo di appartenenza', () => {
    expect(s()).toMatch(/const eraPresente = conv\.members\?\.some/);
    expect(s()).toMatch(/status: 403/);
  });

  it('e viene PRIMA che si legga anche un solo messaggio', () => {
    // Il riassunto e l'unica risposta che rivelerebbe il contenuto in
    // chiaro: il controllo non puo stare dopo.
    const t = s();
    const iControllo = t.indexOf('eraPresente');
    const iTrascrizione = t.indexOf('conv.messages');
    expect(iTrascrizione, 'la trascrizione deve esistere').toBeGreaterThan(-1);
    expect(iControllo, 'il controllo viene prima').toBeLessThan(iTrascrizione);
  });

  it('e il nome viene dalla sessione verificata, non dal corpo', () => {
    const t = s();
    expect(t).toMatch(/const nomeUtente = session\.name \|\| session\.email/);
  });

  it('un rifiuto lascia una traccia', () => {
    // Un tentativo di leggere la conversazione di un altro e esattamente
    // il tipo di cosa che si vuole ritrovare nei registri.
    expect(s()).toMatch(/log\.warn\([\s\S]{0,90}negato/);
  });
});
