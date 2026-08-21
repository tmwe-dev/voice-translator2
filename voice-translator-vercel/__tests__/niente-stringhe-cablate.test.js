// ═══════════════════════════════════════════════════════════════
// NIENTE STRINGHE CABLATE (b.138)
//
// Seguito diretto di `la-lingua-viene-prima.test.js`. In b.136/b.137
// erano stati sistemati SettingsView, VoiceCloneView, VoiceTestView,
// AccountView e CookieConsent. Restava il resto dell'applicazione:
// la schermata principale, la rubrica, il credito, l'aiuto, la
// Community, il taxi, la stanza video, gli avvisi degli hook.
//
// Quello che si vedeva davvero, con l'interfaccia impostata su una
// lingua diversa dall'italiano:
//
//   · HomeView    — "Con chi vuoi parlare?" e le sei porte in italiano
//   · ContactsView— "Nessun contatto", "Visto 5m fa", "Cerca contatti..."
//   · CreditsView — "MINUTI DISPONIBILI", "HAI UN CODICE?", "Crea regalo"
//   · HelpView    — dieci domande e dieci risposte, tutte in italiano
//   · MondoView   — "Nessuna stanza al momento", "Litigio libero"
//   · TaxiMode    — "TAXI MODE" in inglese e "Modalita taxi" in italiano
//                   nella stessa funzione, nessuna delle due scelta
//   · ErrorBoundary — un dizionario privato di dieci lingue su quindici,
//                   e la lingua dedotta dal browser invece che da uiLang
//   · NetworkStatus / Toast — fuori da AppProvider, quindi dimenticati
//
// Questi controlli non guardano se una schermata "e tradotta": contano
// e confrontano. Sono due cose che si possono verificare a macchina.
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

/** Legge un pacchetto lingua senza importarlo: e un oggetto letterale su una riga. */
function leggiPacchetto(lingua) {
  const sorgente = fs.readFileSync(path.join(CARTELLA_LOCALI, `${lingua}.js`), 'utf8');
  const m = sorgente.match(/^const locale_\w+ = (\{[\s\S]*\});\s*$/m);
  if (!m) throw new Error(`formato inatteso in ${lingua}.js`);
  return JSON.parse(m[1]);
}

const PACCHETTI = Object.fromEntries(LINGUE.map(l => [l, leggiPacchetto(l)]));

function leggi(relativo) {
  return fs.readFileSync(path.join(RADICE, relativo), 'utf8');
}

/**
 * Toglie i commenti prima di cercare.
 *
 * Trappola gia costata tempo tre volte in questa base di codice: ogni
 * correzione porta con se un commento che CITA la frase tolta ("qui
 * c'era 'Nessun contatto'"), e un controllo ingenuo trova la citazione
 * e crede che il difetto sia ancora li. Qui si toglie la citazione, non
 * la spiegazione: i commenti restano nel file, spariscono solo dal
 * testo su cui si cerca.
 */
