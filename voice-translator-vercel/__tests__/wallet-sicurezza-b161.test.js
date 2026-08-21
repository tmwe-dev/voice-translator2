// ═══════════════════════════════════════════════════════════════
// GUARDIA — falle di sicurezza/economia chiuse in b.161
//
// Nate dal QUARTO audit esterno ("Ordine esatto di intervento", 12
// punti P0/P1/P2). Questo file copre i tre punti P0 completati in
// questo giro:
//
//   1. Bypass "saldo positivo ma insufficiente" — resolveAuth
//      controllava solo creditoFinito (saldo>0), mai il costo vero
//      dell'operazione. La RPC wallet_usa rifiuta un addebito
//      insufficiente lasciando il saldo INTATTO (non parziale): un
//      saldo appena sopra zero bastava per ottenere il servizio
//      gratis, ripetutamente, su translate/tts/transcribe.
//
//   2. Room billing con solo roomId, mai verificato — un roomId (8
//      esadecimali, 32 bit) enumerabile bastava per fatturare
//      all'host di una stanza senza mai esserci entrati, su ogni
//      rotta a pagamento (translate/tts/transcribe/tts-elevenlabs/
//      stt-token).
//
//   3. credentialOwner dimenticato nel retry GPT-4o di /api/translate
//      — stessa classe di difetto gia corretta in b.159/b.160 per
//      CosyVoice/Qwen/fallback, qui riapparsa in un quarto punto
//      (il retry su fallimento di validazione).
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');

describe('wallet/addebita.js: preventivoTesto e la STESSA formula di addebitaTesto (b.161)', () => {
  const src = leggi('app/wallet/addebita.js');

  it('preventivoTesto esiste ed e usata da addebitaTesto (niente drift fra preventivo e addebito vero)', () => {
    expect(src).toContain('export function preventivoTesto(caratteri) {');
    const i = src.indexOf('export async function addebitaTesto(utente, caratteri) {');
    const corpo = src.slice(i, src.indexOf('return scala(utente, costo,', i));
    expect(corpo).toContain('const costo = preventivoTesto(caratteri);');
  });
});

describe('/api/translate: saldo positivo ma insufficiente blocca PRIMA del fornitore (b.161, punto 1)', () => {
  const src = leggi('app/api/translate/route.js');

  // b.161-bis (punto 5) ha sostituito qui il preventivo creditoInsufficiente
  // con una vera riserva atomica: vedi il blocco dedicato piu sotto e
  // wallet-sicurezza-b161-bis.test.js.
  it('riserva(billingEmail, costoPrevisto, ...) e chiamata prima del routing Asia/Global', () => {
    const iCheck = src.indexOf('const r = await riserva(billingEmail');
    const iAsiaRouting = src.indexOf("providerRoute.provider === 'asia'");
    expect(iCheck).toBeGreaterThan(-1);
    expect(iAsiaRouting).toBeGreaterThan(-1);
    expect(iCheck).toBeLessThan(iAsiaRouting);
  });

  it('il preventivo usa preventivoTesto(text.length), la stessa formula dell\'addebito vero', () => {
    const i = src.indexOf('costoPrevisto = preventivoTesto(text.length);');
    expect(i).toBeGreaterThan(-1);
  });

  it('un fallimento della riserva blocca con 402, come il vecchio controllo fail-closed', () => {
    const i = src.indexOf('const r = await riserva(billingEmail');
    const blocco = src.slice(i, src.indexOf("providerRoute.provider === 'asia'"));
    expect(blocco).toContain('if (!r.ok) {');
    expect(blocco).toContain("status: 402 }");
  });
});

