// ═══════════════════════════════════════════════════════════════
// LA LINGUA VIENE PRIMA (b.136)
//
// Luca ha chiesto che le lingue dell'utente si scelgano ALL'INIZIO,
// come prima pagina di tutto, con una ricerca per paese, e che da li
// in avanti si configuri tutto da solo. Guardando cosa c'era, il
// quadro era questo.
//
// ── UN'IMPOSTAZIONE PER DUE MESTIERI ──
//
// "La tua lingua" in SettingsView scriveva `prefs.lang`, e quello
// stesso campo faceva due lavori incompatibili: la lingua in cui
// l'utente PARLA (quella che viene tradotta per gli altri) e la lingua
// dell'INTERFACCIA. Sono cose diverse: un italiano che parla con un
// americano vuole i menu in italiano e le traduzioni in inglese, e
// invece si ritrovava tutta l'applicazione in inglese.
//
// ── DUE SISTEMI DI TRADUZIONE CHE NON SI PARLAVANO ──
//
// 1. quello vero: lib/i18n.js con t(), 15 lingue, i pacchetti in
//    lib/locales/. Funzionante.
// 2. uno abusivo: 66 ternari `isIT ? 'testo italiano' : 'english'`
//    sparsi in quattro file — AccountView (22), VoiceCloneView (23),
//    VoiceTestView (19), useContacts (2). Questo secondo sistema
//    conosceva DUE lingue: con le altre tredici cadeva in inglese.
//
// E `isIT` non era nemmeno una lettura di una impostazione:
//
//     const isIT = L('createRoom') === 'Crea Stanza';
//
// indovinava la lingua confrontando una traduzione con la sua stringa
// italiana. Cambiare quella riga in it.js avrebbe spento l'italiano
// ovunque, in silenzio.
//
// PROVA RACCOLTA IN PRODUZIONE: con "La tua lingua = English (US)" la
// schermata Impostazioni mostrava l'intestazione "Settings" in inglese
// sopra "Motore voce" e "Timbro" in italiano — perche i titoli delle
// righe erano scritti a mano nel JSX — e la pagina di clonazione voce
// era interamente in inglese ("Clone Your Voice", "Setup Microphone").
//
// ── E UN TERZO BUCO, TROVATO STRADA FACENDO ──
//
// it.js ed en.js avevano 300 chiavi, le altre tredici lingue 249: 51
// chiavi esistevano solo in italiano e inglese. Uno spagnolo vedeva 51
// stringhe in inglese senza che nessun ternario c'entrasse.
//
// ── COSA CONTROLLA QUESTO FILE ──
//
// Che i ternari siano spariti DAL CODICE (non dai commenti: qui sotto
// si toglie sempre la citazione prima di cercare), che le quindici
// lingue abbiano esattamente le stesse chiavi, che l'interfaccia legga
// `uiLang` e non `lang`, che la scelta del paese sia la prima
// schermata — e che chi arriva da un invito continui a non vederla.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PAESI, cercaPaesi, indovinaPaese, getPaese } from '../app/lib/paesi.js';
import { mapLang, LINGUE_INTERFACCIA } from '../app/lib/i18n.js';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');

// Trappola di questa base di codice: un difetto CITATO in un commento
// non e quel difetto. Prima di cercare `isIT` si tolgono i commenti,
// altrimenti il test leggerebbe la propria spiegazione.
const senzaCommenti = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const LINGUE = ['it','en','es','fr','de','pt','zh','ja','ko','th','ar','hi','ru','tr','vi'];
const pacchetti = {};
for (const l of LINGUE) {
  // I pacchetti sono un unico oggetto su una riga: si legge il file e
  // si prende la graffa. Piu robusto di un import dinamico dentro a
  // describe(), che vitest eseguirebbe in un altro giro.
  const testo = leggi(`app/lib/locales/${l}.js`);
  const inizio = testo.indexOf('{');
  const fine = testo.lastIndexOf('}');
  pacchetti[l] = JSON.parse(testo.slice(inizio, fine + 1));
}