function senzaCommenti(sorgente) {
  return sorgente
    .replace(/\/\*[\s\S]*?\*\//g, '')       // blocchi /* ... */
    .split('\n')
    .filter(r => !/^\s*(\/\/|\*)/.test(r))  // righe // ... e continuazioni JSDoc
    .join('\n');
}

// ═══════════════════════════════════════════════════════════════
describe('i quindici pacchetti lingua hanno le stesse chiavi', () => {

  it('sono quindici, e nessuno manca', () => {
    expect(Object.keys(PACCHETTI).sort()).toEqual([...LINGUE].sort());
  });

  it('tutti hanno lo STESSO NUMERO di chiavi', () => {
    // E la proprieta che Luca vuole poter verificare contando: se una
    // chiave viene aggiunta a it.js e dimenticata altrove, qui si vede.
    const conteggi = LINGUE.map(l => [l, Object.keys(PACCHETTI[l]).length]);
    const atteso = conteggi[0][1];
    expect(conteggi).toEqual(LINGUE.map(l => [l, atteso]));
  });

  it('e hanno esattamente gli STESSI NOMI di chiave', () => {
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

  it('le chiavi nuove di b.138 esistono in tutte e quindici', () => {
    // Un campione preso da ogni schermata toccata: se una di queste
    // manca, la schermata e tornata a parlare per conto suo.
    const campione = [
      'homeTitle', 'actFaceTitle', 'worldNowTitle',          // HomeView
      'noContacts', 'lastSeenPrefix', 'searchContacts',      // ContactsView
      'creditMinutesAvailable', 'createGift', 'giftRule',    // CreditsView
      'faqHowQ', 'faqPrivacyA', 'helpFeatMirrorDesc',        // HelpView
      'loadRoomsFailed', 'freeFight', 'openRoomNotice',      // MondoView
      'taxiModeTitle', 'playTranslationRepeat',              // TaxiMode
      'errorTitle', 'errorDesc', 'reloadPage',               // ErrorBoundary
      'offlineBanner', 'closeNotification',                  // NetworkStatus/Toast
      'secLine1', 'modNobodyWaiting', 'veloTapToRead',       // sicurezza/moderazione/velo
      'knockedWait', 'cannotStartMicCam', 'transcribeFailed',// hook
    ];
    const mancanti = [];
    for (const lingua of LINGUE) {
      for (const k of campione) {
        if (PACCHETTI[lingua][k] === undefined) mancanti.push(`${lingua}.${k}`);
      }
    }
    expect(mancanti).toEqual([]);
  });

  it('una traduzione non italiana non e la copia pigra dell\'italiano', () => {
    // Controllo su un campione di frasi lunghe: se en/es/de fossero
    // identiche a it vorrebbe dire che la chiave e stata riempita
    // copiando invece che traducendo.
    const frasi = ['homeTitle', 'faqHowQ', 'giftRule', 'offlineBanner', 'secLine1'];
    for (const k of frasi) {
      for (const lingua of ['en', 'es', 'de', 'ru', 'ja']) {
        expect(`${lingua}.${k}=${PACCHETTI[lingua][k]}`)
          .not.toBe(`${lingua}.${k}=${PACCHETTI.it[k]}`);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════
describe('le stringhe italiane tolte non sono tornate nel codice', () => {

  // Coppia file → frasi che c'erano scritte a mano e che ora vivono
  // nei pacchetti lingua. Si cerca la stringa fra apici, cioe come
  // letterale di codice: una parola citata in un commento non conta
  // (trappola gia costata tempo in questa base di codice).
  const CABLATE = {
    'app/components/HomeView.js': [
      'Con chi vuoi parlare?',
      'Parla con chi hai davanti',
      'Invia un link via WhatsApp, SMS o email',
      'Stanze aperte, discussioni senza barriere',
    ],
    'app/components/ContactsView.js': [
      'Nessun contatto',
      'Cerca contatti...',
      'Condividi invito',
      'Aggiungi per email',
    ],
    'app/components/CreditsView.js': [
      'MINUTI DISPONIBILI',
      'HAI UN CODICE?',
      'Crea regalo',
      'Invia il regalo',
    ],
    'app/components/HelpView.js': [
      'Come funziona la traduzione?',
      'Quanto costa BarTalk?',
      'I messaggi sono privati?',
      'FAQ e guida rapida',
    ],
    'app/components/MondoView.js': [
      'Impossibile caricare le stanze',
      'Nessuna stanza con questi filtri',
      'Litigio libero',
      'Cerca stanze...',
    ],
    'app/components/TaxiMode.js': [
      'TAXI MODE',
      'Play text-to-speech',
      'Close Taxi Mode',
      'Modalita taxi',
    ],
    'app/components/NumeroSicurezza.js': [
      'Con chi stai parlando',
      'I numeri combaciano',
    ],
    'app/components/PannelloModerazione.js': [
      'Nessuno in attesa.',
      'Per ora sei solo tu.',
    ],
    'app/components/NetworkStatus.js': [
      'Sei offline',
      'Connessione ripristinata',
    ],
    'app/components/NewConversationSheet.js': [
      'Entra con un codice',
      'Apri una stanza pubblica',
    ],
    'app/hooks/useStanzaVideo.js': [
      'Serve il permesso per microfono e telecamera.',
      'Non riesco a entrare',
    ],
    'app/hooks/useRoomPolling.js': [
      'Non puoi entrare in questa stanza.',
      'Hai bussato: aspetta che ti aprano.',
    ],
  };

  for (const [file, frasi] of Object.entries(CABLATE)) {
    it(`${file} non contiene piu testo scritto a mano`, () => {
      const sorgente = senzaCommenti(leggi(file));
      const rimaste = frasi.filter(f =>
        sorgente.includes(`'${f}'`) || sorgente.includes(`"${f}"`) || sorgente.includes(`>${f}<`));
      expect(rimaste).toEqual([]);
    });
  }

  it('ErrorBoundary non ha piu un dizionario tutto suo', () => {
    // Aveva una tabella di dieci lingue scritta dentro il file: cinque
    // lingue in meno del resto dell'app, e senza rispettare uiLang.
    const sorgente = senzaCommenti(leggi('app/components/ErrorBoundary.js'));
    expect(sorgente).not.toContain('Something went wrong');
    expect(sorgente).not.toContain('Algo salió mal');
    expect(sorgente).toContain('linguaInterfacciaFuoriContesto');
  });

  it('MessageList non ha piu le etichette di stato in italiano', () => {
    const sorgente = senzaCommenti(leggi('app/components/MessageList.js'));
    expect(sorgente).not.toContain("'Arrivato all\\'altro telefono'");
    expect(sorgente).toContain('statusDelivered');
  });
});

// ═══════════════════════════════════════════════════════════════
describe('chi vive fuori dal contesto legge comunque la lingua giusta', () => {

  it('la funzione e una sola e sta in i18n.js', () => {
    const i18n = leggi('app/lib/i18n.js');
    expect(i18n).toContain('export function linguaInterfacciaFuoriContesto');
    expect(i18n).toContain('export function tFuori');
  });

  it('i tre componenti fuori da AppProvider la usano', () => {
    for (const f of ['app/components/CookieConsent.js',
                     'app/components/NetworkStatus.js',
                     'app/components/Toast.js']) {
      expect({ f, usa: leggi(f).includes('linguaInterfacciaFuoriContesto') })
        .toEqual({ f, usa: true });
    }
  });

  it('e non ripiega sull\'italiano, che era il difetto di b.135', () => {
    const i18n = leggi('app/lib/i18n.js');
    const corpo = i18n.slice(i18n.indexOf('export function linguaInterfacciaFuoriContesto'));
    const fine = corpo.indexOf('\n}');
    expect(corpo.slice(0, fine)).not.toContain("'it'");
  });
});