describe('/api/translate: RESERVE → PROVIDER → COMMIT/RELEASE (b.161-bis, punto 5)', () => {
  const src = leggi('app/api/translate/route.js');

  it('importa riserva/commit/release, non piu creditoInsufficiente/addebitaTesto', () => {
    expect(src).toContain("import { riserva, commit, release } from '../../wallet/riserva.js';");
    expect(src).not.toContain('await creditoInsufficiente(');
    expect(src).not.toContain('await addebitaTesto(');
  });

  it('una traduzione respinta dalla validazione finale rilascia la riserva (mai un addebito per un output scartato)', () => {
    const i = src.indexOf('if (!finalCheck.valid) {');
    const blocco = src.slice(i, src.indexOf('validationFailed: true'));
    expect(blocco).toContain("release(riservaId, 'validazione_fallita')");
  });

  it('il ricevuta-gia-pagata (fase 2 di un audio) rilascia la riserva invece di addebitare due volte', () => {
    const i = src.indexOf('} else if (riservaId) {');
    const blocco = src.slice(i, i + 150);
    expect(blocco).toContain("release(riservaId, 'gia_pagato_o_non_dovuto')");
  });

  it('il caso b.159 (isOwnKey passato a false dopo il fallback, nessuna riserva presa in anticipo) apre una riserva tardiva e la conferma subito', () => {
    const i = src.indexOf('const costoTardivo = preventivoTesto(text.length);');
    expect(i).toBeGreaterThan(-1);
    const blocco = src.slice(i, i + 700);
    expect(blocco).toContain('nota: \'addebito_tardivo_dopo_fallback_b159\'');
    expect(blocco).toContain('if (rTardiva.ok) {');
    expect(blocco).toContain('await commit(rTardiva.riservaId, costoTardivo');
  });

  it('la rete di sicurezza nel catch esterno rilascia una riserva ancora attiva per qualunque errore imprevisto', () => {
    const iCatchEsterno = src.indexOf('} catch (e) {\n    // b.161-bis');
    expect(iCatchEsterno).toBeGreaterThan(-1);
    const blocco = src.slice(iCatchEsterno, iCatchEsterno + 400);
    expect(blocco).toContain("release(riservaId, 'errore_imprevisto')");
  });
});

describe('/api/tts: saldo positivo ma insufficiente blocca PRIMA del fornitore, anche per CosyVoice (b.161, punto 1)', () => {
  const src = leggi('app/api/tts/route.js');

  it('il gate scatta anche solo per CosyVoice (che addebita sempre, isOwnKey irrilevante)', () => {
    const i = src.indexOf('const pagheraQualcuno');
    expect(i).toBeGreaterThan(-1);
    expect(src.slice(i, i + 150)).toContain("ttsRoute.engine === 'cosyvoice' || !isOwnKey");
  });

  it('il gate e prima del ramo cosyvoice', () => {
    const iGate = src.indexOf('const pagheraQualcuno');
    const iCosy = src.indexOf("if (ttsRoute.engine === 'cosyvoice') {");
    expect(iGate).toBeLessThan(iCosy);
  });
});

describe('/api/tts: RESERVE → PROVIDER → COMMIT/RELEASE (b.161-bis, punto 5)', () => {
  const src = leggi('app/api/tts/route.js');

  it('il gate prende una riserva vera, non piu solo creditoFinito/creditoInsufficiente', () => {
    expect(src).toContain("import { riserva, commit, release } from '../../wallet/riserva.js';");
    const i = src.indexOf('if (pagheraQualcuno) {');
    const blocco = src.slice(i, i + 600);
    expect(blocco).toContain('const r = await riserva(billingEmail, costoPrevisto');
    expect(blocco).toContain('riservaId = r.riservaId;');
  });

  it('la chiave propria dell\'utente rilascia la riserva invece di addebitare (mai un doppio conto se CosyVoice fallisce e si ripiega su OpenAI a chiave propria)', () => {
    const i = src.indexOf('async function addebitaTTS(usataChiavePropria) {');
    const blocco = src.slice(i, i + 250);
    expect(blocco).toContain("release(riservaId, 'chiave_propria')");
  });

  it('la rete di sicurezza nel catch esterno rilascia la riserva se ENTRAMBI i fornitori falliscono', () => {
    const i = src.lastIndexOf('} catch (e) {');
    const blocco = src.slice(i, i + 300);
    expect(blocco).toContain("release(riservaId, 'errore_imprevisto')");
  });
});

