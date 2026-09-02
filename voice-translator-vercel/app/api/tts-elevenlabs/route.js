import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { getSession, getUser } from '../../lib/users.js';
import { resolveAuth, trackDailySpend } from '../../lib/apiAuth.js';
import { MIN_CREDITS, MIN_CHARGE, calcElevenLabsCost, usdToEurCents } from '../../lib/config.js';
import { preprocessForTTS } from '../../lib/ttsPreprocessor.js';
import { getELVoiceForLang, getELModelForLang } from '../../lib/voiceDefaults.js';
import { parametriVoce } from '../../lib/voceEspressiva.js';
import { createLogger } from '../../lib/logger.js';
import { assertElaborazioneConsentita, DirectModeError } from '../../lib/sessionGuard.js';
import { creditoFinito, preventivoVocePremium } from '../../wallet/addebita.js';
import { riserva, commit, release } from '../../wallet/riserva.js';
import { costoProviderCent, CARATTERI_PER_SECONDO } from '../../wallet/provider-costi.js';

const log = createLogger('ttsElevenlabs');

// ═══════════════════════════════════════════════
// FASE 4: ElevenLabs Flash v2.5 + adaptive stability
//
// Model hierarchy (by latency):
// 1. eleven_flash_v2_5 — 75ms latency, great quality, DEFAULT
// 2. eleven_multilingual_v2 — ~300ms latency, broader language support
// 3. eleven_v3 — latest, best for uncommon languages
//
// Languages NOT supported by flash_v2_5 (need v3 or multilingual_v2)
// ═══════════════════════════════════════════════
const V3_ONLY_LANGS = new Set(['th', 'vi', 'hu']);
// Languages where Flash v2.5 works well (Latin + common Asian)
const FLASH_SUPPORTED_LANGS = new Set([
  'en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'pl', 'sv', 'tr',
  'id', 'ms', 'cs', 'ro', 'fi', 'el', 'ru',
  'zh', 'ja', 'ko', 'ar', 'hi'
]);

// ElevenLabs language_code mapping (ISO 639-1 → ElevenLabs code)
// b.317 — audit D1: LANG_CODES e NATIVE_VOICES_BY_LANG sono saliti nel modulo
// condiviso lib/vociLingue.js, cosi anche il form dei Compagni puo leggerli
// (avviso di compatibilita voce↔lingua). Una fonte sola.
import { LANG_CODES, NATIVE_VOICES_BY_LANG } from '../../lib/vociLingue.js';

// Default curated voices per avatar gender (ElevenLabs premade voice IDs)
// Male voices:
const MALE_VOICES = {
  default: 'pNInz6obpgDQGcFmaJgB', // Adam - deep male
  alt1: 'ErXwobaYiN019PkySvjV',    // Antoni - warm male
  alt2: 'TxGEqnHWrfWFTfGW9XjX',    // Josh - young male
  alt3: 'VR6AewLTigWG4xSOukaG',    // Arnold - strong male
  alt4: 'GBv7mTt0atIp3Br8iCZE',    // Thomas - calm male
  alt5: '29vD33N1CtxCmqQRPOHJ',    // Drew - confident male
};

// Female voices:
const FEMALE_VOICES = {
  default: 'EXAVITQu4vr4xnSDxMaL', // Sarah/Bella - warm female
  alt1: '21m00Tcm4TlvDq8ikWAM',    // Rachel - natural female
  alt2: 'XB0fDUnXU5powFXDhCwa',    // Charlotte - elegant female
  alt3: 'piTKgcLEGmPE4e6mEKli',    // Nicole - friendly female
  alt4: 'MF3mGyEYCl7XYWbV9V6O',    // Elli - soft female
};

// Avatar name → voice mapping
const AVATAR_VOICE_MAP = {
  'Marcus':   MALE_VOICES.default,
  'Elena':    FEMALE_VOICES.default,
  'Omar':     MALE_VOICES.alt1,
  'Aisha':    FEMALE_VOICES.alt1,
  'Alex':     MALE_VOICES.alt2,
  'Thomas':   MALE_VOICES.alt4,
  'Yuki':     FEMALE_VOICES.alt2,
  'Margaret': FEMALE_VOICES.alt3,
  'Leo':      MALE_VOICES.alt5,
};

