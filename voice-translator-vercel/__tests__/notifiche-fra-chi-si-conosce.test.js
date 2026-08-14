// ═══════════════════════════════════════════════════════════════
// UN ORECCHIO SENZA BOCCA (b.134)
//
// Luca ha chiesto di poter installare l'applicazione e di far arrivare
// avvisi fra utenti che si conoscono. Guardando cosa c'era davvero, il
// quadro era questo: quasi tutto costruito, niente collegato.
//
// ── COSA C'ERA GIA E FUNZIONAVA ──
//
// manifest.json completo (standalone, icone da 72 a 512) e sw.js
// registrato SEMPRE, senza condizioni. L'applicazione era gia
// installabile da mesi, e nessuno lo diceva all'utente.
//
// E in sw.js:85 un gestore `push` completo — badge, vibrazione, azioni
// "Apri chat" e "Ignora", click che riapre la stanza giusta. Pronto a
// ricevere. Non c'era una sola riga, in nessun file, che SPEDISSE.
// Un orecchio senza bocca.
//
// ── I QUATTRO ANELLI ROTTI ──
//
// 1. page.js prendeva UN campo solo da usePWAInstall:
//        const { notifPermission } = pwa;
//    Gli altri quattro non li usava nessuno. Quindi il banner non
//    compariva mai, il permesso non veniva MAI chiesto, e a valle
//    useNotifications.js:27 aspettava 'granted': taceva perfino la
//    notifica LOCALE del messaggio a scheda nascosta.
//
// 2. /api/push-subscribe teneva le iscrizioni in `new Map()`. Su Vercel
//    ogni invocazione puo essere un processo nuovo: un secchio bucato.
//    Il commento nel file lo ammetteva.
//
// 3. Nessuno chiamava /api/push-subscribe. Zero iscrizioni, mai.
//
// 4. La chiave VAPID pubblica era un segnaposto copiato da un esempio,
//    senza la privata. Con una chiave finta il browser ACCETTA
//    l'iscrizione e poi non arriva niente: il modo peggiore di
//    fallire, perche non si capisce da dove venga il silenzio.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');
const senzaCommenti = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('l\'hook dell\'installazione non e piu scollegato', () => {
  const pagina = () => senzaCommenti(leggi('app/page.js'));

  it('il banner viene davvero disegnato', () => {
    expect(pagina()).toMatch(/<InstallaApp pwa=\{pwa\}/);
  });

  it('e sta nell\'unico imbuto, non appeso a un ramo solo', () => {
    // `{bottomNav}` compare in sedici punti diversi: appenderlo li
    // avrebbe voluto dire dimenticarlo in qualcuno. `wrap` e uno.
    const s = pagina();
    const i = s.indexOf('const wrap = (node) =>');
    expect(i).toBeGreaterThan(-1);
    expect(s.slice(i, i + 500)).toMatch(/<InstallaApp/);
  });

  it('ma non durante una conversazione', () => {
    // Coprirebbe il campo di scrittura proprio mentre si parla.
    const s = pagina();
    const i = s.indexOf('<InstallaApp');
    expect(s.slice(i - 120, i)).toMatch(/SCHERMATE_SENZA_VELO\.has\(view\)/);
  });

  it('il banner offre le due strade, non una sola', () => {
    const b = leggi('app/components/InstallaApp.js');
    expect(b, 'la scelta deve essere vera').toMatch(/Resta nel browser/);
    expect(b).toMatch(/dismissInstallBanner/);
    expect(b).toMatch(/handleInstallApp/);
  });

  it('e su iPhone spiega come si fa invece di mostrare un bottone finto', () => {
    // Safari non implementa `beforeinstallprompt`: un bottone "Installa"
    // li non avrebbe niente da chiamare. E proprio su iPhone installare
    // e l'UNICO modo di ricevere avvisi.
    const b = senzaCommenti(leggi('app/components/InstallaApp.js'));
    expect(b).toMatch(/eIPhone/);
    expect(b).toMatch(/Aggiungi a Home/);
  });
});

describe('il permesso si chiede quando ha senso chiederlo', () => {
  it('non all\'avvio', () => {
    // Chiederlo senza contesto e il modo migliore per farselo negare:
    // il browser ricorda il rifiuto e non lo richiede piu.
    const s = senzaCommenti(leggi('app/page.js'));
    const i = s.indexOf('pwa.iscriviAllePush');
    expect(i, 'l\'iscrizione deve esserci').toBeGreaterThan(-1);
    expect(s.slice(i - 400, i)).toMatch(/Notification\.permission !== 'granted'\) return/);
  });

  it('ma dal banner, dove l\'utente lo ha appena chiesto', () => {
    expect(senzaCommenti(leggi('app/components/InstallaApp.js')))
      .toMatch(/requestNotifPermission/);
  });

  it('e installare non basta: sono due permessi distinti', () => {
    const b = senzaCommenti(leggi('app/components/InstallaApp.js'));
    const i = b.indexOf('await pwa.handleInstallApp()');
    expect(i).toBeGreaterThan(-1);
    expect(b.slice(i, i + 200)).toMatch(/requestNotifPermission/);
  });
});