describe('/api/transcribe: saldo positivo ma insufficiente blocca PRIMA di Whisper (b.161, punto 1)', () => {
  const src = leggi('app/api/transcribe/route.js');

  // b.161-bis (punto 5, "Reserve → Provider → Commit/Release non ancora
  // implementato") ha sostituito qui il preventivo creditoInsufficiente
  // con una vera riserva atomica: vedi il blocco dedicato piu sotto.
  it('la riserva usa la stessa stima (durata dichiarata o peso audio, il maggiore) usata poi per il commit', () => {
    const i = src.indexOf('const costoPrevisto = Math.ceil(Math.max(durataSec, stimaDalPeso));');
    expect(i).toBeGreaterThan(-1);
    const iCheck = src.indexOf('await riserva(pagante, costoPrevisto');
    expect(iCheck).toBeGreaterThan(i);
    const iTranscribe = src.indexOf('openai.audio.transcriptions.create(');
    expect(iCheck).toBeLessThan(iTranscribe);
    const iCommit = src.indexOf('await commit(riservaId, costoPrevisto');
    expect(iCommit).toBeGreaterThan(iTranscribe);
  });
});

describe('/api/transcribe: RESERVE → PROVIDER → COMMIT/RELEASE (b.161-bis, punto 5)', () => {
  const src = leggi('app/api/transcribe/route.js');

  it('importa riserva/commit/release dal nuovo modulo wallet, non piu creditoInsufficiente/addebitaVoce come funzioni usate', () => {
    expect(src).toContain("import { riserva, commit, release } from '../../wallet/riserva.js';");
    expect(src).not.toContain('import { creditoFinito, creditoInsufficiente, addebitaVoce }');
    expect(src).not.toContain('await creditoInsufficiente(');
    expect(src).not.toContain('await addebitaVoce(');
  });

  it('un fallimento della riserva blocca con 402 PRIMA di aprire il file audio o chiamare Whisper', () => {
    const iRiserva = src.indexOf('const r = await riserva(pagante, costoPrevisto');
    const i402 = src.indexOf("status: 402 }", iRiserva);
    const iWriteFile = src.indexOf('await writeFile(tempPath, buffer);');
    expect(iRiserva).toBeGreaterThan(-1);
    expect(i402).toBeGreaterThan(iRiserva);
    expect(i402).toBeLessThan(iWriteFile);
  });

  it('un fallimento di Whisper rilascia la riserva INTERA prima di rilanciare l\'errore (mai un uso non consegnato addebitato)', () => {
    const iCatchWhisper = src.indexOf('} catch (e) {\n      // Whisper');
    expect(iCatchWhisper).toBeGreaterThan(-1);
    const blocco = src.slice(iCatchWhisper, src.indexOf('throw e;', iCatchWhisper));
    expect(blocco).toContain("release(riservaId, 'whisper_fallito')");
    expect(blocco).toContain('riservaId = null');
  });

  it('la rete di sicurezza nel catch esterno rilascia una riserva ancora attiva per qualunque altro errore imprevisto', () => {
    const iCatchEsterno = src.lastIndexOf('} catch (e) {');
    const blocco = src.slice(iCatchEsterno);
    expect(blocco).toContain("release(riservaId, 'errore_imprevisto')");
  });

  it('riservaId torna a null subito dopo il commit, cosi la rete di sicurezza non tocca piu una riserva gia confermata', () => {
    const iCommit = src.indexOf('await commit(riservaId, costoPrevisto');
    expect(src.slice(iCommit, iCommit + 120)).toContain('riservaId = null');
  });

  it('creditoEsaurito viene derivato da creditoFinito DOPO il commit, per preservare il segnale UX gia usato dal client', () => {
    const iCommit = src.indexOf('await commit(riservaId, costoPrevisto');
    const iCreditoFinito = src.indexOf('creditoEsaurito = await creditoFinito(pagante);');
    expect(iCreditoFinito).toBeGreaterThan(iCommit);
  });
});