const FILE_CON_TERNARI = [
  'app/components/AccountView.js',
  'app/components/VoiceCloneView.js',
  'app/components/VoiceTestView.js',
  'app/hooks/useContacts.js',
];

describe('i 66 ternari isIT non esistono piu', () => {
  for (const f of FILE_CON_TERNARI) {
    it(`${f} non decide la lingua da solo`, () => {
      const codice = senzaCommenti(leggi(f));
      expect(codice).not.toContain('isIT');
    });
  }

  it('e nessuno indovina piu la lingua confrontando una traduzione', () => {
    // `L('createRoom') === 'Crea Stanza'` era il modo in cui isIT
    // nasceva: se qualcuno lo riscrive, questo test lo prende.
    for (const f of FILE_CON_TERNARI) {
      expect(senzaCommenti(leggi(f))).not.toContain("=== 'Crea Stanza'");
    }
  });

  it('i filtri delle voci non hanno piu due etichette cablate', () => {
    // `{ label: 'Clonate', labelEN: 'Cloned' }`: due lingue nella forma
    // stessa del dato. Per aggiungerne una terza serviva un altro campo.
    const codice = senzaCommenti(leggi('app/components/VoiceTestView.js'));
    expect(codice).not.toContain('labelEN');
  });

  it('e le stringhe che c\'erano nei ternari sono diventate chiavi vere', () => {
    // Un campione preso dalle tre schermate colpite: se qualcuna di
    // queste chiavi sparisse, il testo tornerebbe a essere inventato
    // sul posto.
    const attese = [
      'recommended', 'startNowZeroCost', 'unlimitedOwnApis',   // AccountView
      'cloneTitle', 'cloneMicSetup', 'cloneEnableMic',          // VoiceCloneView
      'standardVoiceFree', 'reloadVoices', 'voiceActive',       // VoiceTestView
      'inviteShareIntro', 'inviteEmailSubject',                 // useContacts
    ];
    for (const chiave of attese) {
      expect(Object.keys(pacchetti.it)).toContain(chiave);
    }
  });

  it('l\'invito in inglese non dice piu "the real-time BarTalk"', () => {
    // Era una sostituzione automatica del nome del prodotto finita
    // sopra "the real-time voice translator": una frase priva di senso,
    // rimasta li perche nessuno legge il ramo che non e il proprio.
    expect(pacchetti.en.inviteShareIntro).toContain('voice translator');
    expect(pacchetti.en.inviteShareIntro).not.toContain('the real-time BarTalk');
  });
});

describe('le quindici lingue hanno le stesse chiavi', () => {
  const riferimento = Object.keys(pacchetti.it);

  it('nessuna lingua ha meno chiavi dell\'italiano', () => {
    for (const l of LINGUE) {
      const mancanti = riferimento.filter(k => pacchetti[l][k] === undefined);
      expect(mancanti, `${l} non ha: ${mancanti.slice(0, 8).join(', ')}`).toEqual([]);
    }
  });

  it('e nessuna ne ha in piu che le altre non conoscono', () => {
    for (const l of LINGUE) {
      const extra = Object.keys(pacchetti[l]).filter(k => pacchetti.it[k] === undefined);
      expect(extra, `${l} ha in piu: ${extra.slice(0, 8).join(', ')}`).toEqual([]);
    }
  });

  it('nessun valore e vuoto', () => {
    for (const l of LINGUE) {
      const vuote = Object.entries(pacchetti[l]).filter(([, v]) => typeof v !== 'string' || !v.trim());
      expect(vuote.map(([k]) => k), `${l} ha valori vuoti`).toEqual([]);
    }
  });

  it('le stringhe nuove sono TRADOTTE, non copiate dall\'inglese', () => {
    // Non vale per tutte: 'Pro', 'Premade', 'Fallback' restano uguali
    // in molte lingue e va bene cosi. Qui si controllano frasi vere,
    // dove una copia dall'inglese sarebbe una traduzione mancata.
    const daTradurre = ['countryTitle', 'uiLanguage', 'spokenLanguage', 'cloneTitle', 'e2eDesc'];
    for (const l of LINGUE.filter(x => x !== 'en')) {
      for (const chiave of daTradurre) {
        expect(pacchetti[l][chiave], `${l}.${chiave} e uguale all'inglese`)
          .not.toBe(pacchetti.en[chiave]);
      }
    }
  });
});

