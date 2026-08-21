// ═══════════════════════════════════════════════════════════════
// CHIUDERE UNA CHIAMATA, E RITROVARE LA STANZA (b.116)
//
// Due difetti trovati provando in due, e nessuno dei due si vede
// leggendo il codice: bisogna che UNO chiuda e l'ALTRO no.
//
// ── 1. LA TELECAMERA CHE SI RIACCENDE ──
//
// Chi preme CHIUDI provoca la stessa cosa che provoca una rete che
// cade: la connessione si interrompe. Il codice non distingueva le due
// cose e trattava ogni interruzione come un guasto, quindi ricomponeva
// la chiamata da solo — e per rifarla RIACCENDEVA LA TELECAMERA di chi
// aveva appena chiuso.
//
// Non e una scomodita: e riservatezza. Uno chiude, si alza, e la sua
// telecamera torna accesa senza che nessuno gliel'abbia chiesto.
// Succedeva solo se l'altro restava dentro — cioe nel caso piu comune,
// perche di solito uno saluta e chiude per primo.
//
// ── 2. LA STANZA CHE SPARISCE ──
//
// Uscendo, la stanza resta in un elenco per poterci rientrare. A ogni
// avvio quell'elenco viene ricontrollato col server. Ma bastava che il
// controllo FALLISSE — rete incerta, 401, limite di frequenza — perche
// la riga sparisse: il `catch {}` si mangiava l'errore e subito dopo
// l'elenco filtrato veniva scritto sopra quello salvato.
//
// Un singhiozzo di rete, e la conversazione lasciata a meta era persa
// per sempre. Senza un avviso.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const app = (p) => fs.readFileSync(path.join(__dirname, '..', 'app', p), 'utf8');
const senzaCommenti = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('chi chiude ha chiuso: la telecamera non si riaccende', () => {
  const w = () => senzaCommenti(app('hooks/useWebRTC.js'));

  it('esiste il modo di distinguere "ho riagganciato" da "e caduta la linea"', () => {
    expect(w()).toMatch(/chiusuraVolutaRef/);
  });

  it('premere CHIUDI lo dichiara', () => {
    const s = w();
    const i = s.indexOf('const disconnect = useCallback');
    expect(s.slice(i, i + 400)).toMatch(/chiusuraVolutaRef\.current = true/);
  });

  it('e ferma i temporizzatori gia avviati', () => {
    // Senza, una riconnessione gia in coda partirebbe lo stesso e
    // riaccenderebbe la telecamera qualche secondo dopo.
    const s = w();
    const i = s.indexOf('const disconnect = useCallback');
    const corpo = s.slice(i, i + 500);
    expect(corpo).toMatch(/autoReconnectTimerRef\.current\)/);
    expect(corpo).toMatch(/disconnectTimerRef\.current\)/);
  });

  it('il gestore degli stati di rete si ferma se la chiusura e voluta', () => {
    expect(w()).toMatch(/else if \(chiusuraVolutaRef\.current\) \{[\s\S]{0,200}return;/);
  });

  it('e la riconnessione automatica ha la sua guardia', () => {
    // Due difese invece di una: se un giorno il primo controllo venisse
    // spostato o tolto, la telecamera resta comunque spenta.
    const s = w();
    const i = s.indexOf('function attemptAutoReconnect');
    expect(s.slice(i, i + 220)).toMatch(/if \(chiusuraVolutaRef\.current\) return;/);
  });

  it('ma una chiamata NUOVA riapre la porta', () => {
    // Curare questo difetto creandone uno peggiore — "dopo aver chiuso
    // una volta non puoi piu chiamare" — sarebbe stato facilissimo.
    const s = w();
    for (const funzione of ['const initiateConnection', 'const acceptIncomingCall']) {
      const i = s.indexOf(funzione);
      expect(i, `${funzione} deve esistere`).toBeGreaterThan(-1);
      expect(s.slice(i, i + 500), `${funzione} deve azzerare il flag`)
        .toMatch(/chiusuraVolutaRef\.current = false/);
    }
  });
});

