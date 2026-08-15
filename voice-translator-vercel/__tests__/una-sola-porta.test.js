// ═══════════════════════════════════════════════════════════════
// UNA SOLA PORTA, E CHI PAGA SI DECIDE PRIMA (b.123)
//
// Due difetti segnalati da un audit esterno, verificati riga per riga
// e confermati. Hanno la stessa forma: non c'e un pezzo sbagliato, c'e
// un ORDINE sbagliato fra pezzi giusti. E il motivo per cui mille test
// verdi non li avevano sfiorati — nessuno di loro guarda la catena.
//
// ── 1. RIENTRARE IN UNA STANZA DIRETTA LA RENDEVA CLOUD ──
//
// Si entra in una stanza da tre parti, e tutte e tre applicavano le
// stesse regole per conto loro:
//
//     handleJoinRoom  ->  cambiaModalitaSessione(room.diretta ? ...)
//     creaStanza      ->  cambiaModalitaSessione(roomConfig.diretta ? ...)
//     rejoinRoom      ->  (niente)
//
// Uscendo, leaveRoomTemporary riporta a 'translate' — giusto: le regole
// di una conversazione riservata non si ereditano. Rientrando, nessuno
// le rimetteva. Una stanza con `diretta: true`, che a schermo continua
// a promettere "da telefono a telefono", ricominciava a mandare tutto
// ai nostri server.
//
// Non un errore di calcolo: una promessa disattesa, sull'unica cosa per
// cui uno sceglierebbe la Diretta.
//
// ── 2. LE COPPIE ASIATICHE NON PAGAVANO ──
//
// In /api/translate il routing del fornitore stava PRIMA
// dell'autorizzazione, e finiva con un `return`:
//
//     routeProvider() -> se Asia -> translateAsia() -> return
//     resolveAuth()        <- non ci si arrivava mai
//
// Quindi per cinese, giapponese e coreano si saltavano autenticazione,
// controllo credito, addebito, costo stanza e spesa giornaliera. E la
// risposta dichiarava `costEurCents: 0`, cosi nemmeno il monitoraggio
// poteva accorgersene.
//
// Non riguardava solo gli anonimi: anche chi aveva pagato vedeva i
// propri minuti non scalare. Io stesso l'avevo cercato e mancato,
// provando solo it→en — che passa dal ramo Global e si comporta bene.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');
const senzaCommenti = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('in una stanza si entra da una porta sola', () => {
  const p = () => senzaCommenti(leggi('app/page.js'));

  it('la politica della stanza esiste, ed e una', () => {
    expect(p()).toMatch(/const applicaPoliticaStanza = useCallback\(\(room\) => \{/);
  });

  it('e la modalita si decide li dentro, prima di ogni altra cosa', () => {
    const s = p();
    const i = s.indexOf('const applicaPoliticaStanza');
    const corpo = s.slice(i, i + 900);
    // b.139 — il ternario `room.diretta ? 'direct' : 'translate'` non e piu
    // scritto qui: era la stessa traduzione da stanza a modalita che vive
    // anche nel cancello e nelle rotte. Ora la fa `modalitaDiStanza()`, e la
    // guardia si sposta sulla chiamata invece che sulla riga.
    expect(corpo).toContain('cambiaModalitaSessione(modalitaDiStanza(room))');
    expect(corpo.indexOf('cambiaModalitaSessione'), 'prima di roomInfoRef')
      .toBeLessThan(corpo.indexOf('roomInfoRef.current = room'));
  });

  it('rientrare applica la politica: era questo il difetto', () => {
    const s = p();
    const i = s.indexOf('async function rejoinRoom');
    expect(i, 'rejoinRoom deve esistere').toBeGreaterThan(-1);
    expect(s.slice(i, i + 700), 'rientrando la Diretta va ripristinata')
      .toMatch(/applicaPoliticaStanza\(room\)/);
  });

  it('e nessun ingresso decide la modalita per conto suo', () => {
    // La riga dimenticata non e il difetto: il difetto e che la stessa
    // decisione fosse scritta in tre punti. Prima o poi uno resta
    // indietro, ed e sempre quello che si prova di meno.
    const s = p();
    // Chi decide la modalita dalla stanza deve essere uno solo. Si contano
    // sia la forma vecchia (il ternario a mano) sia quella nuova.
    const decisioni = [
      ...(s.match(/cambiaModalitaSessione\([^)]*\?[^)]*\)/g) || []),
      ...(s.match(/cambiaModalitaSessione\(modalitaDiStanza\([^)]*\)\)/g) || []),
    ];
    expect(decisioni.length, `la scelta direct/translate va fatta in un punto solo, trovata ${decisioni.length} volte`).toBe(1);
    // E il ternario non deve tornare a mano da nessuna parte in page.js.
    expect(s, 'la traduzione stanza→modalita si fa in decisioni.js')
      .not.toMatch(/diretta \? 'direct' : 'translate'/);
  });

  it('ma uscire continua ad azzerarla, in tutti e due i modi', () => {
    // Una conversazione riservata non lascia in eredita le sue regole
    // a quella dopo: questo comportamento non deve essersi perso.
    const s = p();
    expect((s.match(/cambiaModalitaSessione\('translate'\)/g) || []).length).toBe(2);
  });

  it('la politica e definita prima di chi la usa', () => {
    // Una const usata in una lista di dipendenze che gira prima della
    // sua definizione fa esplodere la pagina al primo render. C'e gia
    // andata vicina una volta, in b.117.
    const righe = leggi('app/page.js').split('\n');
    const definizione = righe.findIndex((r) => /const applicaPoliticaStanza = useCallback/.test(r));
    righe.forEach((r, n) => {
      if (/\[[^\]]*applicaPoliticaStanza[^\]]*\]/.test(r) && !/useCallback/.test(r)) {
        expect(n, 'una dipendenza non puo precedere cio da cui dipende').toBeGreaterThan(definizione);
      }
    });
  });
});

