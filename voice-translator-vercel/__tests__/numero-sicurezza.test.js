// ═══════════════════════════════════════════════════════════════
// CON CHI STO PARLANDO DAVVERO (b.113)
//
// Lo scambio delle chiavi era corretto — ECDH P-256, chiavi effimere,
// AES-GCM a 256 bit — ma mancava la domanda piu semplice: la chiave
// pubblica che ho ricevuto e davvero la sua?
//
// Le chiavi passano dal canale dati, che nasce dal signaling. Chi
// controlla il signaling puo mettersi in mezzo: due conversazioni
// cifrate benissimo, con se stesso al centro. La crittografia funziona
// a meraviglia e non serve a niente.
//
// Nessuna matematica puo dire se una chiave appartiene a una persona.
// Solo la persona puo dirlo, per una strada che l'attacco non
// controlla. Questo numero e quella strada.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  numeroDiSicurezza, combaciano, perCodiceQR, COSTANTI_IMPRONTA,
} from '../app/lib/improntaChiavi.js';

const app = (p) => fs.readFileSync(path.join(__dirname, '..', 'app', p), 'utf8');
const senzaCommenti = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const CHIAVE_A = '{"kty":"EC","crv":"P-256","x":"AAAA","y":"BBBB"}';
const CHIAVE_B = '{"kty":"EC","crv":"P-256","x":"CCCC","y":"DDDD"}';
const CHIAVE_C = '{"kty":"EC","crv":"P-256","x":"EEEE","y":"FFFF"}';

describe('i due telefoni vedono lo stesso numero', () => {
  it('l\'ordine in cui si hanno le chiavi non conta', async () => {
    // E il punto piu delicato: il mio telefono ha (mia, sua), il suo ha
    // (sua, mia). Senza ordinarle prima, i due numeri sarebbero sempre
    // diversi — e un allarme che suona sempre e un allarme che nessuno
    // guarda piu.
    const mio = await numeroDiSicurezza(CHIAVE_A, CHIAVE_B, 'ABC123');
    const suo = await numeroDiSicurezza(CHIAVE_B, CHIAVE_A, 'ABC123');
    expect(mio).toBe(suo);
    expect(mio).not.toBe('');
  });

  it('e sempre lo stesso per la stessa coppia', async () => {
    const uno = await numeroDiSicurezza(CHIAVE_A, CHIAVE_B, 'ABC123');
    const due = await numeroDiSicurezza(CHIAVE_A, CHIAVE_B, 'ABC123');
    expect(uno).toBe(due);
  });
});

describe('chi si mette in mezzo non riesce a far tornare i conti', () => {
  it('con una chiave diversa il numero cambia', async () => {
    // L'attacco: lui ha una chiave con me e un'altra con lei. I due
    // numeri non possono coincidere.
    const conLei = await numeroDiSicurezza(CHIAVE_A, CHIAVE_B, 'ABC123');
    const conLui = await numeroDiSicurezza(CHIAVE_A, CHIAVE_C, 'ABC123');
    expect(conLei).not.toBe(conLui);
  });

  it('lo stesso numero non si puo riusare in un\'altra stanza', async () => {
    const qui = await numeroDiSicurezza(CHIAVE_A, CHIAVE_B, 'ABC123');
    const altrove = await numeroDiSicurezza(CHIAVE_A, CHIAVE_B, 'XYZ789');
    expect(qui).not.toBe(altrove);
  });
});

