// Shared 3-tier API authentication middleware
// Pattern: userToken → roomId (bill host) → reject 401
//
// Returns: { apiKey, isOwnKey, billingEmail } or throws a Response

import { createLogger } from './logger.js';
import { NextResponse } from 'next/server';

const log = createLogger('auth');
import { getSession, getUser, validateLending } from './users.js';
import { getRoom, resolveRoomIdentity } from './store.js';
import { ERRORS, DAILY_LIMITS, BUDGET_RESERVE_CENTS } from './config.js';
import { redis } from './redis.js';
import { creditoFinito } from '../wallet/addebita.js';

/**
 * Resolve API key and billing for a paid API route.
 *
 * @param {Object} opts
 * @param {string} opts.userToken - session token (authenticated user)
 * @param {string} opts.roomId - room ID (guest billing to host)
 * @param {string} opts.roomSessionToken - b.161: gettone di sessione della
 *   stanza (vedi createRoomSession/resolveRoomIdentity in store.js).
 *   OBBLIGATORIO quando si usa roomId: senza, il percorso roomId viene
 *   rifiutato (401). Vedi commento nel blocco Path 3 qui sotto.
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
  roomSessionToken = null,
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
    // b.534 — Qwen/Alibaba: stessa chiave DashScope gia usata dal
    // percorso di traduzione asiatico.
    qwen: process.env.DASHSCOPE_API_KEY,
    // b.227 — Grok (xAI): la chiave della piattaforma se presente.
    grok: process.env.XAI_API_KEY || process.env.GROK_API_KEY,
    xai: process.env.XAI_API_KEY || process.env.GROK_API_KEY,
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
        riservatoUtenteCents: 0,
        riservatoPiattaformaCents: 0,
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
      // b.168 — CONFERMATO (audit esterno 15/8): una sessione VALIDA il
      // cui utente non esiste piu (account cancellato, incoerenza fra
      // Redis e Supabase) cadeva qui senza mai entrare nell'`if (user)`
      // sotto — che e anche l'UNICO posto dove sta il controllo credito.
      // Il risultato: `apiKey` restava la chiave di PIATTAFORMA (il
      // default in cima alla funzione), `isOwnKey` restava false, e la
      // funzione tornava normalmente senza throw — uso gratuito, senza
      // limite, della chiave a pagamento della piattaforma, per chiunque
      // avesse un gettone di sessione che punta a un utente sparito.
      // Stessa classe di difetto gia chiusa in b.154 per il token
      // invalido: un gettone che dichiara un'identita che non risolve a
      // un account vero non e "nessuno", e un accesso da rifiutare.
      if (!user) {
        throw NextResponse.json({ error: ERRORS.UNAUTHORIZED }, { status: 401 });
      }
      {
        // ── b.422 — VIA IL RIPIEGO SULLA CASSAFORTE `api_keys_vault` ──
        // Verificato sul database vivo di produzione: la tabella
        // `api_keys_vault` NON ESISTE nello schema `public`, e nemmeno
        // `profiles`, da cui keyVault.js ricavava l'user_id prima di
        // leggerla. Quel ripiego quindi non ha MAI restituito una chiave:
        // `getDecryptedKey` usciva sempre null, e il codice proseguiva con
        // la chiave di piattaforma esattamente come fa adesso.
        // La strada VERA del BYOK e quella qui sotto — `useOwnKeys` piu le
        // chiavi cifrate AES-256-GCM su Redis (users.js) — e non si tocca.
        // Tenere accanto un ripiego che non ripiega e peggio che non averlo:
        // chi leggeva credeva che ci fosse una seconda strada.
        const ownKey = user.useOwnKeys && user.apiKeys?.[provider];
        if (ownKey) {
          apiKey = ownKey;
          isOwnKey = true;
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
    // b.170 — CONFERMATO (audit esterno 15/8): stessa disciplina fail-closed
    // gia applicata al Path 1 in b.168, mancava qui. Un prestito che punta
    // a un prestatore sparito (account cancellato, incoerenza Redis) cadeva
    // fuori dall'`if (lenderUser)` senza throw: `apiKey` restava la chiave
    // di PIATTAFORMA (default in cima), nessun controllo credito, uso
    // gratuito. Un pagante dichiarato che non esiste e' un accesso da
    // rifiutare, non da servire con la chiave BarTalk.
    if (!lenderUser) {
      throw NextResponse.json({ error: ERRORS.UNAUTHORIZED }, { status: 401 });
    }
    {
      // ── b.422 — VIA IL RIPIEGO SULLA CASSAFORTE `api_keys_vault` ──
      // Verificato sul database vivo di produzione: la tabella
      // `api_keys_vault` NON ESISTE nello schema `public`, e nemmeno
      // `profiles`, da cui keyVault.js ricavava l'user_id prima di
      // leggerla. Quel ripiego quindi non ha MAI restituito una chiave:
      // `getDecryptedKey` usciva sempre null, e il codice proseguiva con
      // la chiave di piattaforma esattamente come fa adesso.
      // La strada VERA del BYOK e quella qui sotto — `useOwnKeys` piu le
      // chiavi cifrate AES-256-GCM su Redis (users.js) — e non si tocca.
      // Tenere accanto un ripiego che non ripiega e peggio che non averlo:
      // chi leggeva credeva che ci fosse una seconda strada.
      const ownKey = lenderUser.useOwnKeys && lenderUser.apiKeys?.[provider];
      if (ownKey) {
        apiKey = ownKey;
        isOwnKey = true;
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
    //
    // b.161 — CONFERMATO (quarto audit esterno, punto 2): questo percorso
    // fatturava all'host della stanza fidandosi del solo `roomId` — 8
    // caratteri esadecimali (32 bit, vedi randomBytes(4) in
    // createRoom/store.js), enumerabile per forza bruta. Chiunque
    // indovinasse il roomId di una stanza PRO/TOP-PRO otteneva
    // traduzione/TTS/trascrizione REALI, fatturate al wallet dell'host,
    // senza mai essere entrato nella stanza. Ogni ALTRA rotta che opera
    // su una stanza (messages, room, moderazione, video...) richiede gia
    // un roomSessionToken verificato (resolveRoomIdentity, gia in
    // store.js da prima di questa correzione) — qui, sulle rotte a
    // pagamento, mancava del tutto. Ora si verifica ALLO STESSO MODO,
    // prima di decidere chi paga: un gettone assente o non valido per
    // QUESTA stanza rifiuta con 401, come un roomId inesistente.
    const room = await getRoom(roomId);
    if (!room) {
      throw NextResponse.json({ error: ERRORS.UNAUTHORIZED }, { status: 401 });
    }
    const identitaStanza = await resolveRoomIdentity(roomSessionToken, null, roomId);
    if (!identitaStanza) {
      throw NextResponse.json({ error: ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    // ═══ b.289 — "OGNUNO PAGA IL SUO" (scelta dell'host alla creazione) ═══
    // L'host abbonato puo scegliere di NON offrire la traduzione agli
    // invitati. In quel caso questa stanza non addebita MAI l'host:
    // chi ha un conto manda il suo token (e passa dal Percorso 1, non
    // da qui); chi non ce l'ha viene trattato come accesso libero —
    // chiave di piattaforma, nessun addebito personale, protetto dal
    // tetto giornaliero di piattaforma e dal limite per IP. Ordine dei
    // controlli rispettato: prima l'AUTORIZZAZIONE (gettone di stanza,
    // gia verificato sopra), poi il fornitore, senza toccare il conto.
    // ATTENZIONE: NIENTE uscita anticipata — b.154 ha gia insegnato che
    // un return qui salterebbe il tetto giornaliero di PIATTAFORMA nel
    // blocco condiviso in fondo. Si marca e si prosegue: chiave di
    // piattaforma, nessun conto personale.
    if (!room.ognunoPagaIlSuo) {

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
      // b.170 — CONFERMATO (audit esterno 15/8): stessa disciplina
      // fail-closed del Path 1 (b.168) e del prestito qui sopra. Una
      // stanza il cui hostEmail non risolve piu a un account (host
      // cancellato, incoerenza) faceva cadere l'ospite fuori dall'`if
      // (hostUser)` senza throw: chiave di piattaforma, nessun controllo
      // credito, traduzioni gratis per gli ospiti di una stanza il cui
      // host non esiste. Se e' dichiarato un pagante (room.hostEmail) ma
      // quel pagante non esiste, si rifiuta.
      if (!hostUser) {
        throw NextResponse.json({ error: ERRORS.HOST_NO_CREDITS }, { status: 402 });
      }
      {
        // ── b.422 — VIA IL RIPIEGO SULLA CASSAFORTE `api_keys_vault` ──
        // Verificato sul database vivo di produzione: la tabella
        // `api_keys_vault` NON ESISTE nello schema `public`, e nemmeno
        // `profiles`, da cui keyVault.js ricavava l'user_id prima di
        // leggerla. Quel ripiego quindi non ha MAI restituito una chiave:
        // `getDecryptedKey` usciva sempre null, e il codice proseguiva con
        // la chiave di piattaforma esattamente come fa adesso.
        // La strada VERA del BYOK e quella qui sotto — `useOwnKeys` piu le
        // chiavi cifrate AES-256-GCM su Redis (users.js) — e non si tocca.
        // Tenere accanto un ripiego che non ripiega e peggio che non averlo:
        // chi leggeva credeva che ci fosse una seconda strada.
        const ownKey = hostUser.useOwnKeys && hostUser.apiKeys?.[provider];
        if (ownKey) {
          apiKey = ownKey;
          isOwnKey = true;
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

    // b.289 — fine del ramo "offre l'host". Con "ognuno paga il suo" si
    // arriva qui direttamente: chiave di piattaforma, nessun conto
    // personale, e il tetto di piattaforma del blocco condiviso vale.
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
  //
  // b.170 — CONFERMATO (audit esterno 15/8): qui si leggeva il contatore
  // (GET) e si confrontava, ma si scriveva l'incremento VERO solo a
  // chiamata finita (trackDailySpend, sotto) — spesso un secondo o piu
  // dopo. Richieste concorrenti arrivate in quella finestra leggevano
  // tutte lo stesso valore "sotto tetto" e passavano tutte: il tetto
  // sforava di quanto valevano le chiamate in volo in quel momento.
  //
  // Decisione dell'utente: non serve precisione assoluta — un margine
  // di sforamento contenuto (qualche minuto di traffico) e accettabile,
  // non lo e una finestra senza fondo. Ora si RISERVA atomicamente
  // BUDGET_RESERVE_CENTS (INCRBYFLOAT, non piu GET+confronto) prima di
  // ogni chiamata a pagamento: se il totale risultante mostra che il
  // tetto era GIA superato PRIMA di questa riserva, la si annulla e si
  // rifiuta — stesso confine di prima (`speso >= tetto`), ma senza la
  // finestra, perche le richieste concorrenti sono ora serializzate
  // dall'incremento atomico invece di leggere tutte lo stesso valore
  // vecchio. trackDailySpend netta questa riserva contro il costo vero
  // quando lo si conosce (sotto), cosi il contatore resta preciso.
  let riservatoUtenteCents = 0;
  let riservatoPiattaformaCents = 0;
  if (!isOwnKey && !skipCreditCheck) {
    try {
      const todayUTC = new Date().toISOString().split('T')[0];

      // Il limite PER UTENTE serve solo se c'e un utente identificato
      // da addebitare — anonimo non ha una chiave utente da limitare
      // qui (lo protegge comunque withApiGuard per IP).
      if (billingEmail) {
        const dailyKey = `daily:${billingEmail}:${todayUTC}`;
        const nuovoTotaleUtente = parseFloat(await redis('INCRBYFLOAT', dailyKey, BUDGET_RESERVE_CENTS)) || 0;
        if (nuovoTotaleUtente <= BUDGET_RESERVE_CENTS + 1e-9) await redis('EXPIRE', dailyKey, 90000);
        if (DAILY_LIMITS.PER_USER > 0 && (nuovoTotaleUtente - BUDGET_RESERVE_CENTS) >= DAILY_LIMITS.PER_USER) {
          await redis('INCRBYFLOAT', dailyKey, -BUDGET_RESERVE_CENTS); // annulla la riserva: non si procede
          throw NextResponse.json({ error: ERRORS.DAILY_LIMIT }, { status: 429 });
        }
        riservatoUtenteCents = BUDGET_RESERVE_CENTS;
      }

      // Check platform total daily spend — SEMPRE, anche per l'accesso
      // libero: e l'unico tetto che protegge la piattaforma quando non
      // c'e nessun billingEmail da limitare singolarmente.
      const platformDailyKey = `daily:platform:${todayUTC}`;
      const nuovoTotalePiattaforma = parseFloat(await redis('INCRBYFLOAT', platformDailyKey, BUDGET_RESERVE_CENTS)) || 0;
      if (nuovoTotalePiattaforma <= BUDGET_RESERVE_CENTS + 1e-9) await redis('EXPIRE', platformDailyKey, 90000);
      if (DAILY_LIMITS.PLATFORM_TOTAL > 0 && (nuovoTotalePiattaforma - BUDGET_RESERVE_CENTS) >= DAILY_LIMITS.PLATFORM_TOTAL) {
        await redis('INCRBYFLOAT', platformDailyKey, -BUDGET_RESERVE_CENTS);
        if (riservatoUtenteCents) {
          await redis('INCRBYFLOAT', `daily:${billingEmail}:${todayUTC}`, -riservatoUtenteCents);
          riservatoUtenteCents = 0;
        }
        throw NextResponse.json({ error: ERRORS.PLATFORM_LIMIT }, { status: 503 });
      }
      riservatoPiattaformaCents = BUDGET_RESERVE_CENTS;
    } catch (e) {
      // If it's a NextResponse (our own error), re-throw it
      if (e instanceof Response || e?.status) throw e;
      // Otherwise log and continue (fail-open for Redis errors)
      log.error('Daily limit check error:', e);
    }
  }

  return { apiKey, isOwnKey, billingEmail, isLending, lendingCodeUsed, riservatoUtenteCents, riservatoPiattaformaCents };
}

/**
 * Track daily spending after a successful API call
 * Call this after deducting credits
 *
 * @param {string|null} email
 * @param {number} amountCents - costo VERO della chiamata appena conclusa
 * @param {number} riservatoUtenteCents - b.170: quanto resolveAuth aveva
 *   gia riservato sul contatore personale (0 se non applicabile — vedi
 *   il campo omonimo restituito da resolveAuth)
 * @param {number} riservatoPiattaformaCents - b.170: idem, contatore di
 *   piattaforma
 */
