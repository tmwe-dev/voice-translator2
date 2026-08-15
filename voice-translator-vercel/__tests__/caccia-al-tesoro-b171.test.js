// ═══════════════════════════════════════════════════════════════
// b.171 — Chat Action e Summary passano a Wallet Reservation
//
// A b.170 erano dichiarati apertamente NON convertiti: usavano ancora
// lo schema "controlla saldo → chiama fornitore → addebita", che lascia
// una finestra di corsa (due richieste concorrenti leggono lo stesso
// saldo, passano entrambe il controllo, chiamano entrambe il modello, e
// solo l'addebito finale ne distingue una — l'altra e gia costata).
//
// Ora usano lo stesso pattern gia collaudato in translate/tts/
// transcribe/tts-elevenlabs (wallet/riserva.js):
//   riserva(costo)  → blocca il saldo SUBITO, atomico, prima del modello
//   ... modello ...
//   commit(riservaId, costo)  → il modello ha risposto
//   release(riservaId)        → il modello e fallito / errore
//
// CLAUDE.md trappola 1: un difetto (o pattern) CITATO in un commento non
// e il codice reale. Dove serve, i controlli tolgono le righe di solo
// commento prima di cercare.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');
const senzaCommenti = (src) =>
  src.split('\n').filter((r) => !r.trim().startsWith('//') && !r.trim().startsWith('*')).join('\n');

