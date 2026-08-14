// ═══════════════════════════════════════════════════════════════
// LA PROMESSA DI RISERVATEZZA, VERIFICATA (b.111)
//
// Il referto esterno chiedeva: "verificare che la modalita diretta non
// chiami mai API cloud". Verificato. Il risultato e peggio di quanto
// il referto sospettasse.
//
// Il meccanismo c'era ed era ben disegnato: dodici rotte chiamavano
// `assertCloudProcessingAllowed(req)`, che legge l'intestazione
// `x-session-mode` e risponde 403 se vale "direct".
//
// Ma NESSUNA riga del programma mandava quell'intestazione. Cercata in
// tutto il codice: zero occorrenze fuori da sessionGuard.js. La
// guardia non e mai scattata, nemmeno una volta. E l'elenco
// `BLOCKED_IN_DIRECT` non era importato da nessun file.
//
// In modalita Diretta la voce registrata partiva lo stesso verso
// /api/transcribe. Il testo scritto no — quello era davvero fermato,
// perche useTranslationAPI controlla la modalita per conto suo. Quindi
// la promessa reggeva per la chat scritta e cadeva per la voce, che e
// poi il motivo per cui questo programma esiste.
//
// Questi test non guardano l'intenzione: guardano cosa esce dalla rete.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  montaCancelloDiretta, smontaCancello, impostaModalita, modalitaCorrente,
} from '../app/lib/modalitaSessione.js';
import { BLOCKED_IN_DIRECT } from '../app/lib/sessionGuard.js';

const app = (p) => fs.readFileSync(path.join(__dirname, '..', 'app', p), 'utf8');

let fetchOriginale;
let chiamate;

beforeEach(() => {
  chiamate = [];
  fetchOriginale = vi.fn(async (risorsa, opzioni = {}) => {
    const url = typeof risorsa === 'string' ? risorsa : risorsa.url;
    const h = new Headers(opzioni.headers || {});
    chiamate.push({ url, modo: h.get('x-session-mode') });
    return new Response('{}', { status: 200 });
  });
  global.fetch = fetchOriginale;
  window.fetch = fetchOriginale;
  smontaCancello();
  montaCancelloDiretta();
  impostaModalita('translate');
});

afterEach(() => {
  smontaCancello(fetchOriginale);
});

describe('l\'intestazione che nessuno mandava', () => {
  it('ora parte su ogni richiesta alle nostre rotte', async () => {
    await fetch('/api/translate', { method: 'POST' });
    expect(chiamate[0].modo).toBe('translate');
  });

  it('e dice "direct" quando si e in modalita Diretta', async () => {
    impostaModalita('direct');
    await fetch('/api/room', { method: 'POST' });
    expect(chiamate[0].modo).toBe('direct');
  });

  it('vale anche per le rotte che non esistono ancora', async () => {
    // E il punto di mettere UN cancello invece di quaranta: chi
    // aggiungera una rotta domani e protetto senza saperlo.
    impostaModalita('direct');
    await fetch('/api/rotta-inventata-domani', { method: 'POST' });
    expect(chiamate[0].modo).toBe('direct');
  });

  it('non si appiccica alle richieste verso altri', async () => {
    // Mandare a un servizio esterno un'intestazione che descrive come
    // stiamo lavorando e regalare informazioni a chi non le ha chieste.
    await fetch('https://nominatim.openstreetmap.org/search?q=roma');
    expect(chiamate[0].modo).toBe(null);
  });

  it('non cancella le intestazioni che c\'erano gia', async () => {
    await fetch('/api/user', { headers: { Authorization: 'Bearer xyz' } });
    expect(fetchOriginale).toHaveBeenCalled();
    const h = new Headers(fetchOriginale.mock.calls[0][1].headers);
    expect(h.get('authorization')).toBe('Bearer xyz');
    expect(h.get('x-session-mode')).toBe('translate');
  });
});