describe('l\'interfaccia segue uiLang, non la lingua parlata', () => {
  it('AppContext traduce con uiLang', () => {
    const codice = senzaCommenti(leggi('app/contexts/AppContext.js'));
    expect(codice).toContain('value.prefs?.uiLang');
    // La riga vecchia era: t(value.prefs?.lang || 'it', key)
    expect(codice).not.toContain("t(value.prefs?.lang");
  });

  it('page.js precarica e traduce con la lingua dell\'interfaccia', () => {
    const codice = senzaCommenti(leggi('app/page.js'));
    expect(codice).toContain('const linguaInterfaccia = prefs.uiLang');
    expect(codice).toContain('t(linguaInterfaccia, key)');
    expect(codice).not.toContain('t(prefs.lang, key)');
  });

  it('e prefs nasce con tutte e tre le informazioni separate', () => {
    const codice = senzaCommenti(leggi('app/page.js'));
    expect(codice).toContain('uiLang:');
    expect(codice).toContain('country:');
  });

  it('le vecchie preferenze salvate non perdono la lingua', () => {
    // Chi era gia qui ha salvato solo `lang`. Senza questa deduzione
    // l'interfaccia gli cadrebbe in inglese al primo caricamento.
    const codice = senzaCommenti(leggi('app/hooks/useInitializeApp.js'));
    expect(codice).toContain('if (!p.uiLang) p.uiLang = mapLang(p.lang');
  });

  it('mapLang riporta le 44 lingue parlate sulle 15 dell\'interfaccia', () => {
    expect(mapLang('it')).toBe('it');
    expect(mapLang('zh')).toBe('zh');
    // b.260 — il danese ORA esiste (mini-pacchetto della schermata
    // principale): proporlo non e piu una promessa non mantenuta.
    expect(LINGUE_INTERFACCIA).toContain('da');
    expect(mapLang('da')).toBe('da');
  });
});

describe('SettingsView ha due impostazioni distinte, non una che ne fa due', () => {
  const settings = () => senzaCommenti(leggi('app/components/SettingsView.js'));

  it('c\'e la riga della lingua dell\'interfaccia, e scrive uiLang', () => {
    const codice = settings();
    expect(codice).toContain("L('uiLanguage')");
    expect(codice).toContain('uiLang: codice');
  });

  it('c\'e la riga della lingua parlata, e scrive lang', () => {
    const codice = settings();
    expect(codice).toContain("L('spokenLanguage')");
    expect(codice).toContain('lang: l.code');
  });

  it('e la riga sola "La tua lingua" non c\'e piu', () => {
    expect(settings()).not.toContain('titolo="La tua lingua"');
  });

  it('la lingua dell\'interfaccia si sceglie solo fra quelle che esistono', () => {
    // LANGS ha 44 voci, i pacchetti sono 15: il selettore
    // dell'interfaccia deve pescare dai secondi.
    expect(settings()).toContain('LINGUE_INTERFACCIA.map');
  });

  it('e i titoli delle righe passano tutti da L()', () => {
    // Erano scritti a mano in italiano: e da qui che nasceva
    // "Settings" in inglese sopra "Motore voce" in italiano.
    const codice = settings();
    for (const italiano of ['"Motore voce"', '"Timbro"', '"Contatti"', '"Guida"', '"Versione"', '"Privacy"']) {
      expect(codice, `titolo ancora cablato: ${italiano}`).not.toContain(`titolo=${italiano}`);
    }
    expect(codice).toContain("L('voiceEngine')");
    expect(codice).toContain("L('voiceTimbre')");
  });
});

