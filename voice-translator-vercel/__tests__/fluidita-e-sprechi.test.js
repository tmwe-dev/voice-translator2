// ═══════════════════════════════════════════════════════════════
// QUELLO CHE RENDEVA IL PROGRAMMA LENTO (b.111)
//
// Nessuno di questi era un errore visibile. Erano sprechi: lavoro
// fatto e buttato, domande fatte una dopo l'altra quando potevano
// essere fatte insieme, disegni fatti dove nessuno guardava.
//
// Piu una traduzione sbagliata servita con sicurezza, che si nascondeva
// dentro una funzione chiamata "hash" e che hash non era.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { getSimpleHash } from '../app/lib/translateValidation.js';

const app = (p) => fs.readFileSync(path.join(__dirname, '..', 'app', p), 'utf8');
const senzaCommenti = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('la finta impronta che serviva traduzioni sbagliate', () => {
  it('due frasi che cominciano uguali NON finiscono nella stessa casella', () => {
    // Il vecchio "hash" era il testo in base64 tagliato a 32 caratteri,
    // cioe i primi 24 caratteri del testo. Queste due frasi avevano la
    // stessa chiave, e la seconda persona riceveva la traduzione della
    // prima — con il cognome sbagliato dentro.
    const a = 'Buongiorno, come sta oggi signora Rossi?';
    const b = 'Buongiorno, come sta oggi signora Bianchi?';
    expect(a.slice(0, 24)).toBe(b.slice(0, 24));   // cominciano identiche
    expect(getSimpleHash(a)).not.toBe(getSimpleHash(b));
  });

  it('non contiene il testo: e un\'impronta, non un travestimento', () => {
    const impronta = getSimpleHash('Buongiorno');
    expect(impronta).not.toContain('Buongiorno');
    expect(Buffer.from(impronta, 'hex').length).toBeGreaterThan(0);
    expect(impronta).toMatch(/^[0-9a-f]{32}$/);
  });

  it('la differenza di UN carattere in fondo cambia tutto', () => {
    const lunga = 'x'.repeat(200);
    expect(getSimpleHash(lunga + 'a')).not.toBe(getSimpleHash(lunga + 'b'));
  });

  it('resta uguale a se stessa', () => {
    expect(getSimpleHash('Ciao')).toBe(getSimpleHash('Ciao'));
  });

  it('esiste in UN posto solo, non tre copie', () => {
    for (const rotta of ['api/translate-free/route.js', 'api/translate-consensus/route.js']) {
      const r = senzaCommenti(app(rotta));
      expect(r, `${rotta} non deve avere la sua copia`)
        .not.toMatch(/function getSimpleHash/);
      expect(r).toMatch(/import \{ getSimpleHash \}/);
    }
  });
});

