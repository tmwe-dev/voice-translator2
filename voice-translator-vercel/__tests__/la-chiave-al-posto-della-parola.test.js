// ═══════════════════════════════════════════════════════════════
// LA CHIAVE AL POSTO DELLA PAROLA (b.139-bis)
//
// Terzo e ultimo giro sull'interfaccia, dopo `niente-stringhe-cablate`
// (b.138) e `ultime-stringhe-cablate` (b.139). Quei due avevano preso
// le schermate intere; qui restavano le briciole, e una briciola in una
// videochiamata la si guarda per tutta la chiamata.
//
// ── IL DIFETTO CHE NESSUNO POTEVA VEDERE LEGGENDO IL CODICE ──
//
// In quattro punti era scritto cosi:
//
//     {L('callIncoming') || 'ti sta chiamando'}
//     {L('exit') || 'Esci'}
//     aria-label={L('send') || 'Send message'}
//     {L('starterPack')} — €0.90
//
// Sembra prudente: "prendi la traduzione, e se non c'e usa questa".
// Non funziona, e non funziona nel modo peggiore. `t()` non torna
// `undefined` quando la chiave manca: torna LA CHIAVE STESSA, che e una
// stringa piena. Quindi `||` non scatta mai, il ripiego e codice morto,
// e sullo schermo compare la parola `callIncoming`.
//
// Le quattro chiavi non esistevano in nessuno dei quindici pacchetti.
// Cioe: chiunque ricevesse una chiamata leggeva
//
//     Marco callIncoming
//
// e chi apriva il menu della stanza vedeva un pulsante scritto `exit`.
// In TUTTE le lingue, italiano compreso — il ripiego che avrebbe dovuto
// salvare la situazione non e mai stato eseguito nemmeno una volta.
//
// I test precedenti non potevano trovarlo: cercavano frasi italiane
// rimaste nel codice, e qui la frase italiana c'era ma era irraggiungibile.
// Il controllo giusto e un altro, e sta qui sotto: prendere OGNI chiave
// invocata nel codice e verificare che esista davvero nei pacchetti.
//
// ── E LE DATE, CHE NON SONO PAROLE ──
//
// `toLocaleString('it-IT')` era scritto a mano nell'archivio e nel
// report. Un coreano con l'interfaccia in coreano vedeva le proprie
// conversazioni datate "12 nov 2025, 14:30". Non e una stringa cablata:
// e una LINGUA cablata, e nessuna ricerca di frasi italiane la trova.
// Ora AppContext espone `uiLang` e le date la seguono.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const RADICE = path.resolve(__dirname, '..');
const CARTELLA_LOCALI = path.join(RADICE, 'app/lib/locales');

// b.370 — LE LINGUE NON SI SCRIVONO PIU A MANO QUI.
// Questa lista diceva quindici. Le lingue sono TRENTOTTO, e le altre
// ventitre non le controllava nessuno: e cosi che sedici pacchetti sono
// arrivati ad avere un sesto delle parole senza che una prova fiatasse.
// Luca l'ha scoperto aprendo l'app in thailandese.
// Adesso la lista si legge dalla cartella: una lingua nuova entra nelle
// prove il giorno che nasce, senza che nessuno si ricordi di aggiungerla.
const LINGUE = fs.readdirSync(CARTELLA_LOCALI)
  .filter((f) => f.endsWith('.js'))
  .map((f) => f.replace('.js', ''))
  .sort();

function leggiPacchetto(lingua) {
  const sorgente = fs.readFileSync(path.join(CARTELLA_LOCALI, `${lingua}.js`), 'utf8');
  const m = sorgente.match(/^const locale_\w+ = (\{[\s\S]*\});\s*$/m);
  if (!m) throw new Error(`formato inatteso in ${lingua}.js`);
  return JSON.parse(m[1]);
}

const PACCHETTI = Object.fromEntries(LINGUE.map((l) => [l, leggiPacchetto(l)]));

const leggi = (relativo) => fs.readFileSync(path.join(RADICE, relativo), 'utf8');

/**
 * Toglie i commenti prima di cercare.
 *
 * Trappola gia costata tempo quattro volte in questa base di codice:
 * ogni correzione porta con se un commento che CITA la frase tolta, e un
 * controllo ingenuo trova la citazione e crede che il difetto sia ancora
 * li. Si toglie la citazione, non la spiegazione.
 */
