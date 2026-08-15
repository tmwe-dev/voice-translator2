// Shared 3-tier API authentication middleware
// Pattern: userToken → roomId (bill host) → reject 401
//
// Returns: { apiKey, isOwnKey, billingEmail } or throws a Response

import { createLogger } from './logger.js';
import { NextResponse } from 'next/server';

const log = createLogger('auth');
import { getSession, getUser, validateLending } from './users.js';
import { getRoom } from './store.js';
import { ERRORS, DAILY_LIMITS } from './config.js';
import { redis } from './redis.js';
import { creditoFinito } from '../wallet/addebita.js';

/**
 * Resolve API key and billing for a paid API route.
 *
 * @param {Object} opts
 * @param {string} opts.userToken - session token (authenticated user)
 * @param {string} opts.roomId - room ID (guest billing to host)
 * @param {string} opts.provider - 'openai' or 'elevenlabs'
 * @param {number} opts.minCredits - minimum credits required (euro-cents)
 * @param {boolean} opts.skipCreditCheck - skip credit check (e.g. for review passes)
 * @param {string} opts.requiredHostTier - minimum host tier for guest access (default: any non-FREE)
 *
 * @returns {{ apiKey: string, isOwnKey: boolean, billingEmail: string|null }}
 * @throws {NextResponse} 401/402 on auth or credit failure
 */