describe('in modalita Diretta il contenuto non parte proprio', () => {
  it('le rotte vietate non raggiungono la rete', async () => {
    impostaModalita('direct');
    for (const rotta of BLOCKED_IN_DIRECT) {
      const res = await fetch(rotta, { method: 'POST', body: 'ciao' });
      expect(res.status, `${rotta} doveva essere fermata`).toBe(403);
    }
    expect(chiamate, 'nessuna richiesta deve essere partita').toEqual([]);
  });

  it('la voce registrata non arriva a /api/transcribe', async () => {
    // Era il buco vero: il testo era fermato, la voce no.
    impostaModalita('direct');
    const res = await fetch('/api/transcribe', { method: 'POST', body: new FormData() });
    expect(res.status).toBe(403);
    expect(chiamate).toEqual([]);
  });

  it('e nemmeno alla trascrizione in tempo reale', async () => {
    impostaModalita('direct');
    const res = await fetch('/api/stt-token', { method: 'POST' });
    expect(res.status).toBe(403);
    expect(chiamate).toEqual([]);
  });

  it('si blocca PRIMA di spedire, non con un 403 dopo', async () => {
    // Un 403 dal server arriva quando il corpo della richiesta e gia
    // stato mandato: in modalita Diretta quel corpo non deve nemmeno
    // attraversare la rete verso di noi.
    impostaModalita('direct');
    await fetch('/api/translate', { method: 'POST', body: 'segreto' });
    expect(fetchOriginale).not.toHaveBeenCalled();
  });

  it('la risposta assomiglia a quella del server: chi chiama non deve saperlo', async () => {
    impostaModalita('direct');
    const res = await fetch('/api/messages', { method: 'POST' });
    const corpo = await res.json();
    expect(corpo.direct).toBe(true);
    expect(typeof corpo.error).toBe('string');
  });

  it('in modalita normale invece passa tutto', async () => {
    impostaModalita('translate');
    for (const rotta of BLOCKED_IN_DIRECT) {
      const res = await fetch(rotta, { method: 'POST' });
      expect(res.status).toBe(200);
    }
    expect(chiamate.length).toBe(BLOCKED_IN_DIRECT.length);
  });
});

describe('una sola verita sulla modalita, non due', () => {
  it('l\'elenco delle rotte vietate è finalmente letto da qualcuno', () => {
    // Era un elenco che nessun file importava: buone intenzioni scritte
    // e mai collegate.
    // b.139 — l'elenco non e piu importato da sessionGuard ma da
    // decisioni.js, insieme al CONFRONTO che prima era riscritto qui
    // dentro e che percio il server non poteva usare. Il nome
    // BLOCKED_IN_DIRECT resta valido: sessionGuard lo ri-esporta.
    const m = app('lib/modalitaSessione.js');
    expect(m).toMatch(/rottaVietataInDiretta/);
    expect(m).toMatch(/from '\.\/decisioni\.js'/);
    expect(BLOCKED_IN_DIRECT.length).toBeGreaterThan(5);
    expect(BLOCKED_IN_DIRECT).toContain('/api/transcribe');
    expect(BLOCKED_IN_DIRECT).toContain('/api/tts-edge');
  });

  it('cambiare modalita aggiorna sia il ref sia il cancello', () => {
    // Due copie della stessa verita che si separano sono il modo
    // classico di ritrovarsi con la promessa rotta da una parte sola.
    const p = app('page.js');
    expect(p).toMatch(/sessionModeRef\.current = impostaModalita\(modo\)/);
    expect(p).toMatch(/montaCancelloDiretta\(\)/);
  });

  it('la guardia sul server resta: il client non e la difesa', () => {
    // Il cancello sul telefono si puo smontare. Quello che conta e che
    // il server continui a rifiutare.
    for (const r of ['translate', 'transcribe', 'tts', 'messages', 'stt-token']) {
      expect(app(`api/${r}/route.js`), `/api/${r} deve conservare la guardia`)
        .toMatch(/assertCloudProcessingAllowed/);
    }
  });

  it('impostaModalita accetta solo i due valori veri', () => {
    expect(impostaModalita('direct')).toBe('direct');
    expect(impostaModalita('translate')).toBe('translate');
    // Qualsiasi altra cosa vale "normale": nel dubbio NON si promette
    // riservatezza che non si puo mantenere.
    expect(impostaModalita('boh')).toBe('translate');
    expect(impostaModalita(undefined)).toBe('translate');
    expect(modalitaCorrente()).toBe('translate');
  });
});