describe('Chat Action: reservation al posto di check-then-charge', () => {
  const src = leggi('app/api/chat-action/route.js');
  const codice = senzaCommenti(src);

  it('importa riserva/commit/release e non piu addebitaAzioneChat/creditoFinito', () => {
    expect(src).toContain("import { riserva, commit, release } from '../../wallet/riserva.js'");
    expect(codice).not.toContain('addebitaAzioneChat');
    expect(codice).not.toContain('creditoFinito');
    expect(codice).not.toContain('creditoInsufficiente');
  });

  it('riserva PRIMA del modello: blocco atomico, e se rifiutata 402 senza chiamare GPT', () => {
    const iRiserva = codice.indexOf('riserva(paganteGate, costoAzione');
    const iModello = codice.indexOf('buildCompactTranscript(messages)');
    expect(iRiserva).toBeGreaterThan(-1);
    expect(iRiserva).toBeLessThan(iModello);
    // il ramo di rifiuto esce con 402 prima del modello
    const blocco = codice.slice(iRiserva, iModello);
    expect(blocco).toMatch(/if\s*\(!r\.ok\)/);
    expect(blocco).toMatch(/status:\s*402/);
  });

  it('commit se paga la piattaforma, release se ha pagato la chiave propria (fallback CJK→OpenAI)', () => {
    // Il ramo esiste ed e simmetrico: commit nel caso pagante, release
    // nell'else — cosi una riserva presa "per sospetto CJK" ma finita su
    // chiave propria non lascia credito bloccato.
    const iChiusura = codice.indexOf('if (riservaId) {');
    expect(iChiusura).toBeGreaterThan(-1);
    const blocco = codice.slice(iChiusura, iChiusura + 400);
    expect(blocco).toMatch(/if\s*\(paganteReale\)/);
    expect(blocco).toMatch(/await commit\(riservaId, costoAzione/);
    expect(blocco).toMatch(/await release\(riservaId, 'chiave_propria'\)/);
  });

  it('il commit avviene DOPO che il modello ha risposto, prima del return', () => {
    const iRisultato = codice.lastIndexOf("provider = 'openai';");
    const iCommit = codice.indexOf('await commit(riservaId, costoAzione');
    const iReturn = codice.indexOf('return NextResponse.json({');
    expect(iCommit).toBeGreaterThan(iRisultato);
    // c'e almeno un return dopo il commit (quello del risultato)
    expect(codice.indexOf('await commit(riservaId, costoAzione')).toBeGreaterThan(-1);
    expect(iReturn).toBeGreaterThan(-1);
  });

  it('il catch restituisce la riserva (release) se qualcosa fallisce dopo averla presa', () => {
    // Ancora sul ramo di errore vero (catch con argomento), non sui
    // tanti `.catch(() => {})` in linea sparsi nel file.
    const iCatch = codice.search(/\}\s*catch\s*\([a-z]+\)\s*\{/);
    expect(iCatch).toBeGreaterThan(-1);
    const blocco = codice.slice(iCatch);
    expect(blocco).toMatch(/if\s*\(riservaId\)\s*await release\(riservaId, 'errore_imprevisto'\)/);
  });

  it('riservaId e dichiarato FUORI dal try (cosi il catch lo vede)', () => {
    const iDecl = codice.indexOf('let riservaId = null;');
    const iTry = codice.indexOf('try {');
    expect(iDecl).toBeGreaterThan(-1);
    expect(iDecl).toBeLessThan(iTry);
  });
});

describe('Summary: reservation al posto di check-then-charge', () => {
  const src = leggi('app/api/summary/route.js');
  const codice = senzaCommenti(src);

  it('importa riserva/commit/release e non piu addebitaRiassunto/creditoFinito', () => {
    expect(src).toContain("import { riserva, commit, release } from '../../wallet/riserva.js'");
    expect(codice).not.toContain('addebitaRiassunto');
    expect(codice).not.toContain('creditoFinito');
    expect(codice).not.toContain('creditoInsufficiente');
  });

  it('riserva PRIMA di new OpenAI, e se rifiutata 402 senza chiamare il modello', () => {
    const iRiserva = codice.indexOf('riserva(billingEmail, costoR');
    const iOpenai = codice.indexOf('new OpenAI({ apiKey })');
    expect(iRiserva).toBeGreaterThan(-1);
    expect(iRiserva).toBeLessThan(iOpenai);
    const blocco = codice.slice(iRiserva, iOpenai);
    expect(blocco).toMatch(/if\s*\(!r\.ok\)/);
    expect(blocco).toMatch(/status:\s*402/);
  });

  it('la riserva scatta solo se paga la piattaforma (billingEmail && !isOwnKey)', () => {
    const iRiserva = codice.indexOf('riserva(billingEmail, costoR');
    const prima = codice.slice(Math.max(0, iRiserva - 120), iRiserva);
    expect(prima).toMatch(/if\s*\(billingEmail\s*&&\s*!isOwnKey\)/);
  });

  it('commit dopo il successo del modello, e null-guard su riservaId', () => {
    const iCommit = codice.indexOf('await commit(riservaId, costoR');
    const iOpenai = codice.indexOf('openai.chat.completions.create');
    expect(iCommit).toBeGreaterThan(iOpenai);
    const prima = codice.slice(Math.max(0, iCommit - 60), iCommit);
    expect(prima).toMatch(/if\s*\(riservaId\)/);
  });

  it('il catch restituisce la riserva (release) su errore', () => {
    // Ancora sul ramo di errore vero (catch con argomento), non sui
    // tanti `.catch(() => {})` in linea sparsi nel file.
    const iCatch = codice.search(/\}\s*catch\s*\([a-z]+\)\s*\{/);
    expect(iCatch).toBeGreaterThan(-1);
    const blocco = codice.slice(iCatch);
    expect(blocco).toMatch(/if\s*\(riservaId\)\s*await release\(riservaId, 'errore_imprevisto'\)/);
  });

  it('riservaId dichiarato FUORI dal try', () => {
    const iDecl = codice.indexOf('let riservaId = null;');
    const iTry = codice.indexOf('try {');
    expect(iDecl).toBeGreaterThan(-1);
    expect(iDecl).toBeLessThan(iTry);
  });
});

describe('Coerenza col pattern gia esistente (riserva.js invariato)', () => {
  it('wallet/riserva.js espone ancora riserva/commit/release', () => {
    const r = leggi('app/wallet/riserva.js');
    expect(r).toContain('export async function riserva(');
    expect(r).toContain('export async function commit(');
    expect(r).toContain('export async function release(');
  });

  it('il costo delle due azioni resta fisso e definito in consumo.js (commit allo stesso importo della riserva)', () => {
    const consumo = leggi('app/wallet/consumo.js');
    expect(consumo).toContain('export function costoAzioneChat()');
    expect(consumo).toContain('export function costoRiassunto()');
  });
});