// ═══════════════════════════════════════════════
// AUTO VOICE-LANGUAGE MATCHING — curated native voices per language
//
// When no explicit voiceId is selected, the system picks a native-sounding
// voice for the TARGET language. This ensures Thai text is read by a
// Thai-sounding voice, not an English one.
//
// These are ElevenLabs premade voices that sound natural for each language.
// Female + male options for each. Falls back to multilingual defaults.
// ═══════════════════════════════════════════════
// (mappa spostata in lib/vociLingue.js — vedi import sopra)

async function handlePost(req) {
  // b.164 (punto 1 della roadmap dell'utente dopo b.163) — fuori dal
  // try: la rete di sicurezza nel catch esterno deve poter rilasciare
  // la riserva per QUALUNQUE errore imprevisto, anche uno che scoppia
  // prima del blocco try interno.
  let riservaId = null;
  let costoPrevisto = 0;
  try {
    const { text, voiceId, langCode, userToken, roomId, roomSessionToken, avatarName, speechMode } = await req.json();

    // ── Direct mode guard ──
    // b.167 — spostata dopo aver letto roomId/roomSessionToken: prima
    // chiedeva solo all'intestazione, ora chiede anche alla stanza.
    try {
      await assertElaborazioneConsentita(req, { roomId, roomSessionToken });
    } catch (e) {
      if (e instanceof DirectModeError) return NextResponse.json({ error: e.message }, { status: 403 });
      throw e;
    }

    if (!text?.trim()) return NextResponse.json({ error: 'No text' }, { status: 400 });

    // 3-tier auth: userToken → roomId → reject
    // Any PRO user with credits can use ElevenLabs (platform key), not just TOP PRO
    // b.161 — roomSessionToken ora obbligatorio per il percorso roomId
    // (vedi apiAuth.js, punto 2 del quarto audit): senza, resolveAuth
    // rifiuta con 401 invece di fatturare all'host su un roomId indovinato.
    const { apiKey, isOwnKey, billingEmail, riservatoUtenteCents, riservatoPiattaformaCents } = await resolveAuth({
      userToken,
      roomId,
      roomSessionToken,
      provider: 'elevenlabs',
      minCredits: MIN_CREDITS.TTS_ELEVENLABS,
    });

    // ── Wallet: la voce premium costa 3x — blocco PRIMA di chiamare ElevenLabs ──
    // b.157 — audit pagamenti: qui il guasto-nella-lettura-del-saldo va
    // in BLOCCO (failClosed), non in via libera come per gli altri
    // fornitori. E il servizio piu caro: un'interruzione di Supabase
    // non deve trasformarsi in ElevenLabs illimitato e gratis.
    const pagante = isOwnKey ? null : billingEmail;
    if (pagante && await creditoFinito(pagante, { failClosed: true })) {
      return NextResponse.json({ error: 'Credito esaurito', creditoEsaurito: true }, { status: 402 });
    }

    // ── Voice selection priority ──
    // 1. Explicit voiceId (user chose a specific voice or cloned voice)
    // 2. Admin default for language (from voiceDefaults.js — Luca configures)
    // 3. Hardcoded native voice map (fallback)
    // 4. Avatar mapping
    // 5. Global female default
    const lang2 = (langCode || '').replace(/-.*/, '');
    const genderHint = avatarName
      ? (['Marcus','Omar','Alex','Thomas','Leo'].includes(avatarName) ? 'male' : 'female')
      : 'female';
    const adminDefault = getELVoiceForLang(lang2, genderHint);
    const nativeVoice = NATIVE_VOICES_BY_LANG[lang2]?.[genderHint]
      || NATIVE_VOICES_BY_LANG[lang2]?.female;
    // b.262 — la PREDEFINITA DI SISTEMA ora la decide il backend (tabella
    // voci_lingue, pannello /voci): viene prima delle cablate qui sotto,
    // che restano il ripiego per le lingue non ancora curate. L'errore di
    // lettura non ferma la voce: si passa oltre, come sempre.
    const dbDefault = voiceId ? null
      : await import('../../lib/vociCatalogo.js')
          .then(m => m.predefinitaPer(lang2, genderHint))
          .catch(() => null);
    const selectedVoice = voiceId
      || dbDefault
      || adminDefault
      || nativeVoice
      || (avatarName && AVATAR_VOICE_MAP[avatarName])
      || FEMALE_VOICES.default;

    // ── Model selection: cloned voice → admin config → auto ──
    const isClonedVoice = voiceId && !Object.values(MALE_VOICES).includes(voiceId)
      && !Object.values(FEMALE_VOICES).includes(voiceId);
    let modelId;
    if (isClonedVoice) {
      modelId = 'eleven_multilingual_v2'; // Best quality for cloned voices
    } else {
      modelId = getELModelForLang(lang2); // From voiceDefaults.js (admin-configurable)
    }

    // Map language code for pronunciation
    const elLangCode = LANG_CODES[lang2] || undefined;

    // Preprocess text for TTS quality
    const cleanText = preprocessForTTS(text, lang2);

    // ── b.111 · il permesso si chiede prima di spendere ──
    // Il controllo sopra chiede solo "il saldo e a zero?": con un solo
    // secondo residuo si passava, si sintetizzava una frase da novanta,
    // e l'addebito dopo falliva. L'audio era gia stato prodotto e
    // consegnato: la voce premium, il servizio piu caro che abbiamo,
    // finiva regalata. Qui si chiede col conto vero, sullo stesso testo
    // che verra fatturato.
    //
    // b.164 — CONFERMATO (roadmap utente dopo b.163, punto 1): questo
    // preventivo chiudeva il bypass RIPETIBILE ma non la finestra di
    // CORSA fra richieste concorrenti — stessa classe di difetto gia
    // chiusa su transcribe/translate/tts (b.161-bis/b.162), qui ancora
    // aperta ed e' il fornitore PIU CARO (moltiplicatore 3x): la voce
    // premium era, delle rotte non ancora migrate, la piu redditizia
    // da sfruttare con due richieste in parallelo. Ora il saldo scende
    // SUBITO con una riserva atomica, prima di chiamare ElevenLabs.
    // Costo noto per intero da cleanText.length (non dipende dalla
    // risposta del fornitore): riserva e commit useranno sempre lo
    // stesso numero, come per transcribe.js.
    if (pagante) {
      costoPrevisto = preventivoVocePremium(cleanText.length);
      const secondiParlatoPrev = Math.ceil(cleanText.length / CARATTERI_PER_SECONDO);
      const r = await riserva(pagante, costoPrevisto, {
        tipo: 'voce_premium',
        caratteri: cleanText.length,
        costo_cent: costoProviderCent(secondiParlatoPrev, 'gpt-5.4-mini', 'elevenlabs-flash'),
      });
      if (!r.ok) {
        return NextResponse.json({
          error: 'Credito insufficiente per la voce premium',
          creditoEsaurito: true,
          servono: costoPrevisto,
        }, { status: 402 });
      }
      riservaId = r.riservaId;
    }

    // ── Adaptive voice settings for tonal languages ──
    // Tonal languages need higher stability to preserve tone accuracy
    const TONAL_LANGS = new Set(['th', 'zh', 'vi', 'ja']);
    const tonale = TONAL_LANGS.has(lang2);
    const stabilityBase = tonale ? 0.75 : 0.65;
    const similarityBoost = tonale ? 0.85 : 0.80;
    // b.238 — PROSODIA. `style` era 0.0 fisso: il canale espressivo esisteva
    // ed era spento, e ogni Compagno leggeva tutto con lo stesso tono. Ora
    // chi parla dichiara COME vuole dirlo (speechMode) e voceEspressiva.js
    // lo traduce. Senza speechMode nulla cambia rispetto a prima: la
    // TRADUZIONE fra persone resta neutra per fedeltà, ed è quello che deve
    // essere — lì si riporta cosa ha detto un altro, non lo si interpreta.
    const { stability, style } = parametriVoce({ stability: stabilityBase, modo: speechMode, tonale });

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text: cleanText,
        model_id: modelId,
        // b.317 — audit D8: `language_code` è accettato SOLO da flash/turbo
        // v2.5; mandarlo a multilingual_v2 (o v3) fa rifiutare la richiesta —
        // e siccome anche il ripiego lo mandava, il ripiego falliva SEMPRE e
        // la voce spariva in silenzio. Ora si allega solo dove è supportato.
        ...((modelId === 'eleven_flash_v2_5' || modelId === 'eleven_turbo_v2_5') && elLangCode ? { language_code: elLangCode } : {}),
        voice_settings: {
          stability,
          similarity_boost: similarityBoost,
          style,
          use_speaker_boost: true
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      log.error('ElevenLabs TTS error:', response.status, errText);

      // Fallback chain: flash_v2_5 → multilingual_v2 → v3, or v3 → multilingual_v2
      const fallbackModel = modelId === 'eleven_v3' ? 'eleven_multilingual_v2'
        : modelId === 'eleven_flash_v2_5' ? 'eleven_multilingual_v2'
        : null;

      if (fallbackModel) {
        log.info(`${modelId} failed, trying ${fallbackModel} fallback`);
        const fallback = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}`, {
          method: 'POST',
          headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
          body: JSON.stringify({
            text: cleanText, model_id: fallbackModel,
            // b.317 — D8: multilingual_v2 NON accetta language_code (vedi sopra).
            voice_settings: { stability, similarity_boost: similarityBoost, style, use_speaker_boost: true }
          })
        });
        if (fallback.ok) {
          const buf = Buffer.from(await fallback.arrayBuffer());
          if (!isOwnKey) {
            // b.154 — vedi nota gemella sotto: il tetto di piattaforma
            // deve contare anche l'anonimo, l'addebito personale no.
            // b.157 — tolto il doppio addebito sul vecchio user.credits:
            // il commit della riserva (poco sotto) e il conto vero, questo
            // scriveva un numero in un campo che nessuno legge piu.
            const cost = usdToEurCents(calcElevenLabsCost(cleanText.length));
            const charge1 = Math.max(MIN_CHARGE.TTS_ELEVENLABS, cost);
            // b.170 — netta la riserva fatta da resolveAuth (vedi apiAuth.js).
            // b.594 — MODULO 3: fuoco-e-dimentica come /api/tts, non piu
            // await che allunga la risposta se Redis e' lento.
            trackDailySpend(billingEmail, charge1, riservatoUtenteCents, riservatoPiattaformaCents).catch((e) => log.warn('Fallback daily-spend tracking failed:', e?.message));
          }
          // b.164 — stesso audio dello stesso testo, solo un modello di
          // riserva: si conferma la STESSA riserva presa sopra, non se
          // ne apre una seconda.
          let creditoEsauritoFb = false;
          if (riservaId) {
            await commit(riservaId, costoPrevisto, { tipo: 'voce_premium', caratteri: cleanText.length });
            riservaId = null;
            creditoEsauritoFb = await creditoFinito(pagante);
          }
          return new NextResponse(buf, { headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': buf.length.toString(), 'X-Voce': selectedVoice, ...(creditoEsauritoFb && { 'X-Credito-Esaurito': '1' }) } });
        }
      }

      // b.164 — ENTRAMBI i modelli hanno fallito (o non c'era fallback):
      // nessun audio consegnato, la riserva torna intera nel wallet —
      // mai un addebito per un fornitore che non ha risposto.
      if (riservaId) { await release(riservaId, 'elevenlabs_fallito'); riservaId = null; }
      return NextResponse.json(
        { error: `ElevenLabs error: ${response.status}`, details: errText },
        { status: response.status }
      );
    }

    // Calculate and deduct cost
    const elCostUsd = calcElevenLabsCost(cleanText.length);
    const elCostEurCents = usdToEurCents(elCostUsd);

    if (!isOwnKey) {
      // b.154 — stessa correzione: il tetto di piattaforma (dentro
      // trackDailySpend) deve vedere anche le chiamate senza
      // billingEmail (accesso libero), l'addebito personale no.
      // b.157 — tolto il doppio addebito sul vecchio user.credits, vedi
      // nota gemella sopra: il commit della riserva (poco sotto) e il conto vero.
      const charge = Math.max(MIN_CHARGE.TTS_ELEVENLABS, elCostEurCents);
      // b.170 — netta la riserva fatta da resolveAuth (vedi apiAuth.js).
      // b.594 — MODULO 3: fuoco-e-dimentica come /api/tts, non piu await.
      trackDailySpend(billingEmail, charge, riservatoUtenteCents, riservatoPiattaformaCents).catch((e) => log.error('ElevenLabs daily-spend tracking error:', e));
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // ── Wallet: CONFERMA la riserva DOPO aver letto l'audio per intero ──
    // b.164-bis — CONFERMATO dall'utente: committare PRIMA di
    // arrayBuffer() addebitava anche se lo stream HTTP si interrompeva
    // DOPO il 200 OK — cliente addebitato, nessun audio consegnato. Ora,
    // se la lettura fallisce, l'eccezione risale al catch esterno che
    // rilascia la riserva (stesso ordine gia corretto nel ramo di
    // fallback qui sopra, che legge il buffer prima del commit).
    let creditoEsaurito = false;
    if (riservaId) {
      await commit(riservaId, costoPrevisto, { tipo: 'voce_premium', caratteri: cleanText.length });
      riservaId = null;
      creditoEsaurito = await creditoFinito(pagante);
    }

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length.toString(),
        // b.342 — la voce EFFETTIVA usata: il client puo bloccarla e riusarla
        // per i turni successivi (il Maestro che risponde con la stessa voce
        // con cui leggeva, anche quando la scelta era della predefinita).
        'X-Voce': selectedVoice,
        // Era l'ultimo: il client passa alla voce standard e avvisa
        ...(creditoEsaurito && { 'X-Credito-Esaurito': '1' })
      }
    });
  } catch (e) {
    // b.164 — rete di sicurezza: qualunque errore imprevisto dopo la
    // riserva ma prima del commit deve restituire il credito, altrimenti
    // resta bloccato fino alla pulizia periodica (10 minuti).
    if (riservaId) await release(riservaId, 'errore_imprevisto').catch(() => {});
    if (e instanceof NextResponse) return e;
    log.error('ElevenLabs TTS error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// GET /api/tts-elevenlabs?action=voices - List available voices (requires auth)
async function handleGet(req) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    // SECURITY: tokens ONLY via Authorization header — never from query string (logged by proxies/CDNs)
    const authHeader = req.headers.get('authorization');
    const userToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (action !== 'voices') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Resolve API key — allow test center access without token (uses platform key)
    const source = searchParams.get('source');
    let apiKey = process.env.ELEVENLABS_API_KEY || null;

    if (userToken) {
      // Authenticated user — check for own key
      const session = await getSession(userToken);
      if (session) {
        const user = await getUser(session.email);
        if (user?.useOwnKeys && user.apiKeys?.elevenlabs) {
          apiKey = user.apiKeys.elevenlabs;
        }
      }
    }
    // FREE ACCESS MODE — allow all users to browse voices

    if (!apiKey) {
      return NextResponse.json({ error: 'No ElevenLabs API key' }, { status: 400 });
    }

    const res = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': apiKey }
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch voices' }, { status: res.status });
    }

    const data = await res.json();
    const voices = (data.voices || []).map(v => ({
      id: v.voice_id,
      name: v.name,
      category: v.category,
      labels: v.labels || {},
      preview: v.preview_url || null,
      language: v.labels?.language || null,
      accent: v.labels?.accent || null,
      gender: v.labels?.gender || null,
      age: v.labels?.age || null,
      useCase: v.labels?.use_case || v.labels?.['use case'] || null,
    }));

    // Also return our avatar mapping for the frontend
    return NextResponse.json({ voices, avatarVoiceMap: AVATAR_VOICE_MAP });
  } catch (e) {
    log.error('ElevenLabs voices error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 30, prefix: 'tts-elevenlabs' });
export const GET = withApiGuard(handleGet, { maxRequests: 30, prefix: 'tts-elevenlabs', skipBodyCheck: true });