describe('la scelta del paese e la prima schermata', () => {
  it('al primo avvio si va su "paese", non su "welcome"', () => {
    const codice = senzaCommenti(leggi('app/hooks/useInitializeApp.js'));
    const i = codice.indexOf('const pickView');
    expect(i).toBeGreaterThan(-1);
    const blocco = codice.slice(i, i + 400);
    expect(blocco).toContain("return 'paese'");
  });

  it('ma chi arriva da un invito NON la vede: il controllo su room viene prima', () => {
    // b.133 — l'invitato entra dritto in chat senza compilare niente.
    // Se 'paese' finisse sopra `if (roomParam)` si tornerebbe indietro
    // di tre schermate proprio per chi era stato invitato a parlare.
    const codice = senzaCommenti(leggi('app/hooks/useInitializeApp.js'));
    const i = codice.indexOf('const pickView');
    const blocco = codice.slice(i, i + 400);
    expect(blocco.indexOf("return 'join'")).toBeLessThan(blocco.indexOf("return 'paese'"));
  });

  it('e per l\'invitato la lingua dell\'interfaccia si deduce, non si chiede', () => {
    const codice = senzaCommenti(leggi('app/hooks/useInitializeApp.js'));
    expect(codice).toContain('uiLang: mapLang(linguaOspite)');
  });

  it('page.js sa disegnare la schermata', () => {
    const codice = senzaCommenti(leggi('app/page.js'));
    expect(codice).toContain("view === 'paese'");
    expect(codice).toContain('<SceltaPaeseView');
  });

  it('e dopo la scelta si torna da dove si e venuti', () => {
    // Ci si arriva da tre punti: primo avvio, riepilogo nel benvenuto,
    // riga "Paese" nelle impostazioni. Mandarli tutti su 'welcome'
    // butterebbe un utente di vecchia data dentro l'onboarding solo
    // per aver cambiato bandiera.
    const codice = senzaCommenti(leggi('app/page.js'));
    expect(codice).toContain('vistaPrimaDelPaese');
    expect(codice).toContain('onFatto={dopoLaSceltaDelPaese}');
  });

  it('la schermata ha un campo di ricerca per il paese', () => {
    const codice = senzaCommenti(leggi('app/components/SceltaPaeseView.js'));
    expect(codice).toContain('cercaPaesi(ricerca)');
    expect(codice).toContain("L('countrySearch')");
  });

  it('non c\'e un "salta" che lascerebbe lo stato indefinito', () => {
    const codice = senzaCommenti(leggi('app/components/SceltaPaeseView.js'));
    expect(codice).not.toContain("L('skip')");
  });

  it('scegliere il paese imposta tutte e tre le cose insieme', () => {
    const codice = senzaCommenti(leggi('app/components/SceltaPaeseView.js'));
    expect(codice).toContain('country: paese.codice');
    expect(codice).toContain('lang: linguaParlata');
    expect(codice).toContain('uiLang: mapLang(linguaParlata)');
  });

  it('WelcomeView non ri-chiede la lingua una seconda volta', () => {
    // C'era una griglia di dodici bandierine che scriveva `prefs.lang`
    // e nient'altro: due schermate di fila che chiedono la stessa cosa
    // con due esiti diversi sono il modo piu sicuro di farle divergere.
    const codice = senzaCommenti(leggi('app/components/WelcomeView.js'));
    expect(codice).not.toContain('displayLangs.map');
    expect(codice).not.toContain('showAllLangs');
    expect(codice).toContain("setView('paese')");
  });
});