function senzaCommenti(sorgente) {
  return sorgente
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((r) => (/^\s*(\/\/|\*)/.test(r) ? '' : r.replace(/\s\/\/.*$/, '')))
    .join('\n');
}

/** Tutti i file dell'applicazione, escluso cio che l'utente non legge mai. */
function fileApplicazione() {
  const ESCLUSI = [
    /\/locales\//,          // sono i pacchetti stessi
    /\/debug\//,            // strumenti interni
    /\/testcenter\//,       // banco di prova
    /AdminWallet/,          // pannello amministrativo
    /\/sesamo\//,           // pannello amministrativo
    /\/startrek\//,         // pannello amministrativo
  ];
  const trovati = [];
  (function scendi(dir) {
    for (const voce of fs.readdirSync(dir, { withFileTypes: true })) {
      if (voce.name === 'node_modules' || voce.name.startsWith('.')) continue;
      const p = path.join(dir, voce.name);
      if (voce.isDirectory()) scendi(p);
      else if (/\.jsx?$/.test(voce.name)) {
        const rel = path.relative(RADICE, p);
        if (!ESCLUSI.some((r) => r.test(rel))) trovati.push(rel);
      }
    }
  })(path.join(RADICE, 'app'));
  return trovati;
}

const FILE = fileApplicazione();

