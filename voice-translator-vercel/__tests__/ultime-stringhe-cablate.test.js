// ═══════════════════════════════════════════════════════════════
// LE ULTIME STRINGHE CABLATE (b.139)
//
// Seguito di `niente-stringhe-cablate.test.js`. Dopo b.136/b.137/b.138
// restavano fuori otto schermate, e non le meno importanti: sono quelle
// che vede chi arriva per la prima volta.
//
//   · SpeakerView        — tutto TaxiTalk: "Ti ascolto…", "Traduco…",
//                          "LINGUA DELL'AUTISTA", "Mostra al tassista"
//   · JoinView           — aveva un DIZIONARIO SUO, `tx()`, con dentro
//                          quattordici frasi tradotte a mano in cinque
//                          lingue su quindici. Chi entrava da un invito
//                          con l'interfaccia in giapponese leggeva
//                          l'inglese, e non per scelta: per assenza.
//   · InstallaApp        — il pannello "installa o resta nel browser"
//   · CreateRoomSheet    — il modulo di creazione, comprese le due
//                          spiegazioni lunghe (Stanza Diretta, litigio)
//   · WelcomeView        — usava `Lf(chiave, ripiego)` col ripiego in
//                          italiano: la chiave mancava e usciva quello
//   · TutorialOverlay    — i sei passi del primo avvio
//   · TaxiDestinationPanel — le cinque etichette di FIELD_CONFIG
//   · TaxiDriverView     — gli errori che legge il tassista
//
// Piu la coda: AIView, ApiKeysView, BottomNav ("Profilo"), RoomView,
// BatteryPill, e tre etichette per lettore di schermo che erano in
// italiano o in inglese fisso (PageHeader, InterpreterView, MessageList).
//
// I controlli qui sotto CONTANO e CONFRONTANO. Non giudicano se una
// schermata "sembra tradotta".
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

const PACCHETTI = Object.fromEntries(LINGUE.map(l => [l, leggiPacchetto(l)]));

const leggi = (relativo) => fs.readFileSync(path.join(RADICE, relativo), 'utf8');

// I commenti raccontano le frasi che sono state tolte: un controllo
// ingenuo trova la propria spiegazione e crede che il difetto sia li.
function senzaCommenti(sorgente) {
  return sorgente
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(r => !/^\s*(\/\/|\*)/.test(r))
    .join('\n');
}