describe('le iscrizioni non stanno piu in un secchio bucato', () => {
  const rotta = () => senzaCommenti(leggi('app/api/push-subscribe/route.js'));

  it('la Map in memoria non c\'e piu', () => {
    expect(rotta(), 'su Vercel ogni invocazione puo essere un processo nuovo')
      .not.toMatch(/const subscriptions = new Map\(\)/);
  });

  it('vivono su Redis, accanto ai contatti', () => {
    const s = rotta();
    expect(s).toMatch(/push:\$\{String\(email\)\.toLowerCase\(\)\}/);
    expect(s).toMatch(/redis\('SADD', chiave/);
    expect(s).toMatch(/redis\('EXPIRE', chiave/);
  });

  it('e l\'identita si dimostra, non si dichiara', () => {
    // Prima bastava mandare uno `userId` qualsiasi nel corpo per
    // scrivere l'iscrizione di chiunque, e farsi recapitare le
    // notifiche altrui.
    const s = rotta();
    expect(s).toMatch(/const session = await getSession\(token\)/);
    expect(s, 'niente piu userId preso dal corpo').not.toMatch(/const key = userId \|\|/);
  });

  it('un\'iscrizione senza chiavi viene rifiutata', () => {
    // Senza p256dh e auth il messaggio non e cifrabile: un\'iscrizione
    // monca fa credere di essere raggiungibili e non lo si e.
    expect(rotta()).toMatch(/subscription\?\.keys\?\.p256dh \|\| !subscription\?\.keys\?\.auth/);
  });

  it('e la chiave finta non c\'e piu', () => {
    expect(rotta(), 'con una chiave segnaposto il browser accetta e poi tace')
      .not.toMatch(/BEl62iUYgUivxIkv69yViEuiBIa/);
  });
});

describe('adesso esiste chi spedisce', () => {
  const lib = () => senzaCommenti(leggi('app/lib/notifichePush.js'));

  it('il modulo di invio esiste e usa web-push', () => {
    expect(lib()).toMatch(/import\('web-push'\)/);
    expect(lib()).toMatch(/sendNotification/);
  });

  it('web-push e fra le dipendenze', () => {
    // Non c\'era: senza questo il modulo esplode al primo invio.
    const pkg = JSON.parse(leggi('package.json'));
    expect(pkg.dependencies['web-push']).toBeTruthy();
  });

  it('le iscrizioni morte vengono tolte, non ritentate all\'infinito', () => {
    // Ci si ancora al punto giusto: il primo `catch (e)` del file e
    // quello della lettura da Redis, non quello dell'invio.
    const s = lib();
    const i = s.indexOf('const stato = e?.statusCode');
    expect(i, 'il ramo che guarda lo stato deve esistere').toBeGreaterThan(-1);
    expect(s.slice(i, i + 500)).toMatch(/stato === 404 \|\| stato === 410/);
    expect(s.slice(i, i + 500)).toMatch(/redis\('SREM'/);
  });

  it('e senza chiavi non esplode: risponde che non e configurato', () => {
    expect(lib()).toMatch(/chiavi VAPID non configurate/);
  });
});

describe('si avvisano solo le persone che si conoscono', () => {
  const lib = () => senzaCommenti(leggi('app/lib/notifichePush.js'));
  const rotta = () => senzaCommenti(leggi('app/api/push-send/route.js'));

  it('il legame si verifica in tutte e due le direzioni', () => {
    const s = lib();
    const i = s.indexOf('export async function siConoscono');
    const corpo = s.slice(i, i + 800);
    expect(corpo).toMatch(/SISMEMBER`?', `contacts:\$\{a\}`, b/);
    expect(corpo).toMatch(/SISMEMBER`?', `contacts:\$\{b\}`, a/);
    expect(corpo).toMatch(/Number\(aHaB\) === 1 && Number\(bHaA\) === 1/);
  });

  it('e nel dubbio non si notifica', () => {
    // Il silenzio e un fastidio, una notifica a uno sconosciuto e un danno.
    const s = lib();
    const i = s.indexOf('export async function siConoscono');
    expect(s.slice(i, i + 900)).toMatch(/catch[\s\S]{0,200}return false/);
  });

  it('la rotta chiude la porta prima di spedire', () => {
    const s = rotta();
    const iCancello = s.indexOf('await siConoscono(');
    const iInvio = s.indexOf('await inviaPush(');
    expect(iCancello, 'il controllo deve esserci').toBeGreaterThan(-1);
    expect(iCancello, 'e venire PRIMA dell\'invio').toBeLessThan(iInvio);
  });

  it('il testo lo scrive il server, non chi chiama', () => {
    // Altrimenti il vincolo dei contatti servirebbe a poco: basterebbe
    // un contatto accettato una volta per cortesia per potergli
    // recapitare qualsiasi frase, a ripetizione, sulla schermata di
    // blocco.
    const s = rotta();
    expect(s).toMatch(/const AVVISI = \{/);
    expect(s, 'il tipo si sceglie fra i nostri, non si inventa')
      .toMatch(/const avviso = AVVISI\[tipo\]/);
    expect(s).toMatch(/Tipo di avviso sconosciuto/);
  });

  it('e nemmeno il nome del mittente arriva dalla richiesta', () => {
    // Nessuno deve poter comparire sul telefono altrui col nome di un terzo.
    const s = rotta();
    expect(s).toMatch(/const u = await getUser\(mittente\)/);
  });

  it('la porta chiusa risponde 403, non 404', () => {
    // Distinguere "non esiste" da "non e tuo contatto" trasformerebbe
    // questa rotta in un modo per scoprire chi e iscritto.
    const s = rotta();
    const i = s.indexOf('Si possono avvisare solo i propri contatti');
    expect(i).toBeGreaterThan(-1);
    expect(s.slice(i, i + 120)).toMatch(/status: 403/);
  });
});

// ═══════════════════════════════════════════════════════════════
// E POI L'HO PROVATO, E NON COMPARIVA (b.134-bis)
//
// Aperta la produzione su Chrome da computer: nessun banner.
// Interrogando la pagina dal vivo:
//
//   vt-install-dismissed : null      (nessuno l'aveva rifiutato)
//   display-mode         : browser   (non era installata)
//   serviceWorker        : attivo
//   PushManager          : presente
//   beforeinstallprompt  : MAI ARRIVATO
//   Notification.permission : "denied"
//
// Due difetti, e il primo era mio, della stessa classe di quello che
// stavo correggendo.
//
// ── PRIMO: AVEVO APPESO TUTTO A UN EVENTO NON GARANTITO ──
//
// Il banner si accendeva solo su `beforeinstallprompt`, oppure su
// iPhone. Ma Chrome quell'evento lo emette quando decide lui, dopo che
// considera l'utente abbastanza coinvolto, e su desktop spesso non lo
// emette affatto. Quindi: funzione costruita, collegata, e che non si
// accendeva mai — esattamente il difetto di usePWAInstall che avevo
// appena riparato, rifatto da me un'ora dopo.
//
// Ora la regola non dipende da nessun evento: non installata e non
// rifiutata, si propone. L'evento serve solo a decidere se il bottone
// installa da solo o se bisogna spiegare come si fa a mano.
//
// ── SECONDO: IL BOTTONE CHE NON FA NIENTE PER SEMPRE ──
//
// Con il permesso gia `denied`, `Notification.requestPermission()`
// torna subito 'denied' senza mostrare niente: il browser non lo
// richiede piu. L'utente avrebbe premuto un bottone morto all'infinito.
// Si riapre solo dal lucchetto accanto all'indirizzo, e va detto,
// perche nessuno lo indovina.
// ═══════════════════════════════════════════════════════════════
describe('il banner non dipende da un evento che puo non arrivare', () => {
  const hook = () => senzaCommenti(leggi('app/hooks/usePWAInstall.js'));

  it('si mostra a chi non ha installato e non ha detto di no', () => {
    const s = hook();
    expect(s).toMatch(/if \(!eInstallata\(\) && !localStorage\.getItem\('vt-install-dismissed'\)\)/);
  });

  it('e non solo su iPhone, come prima', () => {
    // Il vecchio ramo esigeva eIPhone(): su Chrome desktop, dove
    // l'evento non arriva, non restava nessuna strada.
    expect(hook()).not.toMatch(/if \(eIPhone\(\) && !eInstallata\(\)/);
  });
});

describe('nessun bottone che non fa niente', () => {
  const b = () => senzaCommenti(leggi('app/components/InstallaApp.js'));

  it('sa distinguere il permesso gia negato', () => {
    expect(b()).toMatch(/const bloccate = typeof Notification !== 'undefined' && Notification\.permission === 'denied'/);
  });

  it('e sa che senza invito del browser si installa a mano', () => {
    expect(b()).toMatch(/const aMano = !bloccate && !pwa\.puoInstallare/);
  });

  it('in tutti e due i casi spiega invece di chiamare il vuoto', () => {
    const s = b();
    expect(s).toMatch(/if \(bloccate \|\| aMano \|\| suIPhone\) \{ setIstruzioniAperte/);
    expect(s, 'e il testo del bottone cambia di conseguenza')
      .toMatch(/\(bloccate \|\| aMano \|\| suIPhone\)\s*\?\s*\(istruzioniAperte/);
  });

  it('e per le notifiche bloccate dice DOVE si riaprono', () => {
    expect(b()).toMatch(/lucchetto accanto all/);
  });
});