describe('la tabella dei paesi', () => {
  it('ogni paese ha una lingua che esiste davvero fra quelle parlate', async () => {
    const { LANGS } = await import('../app/lib/constants.js');
    const codici = new Set(LANGS.map(l => l.code));
    const rotti = PAESI.filter(p => !codici.has(p.lingua)).map(p => p.codice);
    expect(rotti, `paesi con una lingua inesistente: ${rotti.join(', ')}`).toEqual([]);
  });

  it('e una lingua dell\'interfaccia raggiungibile con mapLang', () => {
    const rotti = PAESI.filter(p => !LINGUE_INTERFACCIA.includes(mapLang(p.lingua)));
    expect(rotti.map(p => p.codice)).toEqual([]);
  });

  it('nessun codice paese e ripetuto', () => {
    const visti = new Set();
    const doppi = [];
    for (const p of PAESI) { if (visti.has(p.codice)) doppi.push(p.codice); visti.add(p.codice); }
    expect(doppi).toEqual([]);
  });

  it('nessun fuso orario e assegnato a due paesi', () => {
    const visti = new Map();
    const doppi = [];
    for (const p of PAESI) for (const f of p.fusi) {
      if (visti.has(f)) doppi.push(`${f}: ${visti.get(f)} e ${p.codice}`);
      visti.set(f, p.codice);
    }
    expect(doppi).toEqual([]);
  });

  it('la ricerca trova anche senza accenti e in inglese', () => {
    expect(cercaPaesi('espana').map(p => p.codice)).toContain('ES');
    expect(cercaPaesi('Germany').map(p => p.codice)).toContain('DE');
    expect(cercaPaesi('MEX').map(p => p.codice)).toContain('MX');
    expect(cercaPaesi('brasil').map(p => p.codice)).toContain('BR');
  });

  it('una ricerca senza risultati restituisce una lista vuota, non tutto', () => {
    expect(cercaPaesi('zzzzz')).toEqual([]);
  });

  it('la proposta iniziale usa la REGIONE della lingua, non solo la lingua', () => {
    // E' il motivo per cui si sceglie il paese e non la lingua:
    // "es-MX" e "es-ES" sono la stessa lingua e due paesi diversi.
    expect(indovinaPaese({ lingua: 'es-MX', fuso: '' })?.codice).toBe('MX');
    expect(indovinaPaese({ lingua: 'es-ES', fuso: '' })?.codice).toBe('ES');
    expect(indovinaPaese({ lingua: 'pt-BR', fuso: '' })?.codice).toBe('BR');
  });

  it('e quando la regione manca ripiega sul fuso orario', () => {
    // Meta dei telefoni danno "es" e basta: senza il fuso si tirerebbe
    // a indovinare fra venti paesi ispanofoni.
    expect(indovinaPaese({ lingua: 'es', fuso: 'America/Bogota' })?.codice).toBe('CO');
    expect(indovinaPaese({ lingua: 'en', fuso: 'Australia/Sydney' })?.codice).toBe('AU');
    expect(indovinaPaese({ lingua: 'it', fuso: 'Europe/Rome' })?.codice).toBe('IT');
  });

  it('e in ultima istanza sulla sola lingua', () => {
    expect(indovinaPaese({ lingua: 'ja', fuso: 'Fuso/Inventato' })?.codice).toBe('JP');
  });

  it('con indizi inutilizzabili non inventa un paese', () => {
    // Meglio nessuna proposta che una a caso: la riga "Suggerito per
    // te" sparisce e si cerca, invece di partire con una bandiera
    // sbagliata gia selezionata.
    expect(indovinaPaese({ lingua: 'xx', fuso: 'Fuso/Inventato' })).toBeUndefined();
  });

  it('getPaese non e sensibile alle maiuscole', () => {
    expect(getPaese('it')?.codice).toBe('IT');
    expect(getPaese('IT')?.nome).toBe('Italia');
    expect(getPaese('')).toBeUndefined();
  });
});
