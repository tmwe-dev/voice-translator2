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

describe('una stanza si toglie solo se il server lo dice', () => {
  const h = () => senzaCommenti(app('components/HomeView.js'));

  it('un controllo fallito NON cancella la stanza', () => {
    const s = h();
    expect(s, 'una risposta non riuscita conserva').toMatch(/if \(!res\.ok\) \{ rimaste\.push\(room\); continue; \}/);
    expect(s, 'e anche un errore di rete conserva').toMatch(/catch \{\s*rimaste\.push\(room\);/);
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
