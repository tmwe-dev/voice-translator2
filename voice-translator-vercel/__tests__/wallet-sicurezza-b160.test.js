// ═══════════════════════════════════════════════════════════════
// GUARDIA — falle di sicurezza/economia chiuse in b.160
//
// Nate da un TERZO audit esterno sul codice pushato in b.159, che ha
// verificato il HEAD reale (non il messaggio di commit) e trovato una
// classe di difetto comune a tre rotte: `isOwnKey` descrive la chiave
// del provider ORIGINALE scelto da resolveAuth, non la credenziale
// REALMENTE usata quando il routing (CosyVoice, Qwen) o il fallback
// (translate) fanno decidere ad altro codice quale fornitore chiamare
// davvero. Questo file blocca il regresso.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');

describe('/api/tts: addebitaTTS riceve la chiave REALMENTE usata, non isOwnKey a monte (b.160)', () => {
  const src = leggi('app/api/tts/route.js');

  it('addebitaTTS accetta un parametro esplicito, non legge isOwnKey dalla closure per decidere', () => {
    expect(src).toContain('async function addebitaTTS(usataChiavePropria) {');
    expect(src).toContain('if (usataChiavePropria) return;');
  });

  it('il ramo CosyVoice passa sempre false: DashScope non ha percorso a chiave propria qui', () => {
    const i = src.indexOf("ttsRoute.engine === 'cosyvoice'");
    const iReturn = src.indexOf("X-TTS-Engine': 'cosyvoice'", i);
    const blocco = src.slice(i, iReturn);
    expect(blocco).toContain('addebitaTTS(false)');
  });

  it('il ramo OpenAI passa la vera isOwnKey (accurata solo per questo ramo)', () => {
    expect(src).toContain('addebitaTTS(isOwnKey)');
  });
});

describe('/api/chat-action: chi paga si decide sul provider eseguito, non su auth.isOwnKey a monte (b.160)', () => {
  const src = leggi('app/api/chat-action/route.js');

  it('il pre-gate scatta anche solo per sospetto di CJK (possibile Qwen)', () => {
    const i = src.indexOf('const possibilePiattaforma');
    expect(i).toBeGreaterThan(-1);
    expect(src.slice(i, i + 200)).toContain('useCJK || !auth.isOwnKey');
  });

  it('l\'addebito vero guarda `provider === \'qwen\'`, non solo auth.isOwnKey', () => {
    const i = src.indexOf('const paganteReale');
    expect(i).toBeGreaterThan(-1);
    expect(src.slice(i, i + 200)).toContain("provider === 'qwen' || !auth.isOwnKey");
  });

  it('Qwen (llmAsia.js) non riceve mai una apiKey da questa rotta: sempre DashScope di piattaforma', () => {
    const i = src.indexOf('await callQwen({');
    const blocco = src.slice(i, src.indexOf('});', i));
    expect(blocco).not.toContain('apiKey');
  });
});

describe('/api/translate: un fallback verso la piattaforma non parte se una chiave propria dichiarata e un wallet a zero si combinano (b.160)', () => {
  const src = leggi('app/api/translate/route.js');

  it('prima di callLLMWithFallback, i fallback si azzerano se isOwnKey e il wallet e a zero', () => {
    const iFallbacks = src.indexOf('const fallbacks = [];');
    const iChiamata = src.indexOf('callLLMWithFallback(primaryOpts, fallbacks, 10000)');
    const blocco = src.slice(iFallbacks, iChiamata);
    expect(blocco).toMatch(/if\s*\(isOwnKey\s*&&\s*fallbacks\.length\s*&&\s*billingEmail\)/);
    expect(blocco).toContain('creditoFinito(billingEmail, { failClosed: true })');
    expect(blocco).toContain('fallbacks.length = 0');
  });

  it('importa creditoFinito da wallet/addebita.js', () => {
    // b.161 — l'import si e' allungato (creditoInsufficiente, preventivoTesto
    // per il preventivo del punto 1 del quarto audit): si controlla che
    // creditoFinito ci sia ancora, non la riga esatta di prima.
    expect(src).toMatch(/import\s*\{[^}]*creditoFinito[^}]*\}\s*from\s*'\.\.\/\.\.\/wallet\/addebita\.js'/);
  });
});

describe('Voice Clone: il pre-check ElevenLabs ora e fail-closed (b.160)', () => {
  it('creditoInsufficientePerClonazione passa {failClosed:true}', () => {
    const src = leggi('app/wallet/addebita.js');
    const i = src.indexOf('export async function creditoInsufficientePerClonazione');
    expect(i).toBeGreaterThan(-1);
    const corpo = src.slice(i, i + 400);
    expect(corpo).toMatch(/creditoInsufficiente\(utente,\s*COSTO_CLONAZIONE_SECONDI,\s*\{\s*failClosed:\s*true\s*\}\)/);
  });
});