// ═══════════════════════════════════════════════════════════════
describe('nessuna chiave invocata manca dai pacchetti', () => {

  // Le quattro funzioni con cui si traduce in questo programma:
  // L() dentro il contesto, tI() in JoinView, tFuori() negli hook e nei
  // componenti che vivono sopra AppProvider, T() nelle pagine che stanno
  // fuori del tutto (404, errore di radice, /account).
  const INVOCAZIONI = /\b(?:L|tI|tFuori|T)\(\s*'([A-Za-z][A-Za-z0-9_]*)'\s*\)/g;

  function chiaviInvocate() {
    const mappa = new Map();
    for (const f of FILE) {
      const sorgente = senzaCommenti(leggi(f));
      for (const m of sorgente.matchAll(INVOCAZIONI)) {
        if (!mappa.has(m[1])) mappa.set(m[1], []);
        if (!mappa.get(m[1]).includes(f)) mappa.get(m[1]).push(f);
      }
    }
    return mappa;
  }

  it('se ne invocano parecchie, quindi il controllo ha senso', () => {
    // Se questa scendesse a zero vorrebbe dire che l'espressione non
    // trova piu niente, e i controlli sotto passerebbero per finta.
    expect(chiaviInvocate().size).toBeGreaterThan(300);
  });

  it('e nessuna manca dai pacchetti', () => {
    // Il difetto: `L('callIncoming')` con la chiave inesistente non
    // stampa il ripiego, stampa `callIncoming`. Erano quattro:
    // callIncoming, exit, send, starterPack.
    const mancanti = [];
    for (const [chiave, dove] of chiaviInvocate()) {
      if (PACCHETTI.it[chiave] === undefined) mancanti.push(`${chiave} (${dove.join(', ')})`);
    }
    expect(mancanti).toEqual([]);
  });

  it('e chi c\'e in italiano c\'e in tutte e quindici', () => {
    const mancanti = [];
    for (const chiave of chiaviInvocate().keys()) {
      for (const lingua of LINGUE) {
        if (PACCHETTI[lingua][chiave] === undefined) mancanti.push(`${lingua}.${chiave}`);
      }
    }
    expect(mancanti).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════
describe('il ripiego dopo una traduzione e sempre codice morto', () => {

  it('nessuno scrive piu `L(\'chiave\') || \'testo\'`', () => {
    // Non e "poco elegante": e una riga che NON PUO funzionare, perche
    // t() torna la chiave e non undefined. Chi la scrive crede di avere
    // una rete e non ce l'ha, e per giunta si convince che sia coperto.
    const colpevoli = [];
    for (const f of FILE) {
      const sorgente = senzaCommenti(leggi(f));
      for (const m of sorgente.matchAll(/\b(?:L|tI|tFuori|T)\('[A-Za-z0-9_]+'\)\s*\|\|\s*['"`]/g)) {
        colpevoli.push(`${f}: ${m[0]}`);
      }
    }
    expect(colpevoli).toEqual([]);
  });

  it('e t() torna davvero la chiave, che e il motivo per cui non funzionava', () => {
    // La prova del perche, non solo del cosa. Se un giorno t() cambiasse
    // e tornasse undefined, questo controllo lo direbbe e il divieto
    // sopra si potrebbe togliere.
    const i18n = leggi('app/lib/i18n.js');
    const corpo = i18n.slice(i18n.indexOf('export function t(lang, key)'));
    expect(corpo.slice(0, corpo.indexOf('\n}'))).toContain('return key;');
  });
});

// ═══════════════════════════════════════════════════════════════
describe('le briciole rimaste nelle schermate piu guardate', () => {

  // File → frasi che c'erano scritte a mano. Si cerca la stringa fra
  // apici o come testo JSX: una parola citata in un commento non conta,
  // perche i commenti sono gia stati tolti.
  const CABLATE = {
    'app/components/SpeakerView.js': ['Parlo in', 'Traduci in', 'QR Taxi'],
    'app/components/TalkControls.js': ['Annulla', 'ANNULLA'],
    'app/components/VideoCallOverlay.js': ['Camera spenta', 'Ruota', 'Espandi', 'Chiudi'],
    'app/components/VoiceCallOverlay.js': ['Chiamata vocale'],
    'app/components/RoomView.js': ['Video call in arrivo', 'Chiamata vocale in arrivo', 'ti sta chiamando'],
    'app/components/MessageList.js': ['Tu', 'ELABORAZIONE', 'ASCOLTO'],
    'app/components/RoomHeader.js': ['AI Actions', 'Audio Ducking', 'Esci'],
    'app/components/SummaryView.js': ['Key Points', 'AI Report...'],
    'app/components/HistoryView.js': ['Oggi', 'Ieri', 'Conversazione'],
    'app/not-found.js': ['Go Home', 'Go back to home page', 'Redirecting in'],
    'app/global-error.js': ['Something went wrong', 'Try again'],
    'app/account/page.js': ['Voice Clone', 'Not signed in', 'Not cloned', 'Terms of Service'],
  };

  for (const [file, frasi] of Object.entries(CABLATE)) {
    it(`${file} non contiene piu testo scritto a mano`, () => {
      const sorgente = senzaCommenti(leggi(file));
      const rimaste = frasi.filter((f) =>
        sorgente.includes(`'${f}'`) || sorgente.includes(`"${f}"`) || sorgente.includes(`>${f}<`));
      expect(rimaste).toEqual([]);
    });
  }

  it('le chiavi nuove di questo giro esistono in tutte e quindici', () => {
    const campione = [
      'exit', 'send', 'callIncoming', 'starterPack',            // le quattro fantasma
      'iSpeakIn', 'translateIntoLabel', 'qrTaxiBtn',            // SpeakerView
      'cancelWord', 'rotateWord', 'expandWord',                 // comandi
      'youWord', 'processingUpper', 'listeningUpper', 'liveUpper',
      'incomingVideoCall', 'incomingVoiceCall',                 // la chiamata che arriva
      'aiActionsTitle', 'audioDuckingLabel', 'aiReportLoading',
      'yesterdayWord', 'resetWord',
      'notFoundText', 'goHomeBtn', 'goHomeAria', 'redirectingIn', 'errorNotified',
      'accountGuest', 'notSignedIn', 'planWord', 'creditsWord', 'creditsRemaining',
      'voiceCloneLabel', 'voiceCloneActive', 'voiceCloneNone',
      'languageWord', 'termsOfServiceLink', 'privacyPolicyLink',
    ];
    const mancanti = [];
    for (const lingua of LINGUE) {
      for (const k of campione) {
        if (PACCHETTI[lingua][k] === undefined) mancanti.push(`${lingua}.${k}`);
      }
    }
    expect(mancanti).toEqual([]);
  });

  it('e non sono state riempite copiando l\'italiano', () => {
    // Un pacchetto riempito con copia-incolla passerebbe il conteggio e
    // lascerebbe l'utente esattamente dov'era.
    const frasi = ['notFoundText', 'errorNotified', 'incomingVideoCall', 'cancelWord', 'languageWord'];
    for (const k of frasi) {
      for (const lingua of ['en', 'es', 'de', 'ru', 'ja']) {
        expect(`${lingua}.${k}=${PACCHETTI[lingua][k]}`)
          .not.toBe(`${lingua}.${k}=${PACCHETTI.it[k]}`);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════
describe('le tre pagine che vivono fuori da AppProvider', () => {

  // La 404, l'errore di radice e /account non hanno il contesto: L() li
  // farebbe cadere. Devono leggersi la lingua da soli, come CookieConsent.
  const FUORI = ['app/not-found.js', 'app/global-error.js', 'app/account/page.js'];

  it('leggono la lingua dalla funzione comune, non a modo loro', () => {
    for (const f of FUORI) {
      expect({ f, usa: leggi(f).includes('linguaInterfacciaFuoriContesto') })
        .toEqual({ f, usa: true });
    }
  });

  it('e la mettono in stato, per non far litigare l\'idratazione', () => {
    // Il server non ha localStorage: se la lingua vera si leggesse al
    // primo disegno, il testo del server e quello del browser sarebbero
    // diversi e React se ne lamenterebbe. Si parte da 'en' e si corregge
    // in useEffect — lo stesso schema di CookieConsent.
    for (const f of FUORI) {
      const s = senzaCommenti(leggi(f));
      expect({ f, stato: /useState\('en'\)/.test(s) }).toEqual({ f, stato: true });
      expect({ f, effetto: /useEffect\(\(\) => \{[\s\S]{0,80}?setLingua\(linguaInterfacciaFuoriContesto\(\)\)/.test(s) })
        .toEqual({ f, effetto: true });
    }
  });
});

// ═══════════════════════════════════════════════════════════════
describe('anche le date seguono la lingua dell\'interfaccia', () => {

  it('AppContext la espone, invece di tenersela', () => {
    // Serviva a chi formatta una data: L() traduce le parole, non i mesi.
    const s = leggi('app/contexts/AppContext.js');
    expect(s).toContain('uiLang: linguaInterfaccia');
  });

  it('nessuna schermata scrive piu \'it-IT\' a mano', () => {
    const colpevoli = [];
    for (const f of FILE) {
      if (!/^app\/(components|hooks|contexts)\//.test(f)) continue;
      const s = senzaCommenti(leggi(f));
      if (/toLocale\w*\(\s*'it-IT'/.test(s)) colpevoli.push(f);
    }
    expect(colpevoli).toEqual([]);
  });

  it('archivio e report la chiedono al contesto', () => {
    for (const f of ['app/components/HistoryView.js', 'app/components/SummaryView.js']) {
      const s = senzaCommenti(leggi(f));
      expect({ f, prende: s.includes('uiLang') }).toEqual({ f, prende: true });
      expect({ f, usa: /toLocale\w*\(uiLang/.test(s) }).toEqual({ f, usa: true });
    }
  });
});

// ═══════════════════════════════════════════════════════════════
describe('i quindici pacchetti restano allineati', () => {

  it('hanno tutti lo stesso numero di chiavi', () => {
    const conteggi = LINGUE.map((l) => [l, Object.keys(PACCHETTI[l]).length]);
    const atteso = conteggi[0][1];
    expect(conteggi).toEqual(LINGUE.map((l) => [l, atteso]));
  });

  it('e gli stessi nomi', () => {
    const riferimento = Object.keys(PACCHETTI.it).sort();
    for (const lingua of LINGUE) {
      expect({ lingua, chiavi: Object.keys(PACCHETTI[lingua]).sort() })
        .toEqual({ lingua, chiavi: riferimento });
    }
  });

  it('nessun valore e vuoto', () => {
    const vuote = [];
    for (const lingua of LINGUE) {
      for (const [k, v] of Object.entries(PACCHETTI[lingua])) {
        if (typeof v !== 'string' || v.trim() === '') vuote.push(`${lingua}.${k}`);
      }
    }
    expect(vuote).toEqual([]);
  });

  it('e l\'intestazione di ogni file dice il numero giusto', () => {
    // E la riga che si guarda per prima quando si apre il file: se mente,
    // mente su esattamente la cosa che Luca vuole poter verificare contando.
    for (const lingua of LINGUE) {
      const testa = fs.readFileSync(path.join(CARTELLA_LOCALI, `${lingua}.js`), 'utf8').split('\n')[0];
      const m = testa.match(/\((\d+) keys\)/);
      expect({ lingua, dichiarate: m && Number(m[1]) })
        .toEqual({ lingua, dichiarate: Object.keys(PACCHETTI[lingua]).length });
    }
  });
});