describe('apiAuth.js: il percorso roomId richiede un roomSessionToken verificato (b.161, punto 2)', () => {
  const src = leggi('app/lib/apiAuth.js');

  it('resolveRoomIdentity e chiamata nel ramo roomId, prima di fatturare all\'host', () => {
    const i = src.indexOf('} else if (roomId) {');
    const iEmail = src.indexOf('billingEmail = room.hostEmail;');
    const blocco = src.slice(i, iEmail);
    expect(blocco).toContain('await resolveRoomIdentity(roomSessionToken, null, roomId)');
    expect(blocco).toMatch(/if\s*\(!identitaStanza\)\s*\{[\s\S]*?status:\s*401/);
  });

  it('resolveAuth accetta roomSessionToken come parametro', () => {
    expect(src).toMatch(/roomSessionToken\s*=\s*null,/);
  });

  it('resolveRoomIdentity e importata da store.js', () => {
    expect(src).toContain("import { getRoom, resolveRoomIdentity } from './store.js';");
  });
});

describe('Rotte a pagamento: roomSessionToken passato a resolveAuth quando si usa roomId (b.161, punto 2)', () => {
  it('translate: roomSessionToken letto dal body grezzo e passato a resolveAuth (schema non lo whitelist-a)', () => {
    const src = leggi('app/api/translate/route.js');
    expect(src).toContain("const roomSessionToken = typeof rawBody.roomSessionToken === 'string' ? rawBody.roomSessionToken : null;");
    // b.170 — resolveAuth restituisce anche la riserva-budget (vedi
    // apiAuth.js): l'ancora segue la nuova destrutturazione.
    const i = src.indexOf('let { apiKey, isOwnKey, billingEmail, isLending, lendingCodeUsed, riservatoUtenteCents, riservatoPiattaformaCents } = await resolveAuth({');
    expect(i).toBeGreaterThan(-1);
    expect(src.slice(i, src.indexOf('});', i))).toContain('roomSessionToken,');
  });

  it('translate: anche il retry GPT-4o passa roomSessionToken (stessa stanza, stesso controllo)', () => {
    const src = leggi('app/api/translate/route.js');
    const i = src.indexOf('const retryAuth = await resolveAuth({');
    expect(src.slice(i, src.indexOf('});', i))).toContain('roomSessionToken');
  });

  it('tts: roomSessionToken letto dal body grezzo e passato a resolveAuth', () => {
    const src = leggi('app/api/tts/route.js');
    expect(src).toContain("const roomSessionToken = typeof body.roomSessionToken === 'string' ? body.roomSessionToken : null;");
    // b.170 — vedi la nota gemella qui sopra sulla nuova destrutturazione.
    const i = src.indexOf('const { apiKey, isOwnKey, billingEmail, riservatoUtenteCents, riservatoPiattaformaCents } = await resolveAuth({');
    expect(i).toBeGreaterThan(-1);
    expect(src.slice(i, src.indexOf('});', i))).toContain('roomSessionToken,');
  });

  it('transcribe: roomSessionToken letto dalla FormData e passato a resolveAuth', () => {
    const src = leggi('app/api/transcribe/route.js');
    expect(src).toContain("const roomSessionToken = formData.get('roomSessionToken') || '';");
    const i = src.indexOf('const { apiKey, isOwnKey, billingEmail, riservatoUtenteCents, riservatoPiattaformaCents } = await resolveAuth({');
    expect(i).toBeGreaterThan(-1);
    expect(src.slice(i, src.indexOf('});', i))).toContain('roomSessionToken: roomSessionToken || undefined,');
  });

  it('tts-elevenlabs: roomSessionToken destrutturato dal body e passato a resolveAuth', () => {
    const src = leggi('app/api/tts-elevenlabs/route.js');
    // b.238 — il controllo non fissa piu la lista ESATTA dei campi: bloccava
    // ogni aggiunta innocua al body (qui `speechMode`, la prosodia) pur non
    // avendo niente a che vedere con la sicurezza. Cio che deve restare vero
    // e che i campi della FATTURAZIONE siano destrutturati da req.json() —
    // e che roomSessionToken arrivi a resolveAuth (verificato sotto).
    const destrutturazione = src.match(/const\s*\{[^}]*\}\s*=\s*await req\.json\(\);/);
    expect(destrutturazione, 'il body va letto una volta sola, per destrutturazione').not.toBeNull();
    for (const campo of ['text', 'voiceId', 'langCode', 'userToken', 'roomId', 'roomSessionToken']) {
      expect(destrutturazione[0], `manca ${campo}`).toContain(campo);
    }
    const i = src.indexOf('const { apiKey, isOwnKey, billingEmail, riservatoUtenteCents, riservatoPiattaformaCents } = await resolveAuth({');
    expect(i).toBeGreaterThan(-1);
    expect(src.slice(i, src.indexOf('});', i))).toContain('roomSessionToken,');
  });
});