describe('a schermo spento non si martella il server', () => {
  it('la visibilita entra nel conto dell\'intervallo', () => {
    const p = app('hooks/useRoomPolling.js');
    expect(p).toMatch(/FRENO_A_SCHERMO_SPENTO/);
    expect(p).toMatch(/document\.hidden/);
    expect(p, 'si ascolta il cambio di visibilita')
      .toMatch(/addEventListener\('visibilitychange'/);
    expect(p, 'e si smette di ascoltare uscendo')
      .toMatch(/removeEventListener\('visibilitychange'/);
  });

  it('tornando si guarda subito, non al prossimo giro', () => {
    const p = senzaCommenti(app('hooks/useRoomPolling.js'));
    expect(p).toMatch(/if \(!paginaNascosta\(\)\) \{ try \{ pollFnRef\.current\(\)/);
  });

  it('si rallenta, non si spegne: le notifiche devono continuare ad arrivare', () => {
    // useNotifications avvisa PROPRIO quando la pagina e nascosta.
    // Fermare il polling la zittirebbe.
    expect(app('hooks/useNotifications.js')).toMatch(/document\.hidden/);
    const p = app('hooks/useRoomPolling.js');
    const freno = Number(p.match(/FRENO_A_SCHERMO_SPENTO = (\d+)/)?.[1]);
    expect(freno).toBeGreaterThan(1);
    expect(freno, 'troppo lento e come essere spenti').toBeLessThanOrEqual(20);
  });
});

describe('non si rilegge tutta la conversazione ogni secondo e mezzo', () => {
  it('si pesca solo la coda quando si chiede "cosa c\'e di nuovo"', () => {
    const s = app('lib/store.js');
    expect(s).toMatch(/CODA_MESSAGGI/);
    expect(s, 'la coda si legge con indici negativi')
      .toMatch(/LRANGE', key, -CODA_MESSAGGI, -1/);
  });

  it('al primo caricamento si legge tutto: la scorciatoia non vale li', () => {
    const s = senzaCommenti(app('lib/store.js'));
    expect(s).toMatch(/if \(!after\) \{[\s\S]{0,200}LRANGE', key, 0, -1/);
  });

  it('se la coda non basta si rilegge tutto: meglio una lettura in piu che un messaggio perso', () => {
    const s = senzaCommenti(app('lib/store.js'));
    expect(s).toMatch(/coda\.length >= CODA_MESSAGGI && recenti\.length === coda\.length/);
  });
});

describe('le domande indipendenti si fanno insieme', () => {
  it('cache e glossario partono nello stesso momento', () => {
    const r = senzaCommenti(app('api/translate/route.js'));
    expect(r).toMatch(/const chiestaCache =/);
    expect(r).toMatch(/const chiestoGlossario =/);
    // La vecchia attesa in mezzo al percorso non deve tornare.
    expect(r, 'il glossario non si chiede piu dopo resolveAuth')
      .not.toMatch(/await redis\('GET', `glossary:/);
  });

  it('una promessa avviata e non attesa ha sempre il suo catch', () => {
    // Senza, se fallisce mentre la cache risponde, il processo fa rumore.
    const r = app('api/translate/route.js');
    expect(r).toMatch(/chiestoGlossario = userToken[\s\S]{0,160}\.catch\(/);
    expect(r).toMatch(/chiestaCache = cacheKey[\s\S]{0,160}\.catch\(/);
  });
});

describe('la voce premium non si regala piu', () => {
  it('si chiede il permesso col conto vero, prima di spendere', () => {
    const r = senzaCommenti(app('api/tts-elevenlabs/route.js'));
    expect(r).toMatch(/preventivoVocePremium\(cleanText\.length\)/);
    // b.157 — la voce premium e' l'unico fornitore per cui un guasto
    // nella lettura del saldo BLOCCA invece di procedere gratis (vedi
    // test sotto: creditoFinito con {failClosed:true} come gate rapido
    // prima ancora di scegliere la voce).
    expect(r).toMatch(/creditoFinito\(pagante, \{ failClosed: true \}\)/);
    // b.164 — il preventivo non si limita piu a un controllo di sola
    // lettura: apre una riserva ATOMICA (fail-closed di suo, vedi
    // wallet/riserva.js) che chiude anche la finestra di corsa fra
    // due richieste concorrenti, non solo il bypass ripetibile.
    expect(r).toMatch(/riserva\(pagante, costoPrevisto/);
  });

  it('il preventivo usa lo STESSO conto dell\'addebito', () => {
    // Se i due conti divergessero si bloccherebbe chi puo pagare, o si
    // lascerebbe passare chi non puo: il difetto tornerebbe da un'altra
    // porta.
    //
    // b.627 — il secondo controllo cercava `addebitaVocePremium`, il
    // vecchio addebito-dopo-il-fornitore, tolto. Oggi i due conti non
    // possono divergere per una ragione piu forte di prima: la riserva
    // e' calcolata con preventivoVocePremium, quindi il numero chiesto
    // prima e' letteralmente il numero pagato dopo.
    const a = app('wallet/addebita.js');
    expect(a).toMatch(/export function preventivoVocePremium[\s\S]{0,200}costoElevenLabsCaratteri/);
    const rotta = app('api/tts-elevenlabs/route.js');
    expect(rotta).toContain('preventivoVocePremium(cleanText.length)');
    expect(rotta).toMatch(/riserva\(pagante,\s*costoPrevisto/);
  });

  it('senza saldo leggibile non si blocca nessuno, salvo chi lo chiede espressamente', () => {
    // Meglio un uso non fatturato che un servizio rotto: l'addebito
    // vero dopo resta comunque il controllo definitivo. b.157 — questa
    // resta la regola di DEFAULT (opzioni = {} → !!undefined → false):
    // solo chi passa {failClosed:true} esplicitamente (oggi solo la
    // voce premium ElevenLabs, vedi test sopra) blocca sul guasto.
    const a = app('wallet/addebita.js');
    expect(a).toMatch(/creditoFinito\(utente, opzioni = \{\}\)/);
    expect(a).toMatch(/creditoInsufficiente\(utente, costoPrevisto, opzioni = \{\}\)/);
    expect(a).toMatch(/creditoFinito[\s\S]{0,400}catch[\s\S]{0,150}return !!opzioni\.failClosed/);
    expect(a)
      .toMatch(/creditoInsufficiente[\s\S]{0,400}catch[\s\S]{0,150}return !!opzioni\.failClosed/);
  });
});

describe('il velo non ruba la macchina a chi sta parlando', () => {
  it('nelle schermate di conversazione lo sciame non c\'e', () => {
    const p = app('page.js');
    expect(p).toMatch(/SCHERMATE_SENZA_VELO/);
    for (const v of ['room', 'speaker']) {
      expect(p).toMatch(new RegExp(`SCHERMATE_SENZA_VELO = new Set\\(\\[[^\\]]*'${v}'`));
    }
    expect(p).toMatch(/!SCHERMATE_SENZA_VELO\.has\(view\) && <Sciame/);
  });

  it('lo sfondo CSS invece resta ovunque: non costa niente', () => {
    const p = senzaCommenti(app('page.js'));
    expect(p).toMatch(/<SpatialBackdrop \/>/);
    // Deve stare FUORI dalla condizione del velo.
    expect(p).not.toMatch(/SCHERMATE_SENZA_VELO\.has\(view\) && <SpatialBackdrop/);
  });
});

describe('la memoizzazione del contesto non e piu annullata', () => {
  it('savePrefs e stabile fra un render e l\'altro', () => {
    // Era una `function` normale: un oggetto nuovo ogni volta. Finiva
    // nelle dipendenze di AppContext, quindi il contesto risultava
    // cambiato SEMPRE e tutti i componenti si ridisegnavano a ogni
    // battuta di tasto.
    const p = app('page.js');
    expect(p).toMatch(/const savePrefs = useCallback\(/);
    expect(senzaCommenti(p), 'non deve tornare a essere una function nuda')
      .not.toMatch(/^\s{2}function savePrefs\(/m);
  });

  it('il contesto dipende da valori, non da oggetti ricreati', () => {
    const c = app('contexts/AppContext.js');
    expect(c).toMatch(/useMemo/);
    // Le dipendenze devono essere i campi, non l'oggetto `value.auth`.
    expect(c).toMatch(/value\.auth\?\.userToken/);
    expect(c).not.toMatch(/\}\), \[[^\]]*\bvalue\.auth,/);
  });
});