describe('b.117 · il rimedio di b.116 non bastava, e il collaudo lo ha detto subito', () => {
  const w = () => senzaCommenti(app('hooks/useWebRTC.js'));

  // In b.116 avevo fermato la riconnessione di CHI CHIUDE. Ma il difetto
  // arrivava dall'altra parte: chi RESTA vede cadere la linea, la
  // scambia per un guasto e manda una nuova offerta. E chi ha chiuso la
  // accettava in automatico, per compatibilita — riaprendo la
  // videochiamata e riaccendendo la telecamera.
  //
  // Fermare meta di un dialogo non serve: bisogna dirlo all'altro.

  it('chi chiude AVVISA l\'altro', () => {
    const s = w();
    const i = s.indexOf('const disconnect = useCallback');
    expect(s.slice(i, i + 700)).toMatch(/sendSignal\('call-ended'/);
  });

  it('chi resta riceve l\'avviso e non tenta nulla', () => {
    const s = w();
    const i = s.indexOf("if (type === 'call-ended')");
    expect(i, 'il segnale deve essere gestito').toBeGreaterThan(-1);
    const corpo = s.slice(i, i + 800);
    expect(corpo, 'niente altri tentativi').toMatch(/autoReconnectAttemptRef\.current = MAX_AUTO_RECONNECTS/);
    expect(corpo).toMatch(/cleanup\(\)/);
    expect(corpo).toMatch(/setWebrtcState\('idle'\)/);
  });

  it('chi ha chiuso rifiuta le offerte NON richieste', () => {
    // E la porta da cui rientrava la videochiamata: un'offerta arrivata
    // senza che nessuno abbia chiesto una chiamata veniva accettata "per
    // compatibilita".
    // Qui si legge il sorgente GREZZO: il punto di riferimento e un
    // commento, e senzaCommenti lo toglierebbe. Ci sono cascato scrivendo
    // il test la prima volta.
    const s = app('hooks/useWebRTC.js');
    const i = s.indexOf('Direct offer (no call-request)');
    expect(i, 'il ramo dell\'offerta non richiesta deve esistere').toBeGreaterThan(-1);
    expect(s.slice(i - 700, i)).toMatch(/if \(chiusuraVolutaRef\.current\) \{[\s\S]{0,320}return;/);
  });

  it('tre difese, non una: se ne salta una, le altre reggono', () => {
    const s = w();
    // 1. il gestore degli stati  2. la riconnessione  3. le offerte non richieste
    expect((s.match(/chiusuraVolutaRef\.current/g) || []).length).toBeGreaterThanOrEqual(5);
  });

  it('sendSignal e fra le dipendenze di disconnect, e solo li', () => {
    // Metterlo anche in un effetto che gira PRIMA che sendSignal esista
    // farebbe esplodere la pagina al primo render. C'e andato vicino.
    const grezzo = app('hooks/useWebRTC.js');
    const righe = grezzo.split('\n');
    const posSendSignal = righe.findIndex(r => /const sendSignal = useCallback/.test(r));
    righe.forEach((r, n) => {
      if (/\[cleanup, sendSignal\]/.test(r)) {
        expect(n, 'una dipendenza non puo precedere cio da cui dipende').toBeGreaterThan(posSendSignal);
      }
    });
  });
});

describe('una stanza si toglie solo se il server lo dice', () => {
  const h = () => senzaCommenti(app('components/HomeView.js'));

  it('un controllo fallito NON cancella la stanza', () => {
    const s = h();
    expect(s, 'una risposta non riuscita conserva').toMatch(/if \(!res\.ok\) \{ rimaste\.push\(room\); continue; \}/);
    // b.363 — questa prova pretendeva che la conservazione fosse la PRIMA
    // riga del ramo d'errore. Da oggi quel ramo annota anche il motivo del
    // guasto nel registro, e la forma esatta non combacia piu: ma cio che
    // conta non e l'ordine delle righe, e che la stanza non venga persa.
    // Si guarda quindi il ramo intero, e si pretende che finisca per
    // rimetterla nell'elenco e che non la scarti in nessun modo.
    const ciclo = s.slice(
      s.indexOf('for (const room of saved)'),
      s.indexOf("memSet('vt-active-rooms'")
    );
    expect(ciclo, 'il ciclo di controllo deve esistere').toContain('} catch');
    const ramoErrore = ciclo.slice(ciclo.lastIndexOf('} catch'));
    expect(ramoErrore, 'e anche un errore di rete conserva').toMatch(/rimaste\.push\(room\)/);
    expect(ramoErrore, 'nel dubbio non si toglie e non si riscrive l\'elenco')
      .not.toMatch(/rimaste\s*=|\.filter\(|\.splice\(/);
  });

  it('si toglie solo su una risposta ESPLICITA', () => {
    // `data.exists === false` e non `!data.exists`: una risposta
    // malformata o vuota non deve valere come "non esiste".
    expect(h()).toMatch(/data\.exists === false \|\| data\.ended === true/);
  });

  it('il vecchio filtro che cancellava nel dubbio non c\'e piu', () => {
    const s = h();
    expect(s).not.toMatch(/if \(data\.exists && !data\.ended\) checked\.push/);
    expect(s).not.toMatch(/JSON\.stringify\(checked\)/);
  });

  it('chi esce senza chiudere lascia davvero traccia', () => {
    const p = senzaCommenti(app('page.js'));
    const i = p.indexOf('function leaveRoomTemporary');
    const corpo = p.slice(i, i + 900);
    expect(corpo).toMatch(/vt-active-rooms/);
    expect(corpo, 'serve il codice della stanza per rientrarci').toMatch(/roomId: roomPolling\.roomId/);
  });
});