// ═══════════════════════════════════════════════════════════════
describe('le chiavi nuove di b.139 esistono in tutte e quindici', () => {

  // Un campione da ogni schermata toccata. Se una manca, quella
  // schermata e tornata a parlare per conto suo.
  const CAMPIONE = [
    // SpeakerView / TaxiTalk
    'taxiIListen', 'taxiListenLive', 'readingAloud', 'driverLanguage',
    'mirrorHint', 'readInLang', 'taxiHintBatch', 'showToDriver',
    'releaseToTranslate', 'liveTranslationOn', 'quickDestination', 'addressPlaceholder',
    // JoinView (le vecchie voci del dizionario interno)
    'continueWord', 'genderWord', 'maleWord', 'femaleWord', 'otherWord',
    'yourLangDesc', 'audioPrefs', 'autoPlayLabel', 'autoPlayDesc',
    'transVoice', 'changeVoiceLater', 'freeVoiceEdge', 'joinChat',
    'joining', 'invitedToTranslated', 'avatarWord',
    // InstallaApp
    'installOnDeviceTitle', 'notifBlockedDesc', 'installIosStep2',
    'notifFixStep1', 'stayInBrowser', 'installTheApp',
    // CreateRoomSheet
    'roomTypePublic', 'roomTypeProtectedDesc', 'directRoomTitle',
    'directRoomCostBody', 'directRoomCostBody2', 'freeFightOnDesc',
    'roomNamePlaceholder', 'giveRoomAName',
    // WelcomeView
    'heroTitle', 'heroSubtitle', 'setupTitle', 'heyName', 'startUsing',
    // TutorialOverlay
    'tutStep1Title', 'tutStep6Desc', 'skipWord', 'startExcl',
    // TaxiDestinationPanel / TaxiDriverView
    'destTerminal', 'destNotesPh', 'extraDetails',
    'loadingDestination', 'cannotDecryptDest', 'backHome',
    // la coda
    'aiGreetDesc', 'styleTechnicalDesc', 'loginRequired', 'saveFailed',
    'navProfile', 'directRoomBannerBody', 'cancelReply',
    'onlyTranslated', 'roomIsFull', 'roomNotFound',
    'chatMessagesAria', 'closeInterpreter', 'activateAudio',
  ];

  it('nessuna chiave del campione manca da nessun pacchetto', () => {
    const mancanti = [];
    for (const lingua of LINGUE) {
      for (const k of CAMPIONE) {
        if (PACCHETTI[lingua][k] === undefined) mancanti.push(`${lingua}.${k}`);
      }
    }
    expect(mancanti).toEqual([]);
  });

  it('e nessuna e stata riempita copiando l\'italiano', () => {
    // Su una frase lunga la copia si vede: se en/de/ru/ja sono identiche
    // a it, la chiave e stata riempita invece che tradotta.
    const frasi = [
      'taxiHintBatch', 'mirrorHint', 'directRoomCostBody',
      'notifBlockedDesc', 'tutStep1Desc', 'aiTipBody',
    ];
    for (const k of frasi) {
      for (const lingua of ['en', 'de', 'ru', 'ja', 'ar']) {
        expect(`${lingua}.${k}`, `${lingua}.${k} e uguale all'italiano`)
          .toBe(PACCHETTI[lingua][k] === PACCHETTI.it[k] ? 'COPIA' : `${lingua}.${k}`);
      }
    }
  });

  it('i segnaposto {x} sopravvivono alla traduzione', () => {
    // `readInLang` e `heyName` compongono una frase con dentro un valore.
    // Se il segnaposto sparisce in una lingua, quella lingua perde il dato.
    for (const k of ['readInLang', 'heyName']) {
      for (const lingua of LINGUE) {
        expect(`${lingua}.${k}`, `manca {x} in ${lingua}.${k}`)
          .toBe(PACCHETTI[lingua][k].includes('{x}') ? `${lingua}.${k}` : 'SENZA-SEGNAPOSTO');
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════
describe('il dizionario privato di JoinView e stato smontato', () => {

  const join = () => senzaCommenti(leggi('app/components/JoinView.js'));

  it('la funzione `tx` non esiste piu', () => {
    expect(join()).not.toMatch(/const tx = /);
    expect(join()).not.toMatch(/tx\('/);
  });

  it('e con lei la mappa a cinque lingue', () => {
    // La firma era una riga con it/es/fr/de/en tutti insieme.
    expect(join()).not.toMatch(/it:\s*'[^']*',\s*es:\s*'/);
  });

  it('le sue quattordici voci ora passano da tI(), come il resto', () => {
    const s = join();
    for (const chiave of [
      'continueWord', 'genderWord', 'maleWord', 'femaleWord', 'otherWord',
      'yourLangDesc', 'audioPrefs', 'autoPlayLabel', 'autoPlayDesc',
      'transVoice', 'changeVoiceLater', 'freeVoiceEdge', 'joinChat',
    ]) {
      expect(s, `JoinView non chiede piu ${chiave}`).toContain(`tI('${chiave}')`);
    }
  });

  it('e i ripieghi italiani dopo `||` sono spariti', () => {
    const s = join();
    expect(s).not.toContain('Entro nella conversazione');
    expect(s).not.toContain('Sei stato invitato a una conversazione');
  });
});

// ═══════════════════════════════════════════════════════════════
describe('WelcomeView non ha piu un ripiego italiano nascosto', () => {

  it('`Lf(chiave, ripiego)` non esiste piu', () => {
    // Era la forma piu insidiosa: la schermata SEMBRAVA tradotta, e in
    // mancanza della chiave usciva l'italiano, in silenzio.
    const s = senzaCommenti(leggi('app/components/WelcomeView.js'));
    expect(s).not.toMatch(/const Lf = /);
    expect(s).not.toMatch(/Lf\('/);
  });
});

// ═══════════════════════════════════════════════════════════════
describe('le frasi italiane tolte non sono tornate nel codice', () => {

  const CABLATE = {
    'app/components/SpeakerView.js': [
      'Ti ascolto',
      'Leggo ad alta voce',
      'Parla o scrivi: qui compare il messaggio',
      'Mostra al tassista',
      'Tieni premuto il microfono',
      'Rilascia per tradurre',
      'Destinazione rapida',
      'Indirizzo, hotel, monumento',
    ],
    'app/components/JoinView.js': [
      'La tua lingua',
      'Preferenze audio',
      'Riproduzione automatica',
      'Entra nella Chat',
    ],
    'app/components/InstallaApp.js': [
      'Installa BarTalk sul dispositivo',
      'Resta nel browser',
      'Gli avvisi sono bloccati da questo browser',
      'Tocca Condividi in basso in Safari',
      'Ricarica la pagina',
    ],
    'app/components/CreateRoomSheet.js': [
      'Chiunque',
      'Richiede approvazione per entrare',
      'Solo su invito diretto',
      'Nome o argomento',
      'Tipo di stanza',
      'Partecipanti max',
      'Lingua principale',
      'Creazione...',
    ],
    'app/components/WelcomeView.js': [
      'Parla qualsiasi lingua, ovunque',
      'Configurazione rapida',
      'Scegli il tuo avatar',
      'Inizia ad usare BarTalk',
      'Codice regalo',
    ],
    'app/components/TutorialOverlay.js': [
      'Benvenuto in BarTalk',
      'Parla e Traduci',
      'I tuoi minuti, per sempre',
      'Salta',
      'Inizia!',
    ],
    'app/components/TaxiDestinationPanel.js': [
      'Note per il tassista',
      'Numero volo',
      'Dettagli aggiuntivi',
      'Bagaglio grande',
    ],
    'app/components/TaxiDriverView.js': [
      'Caricamento destinazione',
      'Torna alla home',
      'Traduzione in corso',
      'Errore di rete',
    ],
    'app/components/AIView.js': [
      'Riepilogo automatico',
      'Stile di Traduzione',
      'Suggerimento AI',
      'Terminologia specialistica',
    ],
    'app/components/ApiKeysView.js': [
      'Login richiesto',
      'Salvataggio fallito',
      'Chiavi salvate con successo',
    ],
    'app/components/BottomNav.js': [
      'Profilo',
    ],
    'app/components/RoomView.js': [
      'Annulla risposta',
      'Stanza Diretta.',
    ],
    'app/lib/audioPrefs.js': [
      'Solo tradotta',
      'Attenuata',
      'Entrambe',
    ],
  };

  for (const [file, frasi] of Object.entries(CABLATE)) {
    it(`${file} non contiene piu frasi italiane fisse`, () => {
      const s = senzaCommenti(leggi(file));
      for (const frase of frasi) {
        expect(s, `"${frase}" e ancora scritta a mano in ${file}`)
          .not.toContain(frase);
      }
    });
  }
});

// ═══════════════════════════════════════════════════════════════
describe('anche chi vive fuori dal contesto parla la lingua giusta', () => {

  it('PageHeader traduce la freccia "Indietro" con tFuori', () => {
    // E l'etichetta per lettore di schermo di OGNI schermata con
    // intestazione: era in italiano fisso per tutti e quindici.
    const s = senzaCommenti(leggi('app/components/ui/PageHeader.js'));
    expect(s).toContain("tFuori('backWord')");
    expect(s).not.toContain('aria-label="Indietro"');
  });

  it('gli avvisi in basso non hanno piu la loro copia della frase', () => {
    // "Sei offline — i messaggi..." era scritta due volte, qui in
    // italiano e nei pacchetti come `offlineBanner`, con parole diverse.
    const s = senzaCommenti(leggi('app/lib/avvisi.js'));
    expect(s).toContain("tFuori('offlineBanner')");
    expect(s).toContain("tFuori('retryWord')");
    expect(s).not.toContain('Sei offline —');
  });

  it('InterpreterView non esiste piu: era un terzo schermo sopra la chiamata (b.611)', () => {
    // b.611 — collaudo dal vivo: montava un overlay z-9999 che copriva
    // ogni comando della chiamata e raddoppiava l'audio del partner.
    expect(fs.existsSync(path.join(RADICE, 'app/components/InterpreterView.js'))).toBe(false);
    const r = senzaCommenti(leggi('app/components/RoomView.js'));
    expect(r).not.toContain('InterpreterView');
  });
});

// ═══════════════════════════════════════════════════════════════
describe('la versione dichiarata e quella di questo lavoro', () => {
  it('APP_VERSION e dichiarata e ben formata', () => {
    // b.140 — prima questo controllo inchiodava il numero esatto
    // ('b.139'), quindi diventava rosso a OGNI rilascio: un test che
    // fallisce per il motivo sbagliato insegna a ignorare il rosso, ed
    // e il modo migliore per non accorgersi di quello vero. Si verifica
    // la forma, non il valore.
    expect(leggi('app/lib/constants.js')).toMatch(/APP_VERSION\s*=\s*'b\.\d+'/);
  });
});
