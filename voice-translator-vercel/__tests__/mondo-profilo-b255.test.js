// ═══════════════════════════════════════════════════════════════
// b.255 — audit di Mondo e Profilo: sei difetti confermati riga per riga.
//
// Stessa famiglia dei difetti che il collaudo dal vivo continua a trovare:
// cose scritte e mai collegate, promesse che non sopravvivono a un
// riavvio, messaggi che raccontano la causa sbagliata.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  apriPannelloPieno, chiudiPannelloPieno, ascoltaPannelloPieno, pannelliAperti,
} from '../app/lib/pannelloPieno.js';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');

describe('la crittografia accesa resta accesa dopo il riavvio', () => {
  it('l\'interruttore E2E scrive con savePrefs, non con setPrefs', () => {
    // Era l'UNICA riga di quella schermata a usare setPrefs: aggiornava lo
    // stato in memoria e non toccava il disco. Si accendeva la crittografia,
    // si chiudeva l'applicazione, e la si ritrovava spenta senza un avviso.
    const s = leggi('app/components/SettingsView.js');
    expect(s).toMatch(/savePrefs\(\{ \.\.\.prefs, e2eEncryption: !prefs\.e2eEncryption \}\)/);
    expect(s).not.toMatch(/setPrefs\(\{ \.\.\.prefs, e2eEncryption/);
  });

  it('e in quella schermata setPrefs non si prende nemmeno piu', () => {
    // Tolto dalla destrutturazione: la stessa svista non puo tornare.
    expect(leggi('app/components/SettingsView.js')).not.toMatch(/const \{ L, S, prefs, setPrefs,/);
  });
});

describe('un pannello che copre lo schermo lo dichiara', () => {
  beforeEach(() => { while (pannelliAperti() > 0) chiudiPannelloPieno(); });

  it('e un contatore, non un interruttore: due pannelli sovrapposti reggono', () => {
    apriPannelloPieno(); apriPannelloPieno();
    expect(pannelliAperti()).toBe(2);
    chiudiPannelloPieno();
    // Chiudendone uno, l'altro copre ancora: un booleano avrebbe spento tutto.
    expect(pannelliAperti()).toBe(1);
    chiudiPannelloPieno();
    expect(pannelliAperti()).toBe(0);
  });

  it('non scende mai sotto zero (una chiusura di troppo non fa danni)', () => {
    chiudiPannelloPieno(); chiudiPannelloPieno();
    expect(pannelliAperti()).toBe(0);
  });

  it('chi ascolta riceve subito lo stato di adesso, non solo i cambi', () => {
    apriPannelloPieno();
    let visto = null;
    const stop = ascoltaPannelloPieno((v) => { visto = v; });
    expect(visto).toBe(true);
    stop();
    chiudiPannelloPieno();
  });

  it('il banner d\'installazione si toglie di mezzo', () => {
    const s = leggi('app/components/InstallaApp.js');
    expect(s).toMatch(/if \(!pwa\?\.showInstallBanner \|\| pannelloPieno\) return null;/);
  });

  it('e i pannelli del Mondo si dichiarano davvero', () => {
    const s = leggi('app/components/MondoNews.js');
    expect(s).toMatch(/apriPannelloPieno\(\)/);
    expect(s).toMatch(/return \(\) => chiudiPannelloPieno\(\)/);
    // La dichiarazione deve valere per TUTTI E TRE i pannelli, non solo uno.
    expect(s).toMatch(/if \(!discAperta && !personaAperta && !scheda\) return;/);
  });
});

describe('il pulsante Segui non torna piu indietro in silenzio', () => {
  it('un rifiuto del server conta come fallimento, non solo la rete caduta', () => {
    for (const f of ['app/components/MondoDiscussioni.js', 'app/components/MondoPersona.js']) {
      expect(leggi(f), f).toMatch(/if \(!r\.ok\) throw new Error\('rifiutato'\)/);
    }
  });

  it('e in tutti e due i posti si dice che non e riuscito', () => {
    expect(leggi('app/components/MondoDiscussioni.js')).toMatch(/setErrore\(L\('genericError'\)\)/);
    const p = leggi('app/components/MondoPersona.js');
    expect(p).toMatch(/setErroreSegui\(L\('genericError'\)\)/);
    expect(p).toMatch(/role="alert"/);   // e si vede davvero a schermo
  });
});

describe('due cause diverse non hanno piu lo stesso messaggio', () => {
  it('senza account si dice che serve un account, non "la ricerca e fallita"', () => {
    const s = leggi('app/components/MondoNews.js');
    expect(s).toMatch(/if \(!userToken\) \{ setErrore\('account'\); return; \}/);
    expect(s).toMatch(/errore === 'account' \? L\('accessToCreate'\) : L\('newsError'\)/);
  });

  it('e lo stato non e piu un booleano che confonde i due casi', () => {
    expect(leggi('app/components/MondoNews.js')).not.toMatch(/setErrore\(true\)/);
  });
});

describe('le etichette delle stanze parlano la lingua dell\'utente', () => {
  it('non sono piu scritte a mano in inglese', () => {
    const s = leggi('app/components/MondoView.js');
    expect(s).toMatch(/conversation: \{ labelKey: 'conversation'/);
    expect(s).toMatch(/simultaneous: \{ labelKey: 'simultaneous'/);
    expect(s).not.toMatch(/conversation: \{ label: 'Chat'/);
  });

  it('e usano le STESSE chiavi della barra dentro la stanza', () => {
    // Altrimenti la stessa modalita si chiamerebbe in due modi diversi in
    // due schermate: e successo con "Free Talk" / "freeTalk".
    const costanti = leggi('app/lib/constants.js');
    for (const chiave of ['conversation', 'classroom', 'freeTalk', 'simultaneous']) {
      expect(costanti, chiave).toContain(`nameKey:'${chiave}'`);
    }
  });

  it('le chiavi esistono in tutte e 15 le lingue', () => {
    for (const l of ['it','en','es','fr','de','pt','zh','ja','ko','th','ar','hi','ru','tr','vi']) {
      const d = leggi(`app/lib/locales/${l}.js`);
      for (const chiave of ['conversation', 'classroom', 'freeTalk', 'simultaneous']) {
        expect(d, `${l}/${chiave}`).toContain(`"${chiave}"`);
      }
    }
  });

  it('per le modalita tolte (b.126) resta l\'identificativo, non una bugia tradotta', () => {
    const s = leggi('app/components/MondoView.js');
    expect(s).toMatch(/interview:\s*\{ label: 'Interview'/);
    expect(s).toMatch(/const nomeModalita = \(info, L\) => \(info\?\.labelKey \? L\(info\.labelKey\) : \(info\?\.label \|\| ''\)\)/);
  });
});
