// ═══════════════════════════════════════════════════════════════
// GUARDIA — falle di sicurezza/economia chiuse in b.159
//
// Nate da un secondo audit esterno (verificato punto per punto, vedi
// il messaggio "Audit pagamenti aggiornato — b.158") piu tre difetti
// trovati leggendo il codice in proprio (isReview, chat-action senza
// addebito, tabella profiles assente in produzione). Questo file
// blocca il regresso: se qualcuno disfa una di queste correzioni per
// sbaglio, questi test diventano rossi.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');

describe('translate: isReview non bypassa piu i soldi (b.159)', () => {
  const src = leggi('app/api/translate/route.js');

  it('resolveAuth non riceve piu skipCreditCheck legato a isReview', () => {
    const i = src.indexOf('await resolveAuth({');
    const blocco = src.slice(i, src.indexOf('});', i));
    expect(blocco).not.toContain('skipCreditCheck');
  });

  it('la ricevuta e il vero addebito non sono piu condizionati a !isReview', () => {
    expect(src).toContain('if (billingEmail && !isOwnKey) {');
    expect(src).toContain('if (billingEmail && !isOwnKey && !giaPagatoDavvero) {');
    // Nessuna delle due guardie sui soldi deve piu citare isReview.
    const iRicevuta = src.indexOf('let giaPagatoDavvero = false;');
    const iCredito = src.indexOf('let creditoEsaurito = false;');
    const bloccoSoldi = src.slice(iRicevuta, src.indexOf('const confidence = calcConfidence'));
    expect(bloccoSoldi).not.toContain('!isReview');
    expect(iCredito).toBeGreaterThan(iRicevuta);
  });

  it('trackDailySpend non e piu condizionato a !isReview', () => {
    const i = src.indexOf('bgTasks.push(trackDailySpend(billingEmail');
    const prima = src.slice(Math.max(0, i - 100), i);
    expect(prima).toMatch(/if\s*\(!isOwnKey\)\s*\{/);
    expect(prima).not.toContain('isReview');
  });

  it('isReview resta l\'unico usato nel prompt (translatePrompt.js), non nei soldi', () => {
    const prompt = leggi('app/lib/translatePrompt.js');
    expect(prompt).toContain('if (isReview) systemPrompt +=');
  });
});

describe('translate: isOwnKey riflette la chiave davvero usata dopo un fallback (b.159)', () => {
  it('wasFallback forza isOwnKey a false quando era true', () => {
    const src = leggi('app/api/translate/route.js');
    const i = src.indexOf('callLLMWithFallback(primaryOpts, fallbacks, 10000)');
    expect(i).toBeGreaterThan(-1);
    const dopo = src.slice(i, i + 1100);
    expect(dopo).toMatch(/if\s*\(wasFallback\s*&&\s*isOwnKey\)\s*\{\s*isOwnKey\s*=\s*false;/);
  });

  it('apiKey/isOwnKey sono dichiarati con let, non const (servono mutabili)', () => {
    const src = leggi('app/api/translate/route.js');
    expect(src).toMatch(/let\s*\{\s*apiKey,\s*isOwnKey,\s*billingEmail/);
  });
});

describe('/api/chat-action: ora addebita davvero (b.159)', () => {
  const src = leggi('app/api/chat-action/route.js');

  it('importa addebitaAzioneChat e i controlli di credito', () => {
    expect(src).toContain("import { creditoFinito, creditoInsufficiente, addebitaAzioneChat } from '../../wallet/addebita.js'");
  });

  it('controlla il credito PRIMA di chiamare il modello (fail-closed)', () => {
    const iAuth = src.indexOf('await resolveAuth(');
    const iChiamata = src.indexOf('buildCompactTranscript(messages)');
    const blocco = src.slice(iAuth, iChiamata);
    expect(blocco).toMatch(/creditoFinito\(paganteGate,\s*\{\s*failClosed:\s*true\s*\}\)/);
    expect(blocco).toMatch(/creditoInsufficiente\(paganteGate,\s*costoPrevisto,\s*\{\s*failClosed:\s*true\s*\}\)/);
  });

  it('addebita DOPO la risposta del modello, non prima', () => {
    const iRisultato = src.lastIndexOf('provider = \'openai\';');
    const iAddebito = src.indexOf('await addebitaAzioneChat(paganteReale);');
    const iReturn = src.indexOf('return NextResponse.json({\n      result:');
    expect(iAddebito).toBeGreaterThan(iRisultato);
    expect(iAddebito).toBeLessThan(iReturn);
  });

  it('consumo.js definisce un costo fisso per le azioni chat', () => {
    const consumo = leggi('app/wallet/consumo.js');
    expect(consumo).toContain('export function costoAzioneChat()');
  });

  it('addebita.js espone addebitaAzioneChat', () => {
    const addebita = leggi('app/wallet/addebita.js');
    expect(addebita).toContain('export async function addebitaAzioneChat(utente)');
  });
});

describe('/api/stt-token: un gettone invalido non e piu "nessuno" (b.159)', () => {
  const src = leggi('app/api/stt-token/route.js');

  it('userToken/roomId presenti ma non risolvibili tornano 401, non billingEmail null', () => {
    const i = src.indexOf('async function risolviEmailDaFatturare');
    const corpo = src.slice(i, src.indexOf('async function handler'));
    // b.161 — un terzo caso si e' aggiunto (roomId con roomSessionToken
    // assente o non valido per quella stanza, punto 2 quarto audit): la
    // stessa sentinella 'invalido' rifiuta anche questo, non solo i due
    // di prima (userToken rotto, host senza email).
    expect(corpo.match(/return\s*\{\s*invalido:\s*true\s*\}/g) || []).toHaveLength(3);
  });

  it('il chiamante rifiuta esplicitamente il caso invalido con 401', () => {
    expect(src).toMatch(/risoltoFatturazione\?\.invalido[\s\S]{0,120}status:\s*401/);
  });
});

describe('/api/tts: CosyVoice addebita, l\'addebito OpenAI arriva dopo il successo (b.159)', () => {
  const src = leggi('app/api/tts/route.js');

  it('il ramo cosyvoice chiama addebitaTTS(...) prima del return con l\'audio', () => {
    const i = src.indexOf("ttsRoute.engine === 'cosyvoice'");
    const iReturn = src.indexOf('X-TTS-Engine\': \'cosyvoice\'', i);
    const blocco = src.slice(i, iReturn);
    expect(blocco).toContain('await addebitaTTS(false);');
  });

  it('il ramo OpenAI addebita SOLO dopo che audio.speech.create ha risposto', () => {
    const iChiamata = src.indexOf('await openai.audio.speech.create(');
    const iAddebito = src.indexOf('await addebitaTTS(isOwnKey);', iChiamata);
    expect(iChiamata).toBeGreaterThan(-1);
    expect(iAddebito).toBeGreaterThan(iChiamata);
  });
});

describe('/api/summary e /api/topics/riassunto: gate PRIMA di chiamare OpenAI (b.159)', () => {
  it('summary: creditoFinito/creditoInsufficiente prima di "new OpenAI"', () => {
    const src = leggi('app/api/summary/route.js');
    const iGate = src.indexOf('creditoFinito(billingEmail');
    const iOpenai = src.indexOf('new OpenAI({ apiKey })');
    expect(iGate).toBeGreaterThan(-1);
    expect(iGate).toBeLessThan(iOpenai);
  });

  it('topics/riassunto: creditoFinito/creditoInsufficiente prima di "new OpenAI"', () => {
    const src = leggi('app/api/topics/riassunto/route.js');
    const iGate = src.indexOf('creditoFinito(billingEmail');
    const iOpenai = src.indexOf('new OpenAI({ apiKey })');
    expect(iGate).toBeGreaterThan(-1);
    expect(iGate).toBeLessThan(iOpenai);
  });
});

describe('apiAuth: il gate credito conta la chiave USATA, non la preferenza (b.159)', () => {
  const src = leggi('app/lib/apiAuth.js');

  it('nessuno dei tre percorsi condiziona piu il controllo credito a *.useOwnKeys', () => {
    expect(src).not.toMatch(/!isOwnKey\s*&&\s*!user\.useOwnKeys/);
    expect(src).not.toMatch(/!isOwnKey\s*&&\s*!lenderUser\.useOwnKeys/);
    expect(src).not.toMatch(/!isOwnKey\s*&&\s*!hostUser\.useOwnKeys/);
  });

  it('restano tre controlli `!isOwnKey && !skipCreditCheck && await creditoFinito`', () => {
    const occorrenze = src.match(/!isOwnKey\s*&&\s*!skipCreditCheck\s*&&\s*await creditoFinito/g) || [];
    expect(occorrenze.length).toBe(3);
  });
});

describe('/api/transcribe: durata blindata, tetto giornaliero tracciato (b.159)', () => {
  const src = leggi('app/api/transcribe/route.js');

  it('la durata e il MASSIMO fra dichiarata e stimata dal peso, non piu un OR', () => {
    expect(src).toContain('const secondi = Math.max(durataSec, stimaDalPeso);');
    expect(src).not.toMatch(/const secondi = durataSec \|\|/);
  });

  it('trackDailySpend viene chiamato per il costo Whisper', () => {
    expect(src).toContain('trackDailySpend(billingEmail, Math.max(MIN_CHARGE.PROCESS, costoEurCents))');
  });
});

describe('TESTING_MODE: voice-clone e glossary usano la costante blindata (b.159)', () => {
  it('voice-clone non legge piu process.env.TESTING_MODE alla lettera', () => {
    const src = leggi('app/api/voice-clone/route.js');
    expect(src).toContain("import { TESTING_MODE } from '../../lib/config.js';");
    expect(src).not.toMatch(/const testingMode = process\.env\.TESTING_MODE/);
  });

  it('glossary non legge piu process.env.TESTING_MODE alla lettera', () => {
    const src = leggi('app/api/glossary/route.js');
    expect(src).toContain("import { TESTING_MODE } from '../../lib/config.js';");
    expect(src).not.toMatch(/const testingMode = process\.env\.TESTING_MODE/);
  });
});

describe('vercel.json: il cron di riconciliazione oraria esiste (b.159)', () => {
  it('contiene una voce crons per /api/wallet/snapshot', () => {
    const raw = leggi('vercel.json');
    const conf = JSON.parse(raw);
    expect(Array.isArray(conf.crons)).toBe(true);
    const voce = conf.crons.find(c => c.path === '/api/wallet/snapshot');
    expect(voce).toBeTruthy();
    expect(voce.schedule).toBe('0 * * * *');
  });
});

describe('/api/subscription: cancel non dipende piu da profiles (b.159)', () => {
  const src = leggi('app/api/subscription/route.js');

  it('l\'azione cancel non legge piu la tabella profiles', () => {
    const i = src.indexOf("if (action === 'cancel')");
    expect(i).toBeGreaterThan(-1);
    const corpoCancel = src.slice(i, src.indexOf("return NextResponse.json({ error: 'Unknown action'"));
    expect(corpoCancel).not.toContain("from('profiles')");
  });

  it('cerca l\'abbonamento su Stripe per email di sessione verificata', () => {
    expect(src).toContain('getStripe().customers.list({ email: verifiedEmail');
    expect(src).toContain("getStripe().subscriptions.list({ customer: customerId, status: 'active'");
  });
});