describe('si puo leggere a voce e confrontare', () => {
  it('sono venti cifre in quattro gruppi', async () => {
    const n = await numeroDiSicurezza(CHIAVE_A, CHIAVE_B, 'ABC123');
    expect(n).toMatch(/^\d{5} \d{5} \d{5} \d{5}$/);
    expect(n.replace(/\D/g, '')).toHaveLength(COSTANTI_IMPRONTA.CIFRE);
  });

  it('solo cifre: le parole andrebbero tradotte', async () => {
    // Questo e un programma in cui le due persone spesso non
    // condividono una lingua. Le cifre si leggono in qualunque lingua.
    const n = await numeroDiSicurezza(CHIAVE_A, CHIAVE_B, 'ABC123');
    expect(n.replace(/[\d ]/g, '')).toBe('');
  });

  it('venti cifre sono abbastanza da non poter essere indovinate', () => {
    // ~66 bit. Chi volesse fabbricare una coppia di chiavi che dia lo
    // stesso numero dovrebbe provarci per un tempo che non ha, e la
    // sessione dura pochi minuti.
    expect(COSTANTI_IMPRONTA.CIFRE).toBeGreaterThanOrEqual(16);
  });

  it('il confronto ignora dove cadono gli spazi', async () => {
    // Chi lo detta a voce non dice dove finiscono i gruppi.
    const n = await numeroDiSicurezza(CHIAVE_A, CHIAVE_B, 'ABC123');
    expect(combaciano(n, n.replace(/ /g, ''))).toBe(true);
    expect(combaciano(n, `${n} `)).toBe(true);
  });

  it('un numero incompleto NON combacia', () => {
    // Meglio dire "non combacia" che dire "va bene" per sbaglio.
    expect(combaciano('12345', '12345')).toBe(false);
    expect(combaciano('', '')).toBe(false);
    expect(combaciano(null, undefined)).toBe(false);
  });

  it('la forma per il QR e lo stesso numero, senza spazi', async () => {
    const n = await numeroDiSicurezza(CHIAVE_A, CHIAVE_B, 'ABC123');
    expect(perCodiceQR(n)).toBe(n.replace(/ /g, ''));
  });
});

describe('senza chiavi non si inventa un numero', () => {
  it('restituisce vuoto, non qualcosa che sembra valido', async () => {
    // Un numero finto sarebbe la cosa peggiore: due persone lo
    // confronterebbero, vedrebbero che combacia, e si fiderebbero.
    expect(await numeroDiSicurezza('', CHIAVE_B, 'ABC')).toBe('');
    expect(await numeroDiSicurezza(CHIAVE_A, null, 'ABC')).toBe('');
    expect(await numeroDiSicurezza(null, null)).toBe('');
  });
});

describe('e collegato al codice vivo', () => {
  it('si calcola quando la chiave condivisa e pronta', () => {
    const e = senzaCommenti(app('hooks/useE2EEncryption.js'));
    expect(e).toMatch(/numeroDiSicurezza\(/);
    expect(e).toMatch(/setNumeroSicurezza\(n\)/);
    expect(e, 'la stanza entra nel calcolo').toMatch(/roomIdRef\?\.current/);
  });

  it('si azzera quando la conversazione finisce', () => {
    // Un numero rimasto da prima e peggio di nessun numero: qualcuno lo
    // guarderebbe credendo che valga per questa conversazione.
    const e = senzaCommenti(app('hooks/useE2EEncryption.js'));
    expect(e).toMatch(/reset = useCallback\(\(\) => \{[\s\S]{0,400}setNumeroSicurezza\(''\)/);
  });

  it('arriva fino alla schermata della stanza', () => {
    expect(app('hooks/useWebRTC.js')).toMatch(/numeroSicurezza: e2e\.numeroSicurezza/);
    expect(app('components/RoomView.js')).toMatch(/<NumeroSicurezza numero=\{webrtc\.numeroSicurezza\}/);
  });

  it('la schermata tiene separate "cifrato" e "verificato"', () => {
    // Molti programmi mostrano un lucchetto e lasciano credere la
    // seconda cosa garantendo solo la prima.
    const c = app('components/NumeroSicurezza.js');
    expect(c).toMatch(/I messaggi sono cifrati/);
    expect(c).toMatch(/non lo sa nemmeno il programma/);
    expect(c, 'la spunta si mette a mano').toMatch(/setVerificato\(true\)/);
    expect(c, 'e non si ricorda: le chiavi cambiano ogni volta')
      .toMatch(/Vale solo per questa conversazione/);
  });

  it('nessuna emoji: come nel resto dell\'app', () => {
    expect(app('components/NumeroSicurezza.js')).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });
});