export async function trackDailySpend(email, amountCents, riservatoUtenteCents = 0, riservatoPiattaformaCents = 0) {
  if (amountCents <= 0 && riservatoUtenteCents <= 0 && riservatoPiattaformaCents <= 0) return;
  try {
    const todayUTC = new Date().toISOString().split('T')[0];

    // b.170 — CONFERMATO (audit esterno 15/8): resolveAuth ora riserva
    // BUDGET_RESERVE_CENTS PRIMA della chiamata (vedi la nota li). Qui si
    // netta quella riserva contro il costo VERO — altrimenti ogni
    // chiamata conterebbe due volte (riserva + costo reale sommati),
    // gonfiando il contatore di una cifra fissa per chiamata e facendo
    // scattare i tetti molto prima di quanto sia stato speso davvero.
    // Se una rotta non e stata aggiornata per passare la riserva
    // (riservato*Cents omesso, default 0), il comportamento resta quello
    // di prima: si somma il costo vero, punto.
    const somma = async (chiave, riservato) => {
      const delta = amountCents - riservato;
      if (delta === 0) return;
      const nuovo = parseFloat(await redis('INCRBYFLOAT', chiave, delta)) || 0;
      // Scadenza sempre rinfrescata: se resolveAuth ha gia riservato,
      // questa non e piu la prima scrittura della giornata (la riserva
      // lo era, e l'ha gia impostata) — EXPIRE su una chiave esistente
      // si limita ad aggiornare la TTL, innocuo chiamarlo comunque.
      await redis('EXPIRE', chiave, 90000); // ~25 ore
    };

    // b.154 — il tetto di piattaforma (€100/giorno) si controlla ANCHE
    // per le chiamate anonime (resolveAuth Path 4): senza email si
    // aggiorna solo il contatore di piattaforma, non quello personale
    // (che non esiste, per definizione, per l'anonimo).
    if (email) await somma(`daily:${email}:${todayUTC}`, riservatoUtenteCents);
    await somma(`daily:platform:${todayUTC}`, riservatoPiattaformaCents);
  } catch (e) {
    log.error('Daily spend tracking error:', e);
  }
}