describe('chi paga si decide prima di scegliere il fornitore', () => {
  const t = () => senzaCommenti(leggi('app/api/translate/route.js'));

  it('resolveAuth viene PRIMA di routeProvider', () => {
    const s = t();
    const iAuth = s.indexOf('await resolveAuth({');
    const iRoute = s.indexOf('routeProvider(sourceLang, targetLang)');
    expect(iAuth, 'resolveAuth deve esserci').toBeGreaterThan(-1);
    expect(iRoute, 'routeProvider deve esserci').toBeGreaterThan(-1);
    expect(iAuth, 'mai il fornitore prima dell\'autorizzazione').toBeLessThan(iRoute);
  });

  it('il ramo Asia non esce piu dalla porta di servizio', () => {
    const s = t();
    const i = s.indexOf("providerRoute.provider === 'asia'");
    const corpo = s.slice(i, i + 900);
    expect(corpo, 'niente return dentro il ramo Asia').not.toMatch(/return NextResponse\.json/);
    expect(corpo).toMatch(/risultatoAsia = \{/);
  });

  it('e il suo risultato passa dalla stessa contabilita del Global', () => {
    // Duplicare l'addebito nel ramo Asia avrebbe risolto il sintomo e
    // lasciato due contabilita da tenere allineate. Qui ce n'e una.
    //
    // b.161-bis: l'addebito vero e' diventato il commit/release della
    // riserva presa prima del fornitore (vedi wallet-sicurezza-b161-bis
    // .test.js) — un solo punto di decisione, non piu una singola
    // chiamata addebitaTesto.
    const s = t();
    const iAsia = s.indexOf('risultatoAsia = {');
    const iAddebito = s.indexOf("if (billingEmail && !isOwnKey && !giaPagatoDavvero) {");
    expect(iAddebito, 'il punto di addebito deve esserci').toBeGreaterThan(-1);
    expect(iAsia, 'il ramo Asia viene prima e prosegue').toBeLessThan(iAddebito);
    expect((s.match(/if \(billingEmail && !isOwnKey && !giaPagatoDavvero\) \{/g) || []).length, 'un solo punto di decisione sull\'addebito').toBe(1);
  });

  it('il modello non viene chiamato due volte', () => {
    // Far proseguire il flusso senza questo avrebbe fatto pagare due
    // volte la stessa frase: curare un difetto creandone uno peggiore.
    const s = t();
    expect(s).toMatch(/if \(risultatoAsia\) \{[\s\S]{0,220}\} else \{[\s\S]{0,200}callLLMWithFallback/);
  });

  it('e il costo dichiarato da Asia entra nel conto', () => {
    // Asia non produce `usage`: senza questo il costo risulterebbe zero
    // e resterebbe solo l'addebito minimo.
    expect(t()).toMatch(/const gptCost = risultatoAsia[\s\S]{0,60}risultatoAsia\.cost/);
  });

  it('il vecchio costEurCents: 0 di comodo non c\'e piu', () => {
    const s = t();
    const i = s.indexOf("providerRoute.provider === 'asia'");
    expect(s.slice(i, i + 900)).not.toMatch(/costEurCents: 0/);
  });
});