export async function resolveAuth({
  userToken,
  roomId,
  lendingCode = null,
  provider = 'openai',
  minCredits = 0.1,
  skipCreditCheck = false,
  requiredHostTier = null, // null = any non-FREE tier
}) {
  const envKeys = {
    openai: process.env.OPENAI_API_KEY,
    elevenlabs: process.env.ELEVENLABS_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
  };
  const defaultKey = envKeys[provider] || process.env.OPENAI_API_KEY;

  // ── DEV_MODE: bypass ALL auth, use platform keys, no billing ──
  // Security: DEV_MODE is NOT allowed in production environments
  if (process.env.DEV_MODE === 'true') {
    if (process.env.VERCEL_ENV === 'production') {
      log.error('DEV_MODE cannot be enabled in production!');
      // Don't bypass auth in production - proceed with normal auth checks
    } else {
      // DEV_MODE allowed in preview/development
      return {
        apiKey: defaultKey,
        isOwnKey: false,
        billingEmail: null,
        isLending: false,
        lendingCodeUsed: null,
      };
    }
  }

  let apiKey = defaultKey;
  let isOwnKey = false;
  let billingEmail = null;
  let isLending = false;
  let lendingCodeUsed = null;

  if (userToken) {
    // Path 1: Authenticated user (host or user with own account)
    const session = await getSession(userToken);
    // b.154 — CONFERMATO da audit esterno (14/8) e verificato qui: un
    // token PRESENTE ma NON valido (scaduto, falsificato, sessione
    // sparita) prima non veniva respinto. Il controllo restava dentro
    // `if (session)`, e se `session` era null il blocco non faceva
    // nulla: si usciva dall'if/else if/else if senza throw, e si
    // arrivava in fondo con billingEmail ancora null — cioe con la
    // STESSA porta aperta della modalita "nessun token" (sotto), ma
    // con la differenza che qui l'utente HA dichiarato un token: un
    // token rotto o rubato non deve mai finire uguale a "nessuno".
    if (!session) {
      throw NextResponse.json({ error: ERRORS.UNAUTHORIZED }, { status: 401 });
    }
    {
      billingEmail = session.email;
      const user = await getUser(billingEmail);
      if (user) {
        const ownKey = user.useOwnKeys && user.apiKeys?.[provider];
        if (ownKey) {
          apiKey = ownKey;
          isOwnKey = true;
        } else {
          // Fallback: check encrypted key vault
          if (!ownKey && user.useOwnKeys) {
            try {
              const { getDecryptedKey } = await import('./keyVault.js');
              const vaultKey = await getDecryptedKey(billingEmail, provider);
              if (vaultKey) {
                apiKey = vaultKey;
                isOwnKey = true;
              }
            } catch (e) {
              log.error('KeyVault fallback error:', e);
            }
          }
        }
        // ── Credito: l'UNICA verità è il wallet (ledger Supabase) ──
        // Il vecchio user.credits (Redis, centesimi) non decide più nulla:
        // chi compra/riceve secondi nel wallet può usare il servizio.
        //
        // b.159 — CONFERMATO (audit b.158, punto 9): la condizione aveva
        // ANCHE `&& !user.useOwnKeys`. Se l'utente aveva useOwnKeys=true
        // ma la chiave vera mancava (mai salvata, cancellata, vault
        // rotto), `isOwnKey` restava false e `apiKey` ripiegava sulla
        // chiave di PIATTAFORMA (vedi `defaultKey` in cima) — ma
        // `!user.useOwnKeys` era false, quindi l'intera condizione era
        // false e il controllo saltava del tutto: chiave di piattaforma
        // usata, nessun controllo credito, per chiunque avesse attivato
        // "usa la tua chiave" senza (piu) averne una valida. Cio che
        // conta e' quale chiave viene DAVVERO usata (isOwnKey), non la
        // preferenza dichiarata.
        if (!isOwnKey && !skipCreditCheck && await creditoFinito(billingEmail)) {
          throw NextResponse.json({ error: ERRORS.NO_CREDITS }, { status: 402 });
        }
      }
    }
  } else if (lendingCode) {
    // Path 2: Lending token — bill to lender, use their keys
    const lending = await validateLending(lendingCode);
    if (!lending) {
      throw NextResponse.json({ error: 'Invalid or expired lending token' }, { status: 401 });
    }
    billingEmail = lending.lenderEmail;
    isLending = true;
    lendingCodeUsed = lendingCode;
    const lenderUser = await getUser(lending.lenderEmail);
    if (lenderUser) {
      const ownKey = lenderUser.useOwnKeys && lenderUser.apiKeys?.[provider];
      if (ownKey) {
        apiKey = ownKey;
        isOwnKey = true;
      } else {
        // Fallback: check encrypted key vault
        if (!ownKey && lenderUser.useOwnKeys) {
          try {
            const { getDecryptedKey } = await import('./keyVault.js');
            const vaultKey = await getDecryptedKey(billingEmail, provider);
            if (vaultKey) {
              apiKey = vaultKey;
              isOwnKey = true;
            }
          } catch (e) {
            log.error('KeyVault fallback error:', e);
          }
        }
      }
      // Credito del prestatore: decide il wallet
      // b.159 — stesso difetto e stessa correzione del percorso userToken
      // qui sopra: conta la chiave REALMENTE usata (isOwnKey), non
      // lenderUser.useOwnKeys.
      if (!isOwnKey && !skipCreditCheck && await creditoFinito(billingEmail)) {
        throw NextResponse.json({ error: 'Lender has insufficient credits' }, { status: 402 });
      }
    }
  } else if (roomId) {
    // Path 3: Guest in a room - bill to host
    const room = await getRoom(roomId);
    if (!room) {
      throw NextResponse.json({ error: ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    // Check host tier requirement
    if (requiredHostTier) {
      if (room.hostTier !== requiredHostTier) {
        throw NextResponse.json({ error: ERRORS.UNAUTHORIZED }, { status: 401 });
      }
    } else {
      // Require non-FREE tier for guest access
      if (room.hostTier === 'FREE') {
        throw NextResponse.json({ error: ERRORS.UNAUTHORIZED }, { status: 401 });
      }
    }

    if (room.hostEmail) {
      billingEmail = room.hostEmail;
      const hostUser = await getUser(billingEmail);
      if (hostUser) {
        const ownKey = hostUser.useOwnKeys && hostUser.apiKeys?.[provider];
        if (ownKey) {
          apiKey = ownKey;
          isOwnKey = true;
        } else {
          // Fallback: check encrypted key vault
          if (!ownKey && hostUser.useOwnKeys) {
            try {
              const { getDecryptedKey } = await import('./keyVault.js');
              const vaultKey = await getDecryptedKey(billingEmail, provider);
              if (vaultKey) {
                apiKey = vaultKey;
                isOwnKey = true;
              }
            } catch (e) {
              log.error('KeyVault fallback error:', e);
            }
          }
        }
        // Credito dell'host (regola inviti: paga chi apre): decide il wallet
        // b.159 — stesso difetto e stessa correzione del percorso userToken
        // qui sopra: conta la chiave REALMENTE usata (isOwnKey), non
        // hostUser.useOwnKeys.
        if (!isOwnKey && !skipCreditCheck && await creditoFinito(billingEmail)) {
          throw NextResponse.json({ error: ERRORS.HOST_NO_CREDITS }, { status: 402 });
        }
      }
    }
  } else {
    // Path 4: No token, no room, no lending — accesso libero dichiarato
    // (chiave di piattaforma, nessun utente da addebitare). NON esce
    // piu subito: prima usciva qui con un `return`, saltando A PIEDI
    // PARI il controllo sotto — compreso il tetto di spesa TOTALE
    // della piattaforma (€100/giorno), che quindi non si applicava
    // affatto alle chiamate anonime. Confermato dall'audit esterno
    // del 14/8 e verificato leggendo il codice: qui sotto restava
    // solo `if (billingEmail && ...)`, mai vero per questo percorso.
    // Ora si prosegue fino al blocco condiviso: l'identita resta
    // "nessuno" (niente addebito personale, e coerente), ma il tetto
    // di piattaforma la copre come ogni altra chiamata.
  }

  // For ElevenLabs, ensure we have a key
  if (provider === 'elevenlabs' && !apiKey) {
    throw NextResponse.json({ error: 'No ElevenLabs API key configured' }, { status: 400 });
  }

  // Check daily spending limits (only for platform credits, not own keys)
  if (!isOwnKey && !skipCreditCheck) {
    try {
      const todayUTC = new Date().toISOString().split('T')[0];

      // Il limite PER UTENTE serve solo se c'e un utente identificato
      // da addebitare — anonimo non ha una chiave utente da limitare
      // qui (lo protegge comunque withApiGuard per IP).
      if (billingEmail) {
        const dailyKey = `daily:${billingEmail}:${todayUTC}`;
        // b.107 — parseFloat, non parseInt: da quando il contatore somma il
        // valore vero, i decimali contano. Con parseInt "4.7" diventava 4.
        const dailySpent = parseFloat(await redis('GET', dailyKey) || '0') || 0;

        if (DAILY_LIMITS.PER_USER > 0 && dailySpent >= DAILY_LIMITS.PER_USER) {
          throw NextResponse.json({ error: ERRORS.DAILY_LIMIT }, { status: 429 });
        }
      }

      // Check platform total daily spend — SEMPRE, anche per l'accesso
      // libero: e l'unico tetto che protegge la piattaforma quando non
      // c'e nessun billingEmail da limitare singolarmente.
      const platformDailyKey = `daily:platform:${todayUTC}`;
      const platformSpent = parseFloat(await redis('GET', platformDailyKey) || '0') || 0;
      if (DAILY_LIMITS.PLATFORM_TOTAL > 0 && platformSpent >= DAILY_LIMITS.PLATFORM_TOTAL) {
        throw NextResponse.json({ error: ERRORS.PLATFORM_LIMIT }, { status: 503 });
      }
    } catch (e) {
      // If it's a NextResponse (our own error), re-throw it
      if (e instanceof Response || e?.status) throw e;
      // Otherwise log and continue (fail-open for Redis errors)
      log.error('Daily limit check error:', e);
    }
  }

  return { apiKey, isOwnKey, billingEmail, isLending, lendingCodeUsed };
}

/**
 * Track daily spending after a successful API call
 * Call this after deducting credits
 */
export async function trackDailySpend(email, amountCents) {
  if (amountCents <= 0) return;
  try {
    const todayUTC = new Date().toISOString().split('T')[0];
    // b.154 — il tetto di piattaforma (€100/giorno) si controlla ANCHE
    // per le chiamate anonime (resolveAuth Path 4), ma se qui si
    // usciva senza `email` il contatore `daily:platform:...` non
    // veniva MAI incrementato per quelle chiamate: il tetto controllato
    // in resolveAuth restava sempre a zero, quindi mai vero. Senza
    // email si aggiorna solo il contatore di piattaforma, non quello
    // personale (che non esiste, per definizione, per l'anonimo).
    if (!email) {
      await (async (chiave) => {
        const nuovo = parseFloat(await redis('INCRBYFLOAT', chiave, amountCents)) || 0;
        if (nuovo <= amountCents + 1e-9) await redis('EXPIRE', chiave, 90000);
      })(`daily:platform:${todayUTC}`);
      return;
    }

    // ── b.107 · qui il contatore correva dieci volte piu della spesa ──
    // Prima c'era INCRBY con Math.ceil(amountCents). INCRBY vuole numeri
    // interi, e l'arrotondamento serviva a quello — ma l'addebito minimo
    // di una traduzione e 0,1 centesimi (MIN_CHARGE.TRANSLATE), e
    // Math.ceil(0.1) fa 1.
    //
    // Cioe: si scalava un decimo di centesimo e se ne contava uno intero.
    // Il tetto di 500 (cinque euro al giorno, DAILY_LIMITS.PER_USER)
    // scattava dopo 500 traduzioni invece di 5.000, e l'utente leggeva
    // "limite di spesa giornaliero raggiunto" avendo speso CINQUANTA
    // CENTESIMI.
    //
    // INCRBYFLOAT somma il valore vero senza arrotondare, resta atomico
    // come INCRBY, e non cambia l'unita di misura: il contatore continua
    // a essere in centesimi e i tetti restano quelli scritti in config.
    const somma = async (chiave) => {
      const nuovo = parseFloat(await redis('INCRBYFLOAT', chiave, amountCents)) || 0;
      // Prima scrittura della giornata: si dà una scadenza alla chiave.
      // Il confronto e con tolleranza perche i decimali in virgola mobile
      // non tornano mai esatti al bit.
      if (nuovo <= amountCents + 1e-9) await redis('EXPIRE', chiave, 90000); // ~25 ore
    };

    await somma(`daily:${email}:${todayUTC}`);
    await somma(`daily:platform:${todayUTC}`);
  } catch (e) {
    log.error('Daily spend tracking error:', e);
  }
}
