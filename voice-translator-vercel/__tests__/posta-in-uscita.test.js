// ═══════════════════════════════════════════════════════════════
// I MESSAGGI CHE NON SONO PARTITI (b.111)
//
// In modalita Direct il messaggio viaggia solo fra i due telefoni:
// niente server, per scelta. Ma chi lo spediva scriveva
//
//     try { sendDirectMessage(...) } catch {}
//
// e sendEncrypted, a canale chiuso, rispondeva `false`. Nessuno
// guardava quel `false`. Il messaggio compariva nella propria chat con
// la spunta di inviato, e non era mai partito — e non c'era una copia
// da nessuna parte.
//
// Non era un caso limite: succedeva nel primo secondo dopo essersi
// collegati, mentre le chiavi si scambiano, e a ogni singhiozzo di
// rete.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { creaPostaInUscita, COSTANTI_POSTA } from '../app/lib/postaInUscita.js';

const app = (p) => fs.readFileSync(path.join(__dirname, '..', 'app', p), 'utf8');
const senzaCommenti = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('quello che non parte si tiene da parte', () => {
  it('una lettera accodata aspetta', () => {
    const posta = creaPostaInUscita();
    expect(posta.quante()).toBe(0);
    posta.accoda('m1', { testo: 'ciao' });
    expect(posta.quante()).toBe(1);
  });

  it('riparte quando il canale riapre', async () => {
    const posta = creaPostaInUscita();
    posta.accoda('m1', { testo: 'ciao' });
    posta.accoda('m2', { testo: 'come stai' });

    const consegnate = [];
    const esito = await posta.svuota((b) => { consegnate.push(b.testo); return true; });

    expect(esito).toEqual({ partite: 2, rimaste: 0 });
    expect(consegnate).toEqual(['ciao', 'come stai']);
    expect(posta.quante()).toBe(0);
  });

  it('mantiene l\'ordine in cui sono state scritte', async () => {
    const posta = creaPostaInUscita();
    for (const t of ['uno', 'due', 'tre']) posta.accoda(t, { testo: t });
    const ordine = [];
    await posta.svuota((b) => { ordine.push(b.testo); return true; });
    expect(ordine).toEqual(['uno', 'due', 'tre']);
  });
});

describe('un secondo tentativo fallito non perde niente', () => {
  it('quello che non parte nemmeno stavolta resta in coda', async () => {
    const posta = creaPostaInUscita();
    posta.accoda('m1', { testo: 'ciao' });
    const esito = await posta.svuota(() => false);
    expect(esito.partite).toBe(0);
    expect(posta.quante()).toBe(1);
  });

  it('se spedire SOLLEVA, la lettera resta — non evapora', async () => {
    // E il caso vero: in Direct sendEncrypted solleva finche le chiavi
    // non sono pronte. Era proprio quell'eccezione che il `catch {}`
    // vuoto si mangiava.
    const posta = creaPostaInUscita();
    posta.accoda('m1', { testo: 'ciao' });
    await posta.svuota(() => { throw new Error('chiavi non pronte'); });
    expect(posta.quante()).toBe(1);

    const consegnate = [];
    await posta.svuota((b) => { consegnate.push(b.testo); return true; });
    expect(consegnate).toEqual(['ciao']);
  });

  it('nessun doppione se si accoda due volte la stessa', () => {
    const posta = creaPostaInUscita();
    expect(posta.accoda('m1', { testo: 'ciao' })).toBe(true);
    expect(posta.accoda('m1', { testo: 'ciao' })).toBe(false);
    expect(posta.quante()).toBe(1);
  });
});

describe('i due freni che evitano di peggiorare le cose', () => {
  it('il tetto: una posta infinita sarebbe una perdita di memoria', () => {
    const posta = creaPostaInUscita({ tetto: 3 });
    for (let i = 0; i < 10; i++) posta.accoda(`m${i}`, { i });
    expect(posta.quante()).toBe(3);
    // Restano le PIU RECENTI: le vecchie interessano meno a chi legge.
    expect(posta.chiaviInAttesa()).toEqual(['m7', 'm8', 'm9']);
  });

  it('la scadenza: consegnare una frase di venti minuti fa confonde', async () => {
    vi.useFakeTimers();
    try {
      const posta = creaPostaInUscita({ scadenzaMs: 1000 });
      posta.accoda('vecchio', { testo: 'ciao' });
      vi.advanceTimersByTime(1500);
      expect(posta.quante()).toBe(0);
      const esito = await posta.svuota(() => true);
      expect(esito.partite).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('la scadenza conta da quando e stata scritta, non dall\'ultimo tentativo', async () => {
    vi.useFakeTimers();
    try {
      const posta = creaPostaInUscita({ scadenzaMs: 1000 });
      posta.accoda('m1', { testo: 'ciao' });
      vi.advanceTimersByTime(600);
      await posta.svuota(() => false);   // primo tentativo a vuoto
      expect(posta.quante()).toBe(1);
      vi.advanceTimersByTime(600);       // in totale 1200ms dalla scrittura
      expect(posta.quante()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('uscendo dalla stanza la posta non segue altrove', () => {
    const posta = creaPostaInUscita();
    posta.accoda('m1', {});
    posta.azzera();
    expect(posta.quante()).toBe(0);
  });
});

describe('e collegata al codice vivo', () => {
  it('il canale che riapre svuota la posta', () => {
    const w = app('hooks/useWebRTC.js');
    expect(w).toMatch(/creaPostaInUscita/);
    expect(w, 'si svuota nel dc.onopen, dopo lo scambio chiavi')
      .toMatch(/postaRef\.current\?\.svuota/);
    expect(w).toMatch(/spedisciOAccoda/);
  });

  it('il messaggio di chat passa dalla posta, non dal catch vuoto', () => {
    const t = senzaCommenti(app('hooks/useTranslationAPI.js'));
    expect(t).toMatch(/spedisciContenuto\(/);
    // La riga esatta che perdeva i messaggi non deve tornare.
    expect(t, 'il vecchio invio senza rete di sicurezza non deve piu esserci')
      .not.toMatch(/try \{\s*sendDirectMessage\(\{ type: 'chat-message'[\s\S]{0,80}\} catch \{\}\s*\n\s*\}\s*\n\s*\/\/ Priority 2/);
  });

  it('la posta si collega anche quando NON si e connessi', () => {
    // E l'errore facile: agganciarla solo a webrtcConnected, cioe
    // proprio quando non serve.
    const p = senzaCommenti(app('page.js'));
    expect(p).toMatch(/spedisciContenutoRef\.current = webrtc\.spedisciOAccoda/);
    expect(p).not.toMatch(/spedisciContenutoRef\.current = webrtc\.webrtcConnected/);
  });

  it('i freni hanno valori sensati', () => {
    expect(COSTANTI_POSTA.TETTO).toBeGreaterThan(10);
    expect(COSTANTI_POSTA.TETTO).toBeLessThanOrEqual(200);
    expect(COSTANTI_POSTA.SCADENZA_MS).toBeGreaterThanOrEqual(60_000);
  });
});
