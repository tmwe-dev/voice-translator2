// ═══════════════════════════════════════════════════════════════
// b.166 — CACCIA AL TESORO
//
// L'utente ha chiesto una caccia ai bug su tutto il codice (non solo
// wallet/billing, gia coperto a fondo nei round precedenti). 6 ricerche
// mirate in parallelo, ognuna verificata a mano leggendo il codice reale
// prima di correggere — non tutto cio che le ricerche hanno segnalato
// era vero (vedi il caso 'fil' sotto, scartato dopo verifica).
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');
const senzaCommenti = (s) => s.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

describe('Fuga di credenziali: le apiKeys non tornano piu in chiaro al login', () => {
  it('users.js espone maskApiKeys, usata da tutti i punti che rispondono con `user`', () => {
    const src = leggi('app/lib/users.js');
    expect(src).toContain('export function maskApiKeys(user)');
  });

  it('auth/route.js maschera sia su verify che su me', () => {
    const src = leggi('app/api/auth/route.js');
    expect(src).toContain("import { createAuthCode, verifyAuthCode, createUser, getUser, createSession, getSession, getReferralCode, applyReferral, maskApiKeys } from '../../lib/users.js';");
    expect(src).toMatch(/token: sessionToken, user: maskApiKeys\(user\)/);
    expect(src).toMatch(/user: maskApiKeys\(user\), referralCode: userReferralCode/);
  });

  it('login Apple e Google callback mascherano allo stesso modo', () => {
    const apple = leggi('app/api/auth/apple/route.js');
    expect(apple).toContain('maskApiKeys');
    expect(apple).toMatch(/user: maskApiKeys\(user\)/);

    const google = leggi('app/api/auth/google-callback/route.js');
    expect(google).toContain('maskApiKeys');
    expect(google).toMatch(/user: maskApiKeys\(user\)/);
  });

  it('test-login maschera anche lui — qui il rischio era peggiore: copiava le chiavi REALI di piattaforma', () => {
    const src = leggi('app/api/test-login/route.js');
    expect(src).toContain('maskApiKeys');
    expect(src).toMatch(/user: maskApiKeys\(\{/);
  });

  it('test-login usa safeCompare, non piu un confronto diretto (!==)', () => {
    const src = leggi('app/api/test-login/route.js');
    expect(src).toContain("import { safeCompare } from '../../lib/apiGuard.js';");
    expect(src).toContain('if (!safeCompare(body.adminPass, adminPass))');
    expect(src).not.toContain('body.adminPass !== adminPass');
  });

  it('/api/user (azione profile) ora usa lo stesso helper condiviso, non piu una copia inline', () => {
    const src = leggi('app/api/user/route.js');
    expect(src).toContain('maskApiKeys');
    expect(src).toContain('user: maskApiKeys(user)');
  });

  it('il client NON prefilla piu il campo modificabile delle chiavi col valore (ormai mascherato) del server', () => {
    const useAuth = leggi('app/hooks/useAuth.js');
    expect(useAuth).not.toMatch(/setApiKeyInputs\(\{\s*openai: data\.user\.apiKeys\.openai/);
    expect(useAuth).toContain("if (data.user.useOwnKeys && data.user.apiKeys?.elevenlabs) setIsTopPro(true);");

    const useInit = leggi('app/hooks/useInitializeApp.js');
    expect(useInit).not.toMatch(/setApiKeyInputs\(\{\s*openai: data\.user\.apiKeys\.openai/);
  });
});

describe('providers.js: userProviderPrefs non puo piu reintrodurre un provider invalido/rimosso (es. microsoft)', () => {
  const src = leggi('app/lib/providers.js');

  it('getProviderChain valida primary/secondary/tertiary contro PROVIDERS', () => {
    const i = src.indexOf('export function getProviderChain');
    const blocco = src.slice(i);
    expect(blocco).toContain("Object.prototype.hasOwnProperty.call(PROVIDERS, p)");
    expect(blocco).toContain('if (eValido(primary)) result.push(primary);');
    expect(blocco).not.toMatch(/if \(primary && primary !== 'auto'\)/);
  });

  it('SCRIPT_RANGES include ora l\'Ebraico (he)', () => {
    expect(src).toContain("'he':");
  });
});

describe('translatePrompt.js: VALID_LANG_CODES non collassa piu su "en" per lingue offerte in constants.js', () => {
  const src = leggi('app/lib/translatePrompt.js');

  it('he, ca, sw, af, nb sono in whitelist', () => {
    const i = src.indexOf('const VALID_LANG_CODES');
    const blocco = src.slice(i, src.indexOf(']);', i));
    for (const codice of ['he', 'ca', 'sw', 'af', 'nb']) {
      expect(blocco).toContain(`'${codice}'`);
    }
  });
});

describe('logger.js: un `data` stringa non sparisce piu dal log JSON di produzione', () => {
  it('formatMsg fonde anche le stringhe nell\'entry (campo detail)', () => {
    const src = leggi('app/lib/logger.js');
    expect(src).toMatch(/typeof data === 'string' && data.*detail: data/s);
  });
});

describe('/api/reazioni: il circuito Redis aperto non torna piu un 500 generico', () => {
  it('CIRCUIT_OPEN diventa 503 + Retry-After, non un errore generico perso', () => {
    const src = leggi('app/api/reazioni/route.js');
    const i = src.indexOf("e?.code === 'CIRCUIT_OPEN'");
    expect(i).toBeGreaterThan(-1);
    const blocco = src.slice(i, i + 400);
    expect(blocco).toContain('status: 503');
    expect(blocco).toContain("'Retry-After'");
  });
});

describe('/api/transcribe: sourceLang e nome file temporaneo', () => {
  const src = leggi('app/api/transcribe/route.js');

  it('il regex di validazione accetta 2-3 lettere, come schemas.js (fix per "fil"/Filipino)', () => {
    expect(src).toContain('/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/');
    expect(src).not.toContain('/^[a-z]{2}(-[A-Za-z]{2,4})?$/');
  });

  it('il nome del file temporaneo ha un componente casuale, non solo Date.now()', () => {
    expect(src).toContain("import { randomUUID } from 'crypto';");
    expect(src).toMatch(/stt-\$\{Date\.now\(\)\}-\$\{randomUUID\(\)\}/);
  });
});

describe('/api/tts: CosyVoice ora passa dallo stesso preprocessForTTS del ramo OpenAI', () => {
  it('cleanTextAsia e calcolato prima del ramo cosyvoice e usato da entrambi i rami', () => {
    const src = leggi('app/api/tts/route.js');
    const iClean = src.indexOf('const cleanTextAsia = preprocessForTTS(text, lang2);');
    const iCosy = src.indexOf("if (ttsRoute.engine === 'cosyvoice')");
    const iCosyCall = src.indexOf('ttsCosyVoice(cleanTextAsia, langCode');
    expect(iClean).toBeGreaterThan(-1);
    expect(iClean).toBeLessThan(iCosy);
    expect(iCosyCall).toBeGreaterThan(iCosy);
    expect(src).toContain('const cleanText = cleanTextAsia;');
  });
});

describe('/api/translate: max_tokens non e piu fisso a 500 per testi lunghi', () => {
  it('primaryOpts calcola maxTokens in base alla lunghezza del testo, con un tetto', () => {
    const src = leggi('app/api/translate/route.js');
    const i = src.indexOf('const maxTokensStimati');
    expect(i).toBeGreaterThan(-1);
    expect(src.slice(i, i + 200)).toContain('Math.min(4096');
    const iOpts = src.indexOf('const primaryOpts');
    expect(src.slice(iOpts, iOpts + 300)).toContain('maxTokens: maxTokensStimati');
  });
});

describe('Rotte cron/admin wallet: rate limiting sul controllo password (b.166)', () => {
  it('snapshot, cron-rimborso-regali, cron-rilascia-riserve limitano i tentativi prima del confronto password', () => {
    for (const rotta of [
      'app/api/wallet/snapshot/route.js',
      'app/api/wallet/cron-rimborso-regali/route.js',
      'app/api/wallet/cron-rilascia-riserve/route.js',
    ]) {
      const src = leggi(rotta);
      expect(src, rotta).toContain('checkRateLimit');
      const iRate = src.indexOf('checkRateLimit');
      const iSafeCompare = src.indexOf('safeCompare(pass');
      expect(iRate, rotta).toBeLessThan(iSafeCompare);
    }
  });
});

describe('PATCH /api/messages: non si puo piu riscrivere la traduzione del messaggio di un altro membro', () => {
  it('la ricerca per clientId nello script Lua richiede anche m.sender == sender', () => {
    const src = senzaCommenti(leggi('app/lib/redisLua.js'));
    expect(src).toContain('if m.clientId == messageId and m.sender == sender then');
    // Il ramo di ripiego (per testo) deve restare intatto: e ancora
    // necessario per i client vecchi che non mandano clientId.
    expect(src).toContain('if m.sender == sender and m.original == original then');
  });
});

describe('/api/mondo: pubblicare/modificare una stanza richiede davvero di esserne l\'host', () => {
  const src = leggi('app/api/mondo/route.js');

  it('importa verifyRoomSession/getRoom/puoModerare/leggiRegole, non piu solo "un token qualsiasi presente"', () => {
    expect(src).toContain("import { verifyRoomSession, getRoom } from '../../lib/store.js';");
    expect(src).toContain("import { leggiRegole } from '../../lib/moderazione.js';");
    expect(src).toContain('puoModerare');
    expect(src).not.toContain('if (!roomSessionToken && !userToken)');
  });

  it('verifica la sessione di stanza e che puoModerare() riconosca il chiamante come host, PRIMA di pubblicare/aggiornare la politica', () => {
    const iCheck = src.indexOf('const io = await verifyRoomSession(roomSessionToken);');
    const iPuoModerare = src.indexOf('if (!puoModerare(');
    const iPubblica = src.indexOf("await redis('LPUSH', MONDO_KEY");
    expect(iCheck).toBeGreaterThan(-1);
    expect(iPuoModerare).toBeGreaterThan(iCheck);
    expect(iPuoModerare).toBeLessThan(iPubblica);
  });

  it('una stanza inesistente viene rifiutata prima di qualunque scrittura', () => {
    const iGetRoom = src.indexOf('const stanzaEsistente = await getRoom(roomId);');
    const iNotFound = src.indexOf("status: 404 }", iGetRoom);
    expect(iGetRoom).toBeGreaterThan(-1);
    expect(iNotFound).toBeGreaterThan(iGetRoom);
    expect(iNotFound).toBeLessThan(iGetRoom + 150);
  });
});

describe('Creazione/ingresso stanza: avatar/context/contextPrompt/description hanno ora un limite di lunghezza', () => {
  it('handleCreate e handleJoin passano i campi da sanitize() con un maxLen esplicito', () => {
    const src = leggi('app/lib/roomActions.js');
    expect(src).toContain('const MAXLEN_AVATAR');
    expect(src).toContain('const MAXLEN_CONTEXT');
    expect(src).toContain('const MAXLEN_CONTEXT_PROMPT');
    expect(src).toContain('const MAXLEN_DESCRIPTION');
    const iCreate = src.indexOf('export async function handleCreate');
    const blocco = src.slice(iCreate, src.indexOf('export async function handleJoin'));
    expect(blocco).toContain('sanitize(avatar, MAXLEN_AVATAR)');
    expect(blocco).toContain('sanitize(context, MAXLEN_CONTEXT)');
    expect(blocco).toContain('sanitize(contextPrompt, MAXLEN_CONTEXT_PROMPT)');
    expect(blocco).toContain('sanitize(description, MAXLEN_DESCRIPTION)');
  });
});