describe('stt-token: stesso difetto e stessa correzione (roomId da solo non fattura piu, b.161, punto 2)', () => {
  const src = leggi('app/api/stt-token/route.js');

  it('risolviEmailDaFatturare verifica resolveRoomIdentity prima di leggere room.hostEmail', () => {
    const i = src.indexOf('async function risolviEmailDaFatturare');
    const corpo = src.slice(i, src.indexOf('async function handler'));
    const iVerifica = corpo.indexOf('await resolveRoomIdentity(roomSessionToken, null, roomId)');
    const iHostEmail = corpo.indexOf('room.hostEmail');
    expect(iVerifica).toBeGreaterThan(-1);
    expect(iHostEmail).toBeGreaterThan(iVerifica);
  });

  it('roomSessionToken e letto dal body e passato alla verifica', () => {
    expect(src).toContain("const roomSessionToken = body.roomSessionToken || null;");
    expect(src).toContain('risolviEmailDaFatturare(userToken, roomId, roomSessionToken)');
  });
});

describe('/api/translate: il retry GPT-4o riporta la vera isOwnKey del retry, non salta piu il credito (b.161, punto 3)', () => {
  const src = leggi('app/api/translate/route.js');

  it('non passa piu skipCreditCheck:true al retry (il controllo credito ora e quello vero)', () => {
    const i = src.indexOf('const retryAuth = await resolveAuth({');
    const blocco = src.slice(i, src.indexOf('});', i));
    expect(blocco).not.toContain('skipCreditCheck');
  });

  it('se il retry NON usa una chiave propria, isOwnKey esterna si allinea (diventa false)', () => {
    const i = src.indexOf('const retryAuth = await resolveAuth({');
    const dopo = src.slice(i, i + 400);
    expect(dopo).toMatch(/if\s*\(isOwnKey\s*&&\s*!retryAuth\.isOwnKey\)\s*\{\s*isOwnKey\s*=\s*false;/);
  });

  it('un fallimento del retryAuth (wallet esaurito) non manda in crash: si tiene il testo originale', () => {
    const i = src.indexOf('const retryAuth = await resolveAuth({');
    const blocco = src.slice(i - 20, i + 500);
    expect(blocco).toContain('} catch { /* wallet esaurito o chiave assente: niente retry pagato, si tiene il testo originale */ }');
  });
});

describe('/api/wallet/admin: voucher/accredito validati, ADMIN_PASS a tempo costante (b.161, punto 10)', () => {
  const src = leggi('app/api/wallet/admin/route.js');

  it('autorizzato() usa safeCompare (timing-safe), non piu === a tempo variabile', () => {
    expect(src).toContain('import { withApiGuard, safeCompare } from');
    expect(src).toContain('return !!process.env.ADMIN_PASS && safeCompare(pass, process.env.ADMIN_PASS);');
    expect(src).not.toMatch(/pass === process\.env\.ADMIN_PASS/);
  });

  it('minutiValidi respinge negativi, zero, non numeri E valori sopra il tetto — condiviso da accredita e voucher', () => {
    const i = src.indexOf('const minutiValidi =');
    expect(i).toBeGreaterThan(-1);
    const riga = src.slice(i, src.indexOf('\n', i));
    expect(riga).toContain('Number.isFinite(minuti)');
    expect(riga).toContain('minuti > 0');
    expect(riga).toContain('minuti <= MAX_MINUTI_ADMIN');
    // azione 'voucher' deve usare la STESSA guardia, non piu il vecchio `!minuti`
    const iVoucher = src.indexOf("if (azione === 'voucher')");
    const bloccoVoucher = src.slice(iVoucher, src.indexOf("db().from('vouchers')", iVoucher));
    expect(bloccoVoucher).toContain('!minutiValidi');
    expect(bloccoVoucher).not.toMatch(/if\s*\(!codice\s*\|\|\s*!minuti\)/);
  });

  it("'accredita' verifica che l'utente esista davvero (getUser) prima di scrivere il ledger", () => {
    const iAccredita = src.indexOf("if (azione === 'accredita')");
    const iInsert = src.indexOf("db().from('credit_ledger')", iAccredita);
    const blocco = src.slice(iAccredita, iInsert);
    expect(blocco).toContain('await getUser(');
    expect(blocco).toMatch(/if\s*\(!utenteEsiste\)\s*\{[\s\S]*?status:\s*404/);
  });
});

describe('Cron rimborso regali: esiste ora, chiama la RPC gia blindata (b.161, punto 8)', () => {
  it('wallet/regali.js espone rimborsaRegaliScaduti, che chiama wallet_rimborsa_regali', () => {
    const src = leggi('app/wallet/regali.js');
    expect(src).toContain('export async function rimborsaRegaliScaduti()');
    expect(src).toContain(".rpc('wallet_rimborsa_regali')");
  });

  it('la rotta cron esiste, richiede ADMIN_PASS o CRON_SECRET (timing-safe)', () => {
    const src = leggi('app/api/wallet/cron-rimborso-regali/route.js');
    // b.363 — l'import ha guadagnato withApiGuard (il tetto ai tentativi
    // messo sulla rotta oggi): qui conta che safeCompare arrivi ancora da
    // apiGuard.js, non l'elenco letterale di cosa altro viaggia con lei.
    expect(src).toMatch(/import \{[^}]*\bsafeCompare\b[^}]*\} from '\.\.\/\.\.\/\.\.\/lib\/apiGuard\.js';/);
    expect(src).toContain('safeCompare(pass, process.env.ADMIN_PASS)');
    expect(src).toContain('safeCompare(pass, process.env.CRON_SECRET)');
    expect(src).toContain('rimborsaRegaliScaduti()');
  });

  it('vercel.json ha una voce cron per la nuova rotta', () => {
    const conf = JSON.parse(leggi('vercel.json'));
    const voce = conf.crons.find(c => c.path === '/api/wallet/cron-rimborso-regali');
    expect(voce).toBeTruthy();
  });

  it('/api/wallet/snapshot usa ora safeCompare anche lui (stessa classe di difetto)', () => {
    const src = leggi('app/api/wallet/snapshot/route.js');
    expect(src).toContain('safeCompare(pass, process.env.ADMIN_PASS)');
  });
});

describe('Migrazione 009: CHECK secondi>0 su vouchers/gifts, credit_ledger intatto (b.161, punto 10)', () => {
  it('la migrazione esiste e aggiunge i due CHECK, senza toccare credit_ledger (firmato di proposito)', () => {
    const src = leggi('supabase/migrations/009_check_secondi_positivi.sql');
    expect(src).toContain('ALTER TABLE vouchers ADD CONSTRAINT vouchers_secondi_positivi CHECK (secondi > 0);');
    expect(src).toContain('ALTER TABLE gifts ADD CONSTRAINT gifts_secondi_positivi CHECK (secondi > 0);');
    expect(src).not.toContain('ALTER TABLE credit_ledger');
  });
});
