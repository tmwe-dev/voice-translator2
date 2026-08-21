import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { getSession, getUser, updateUser } from '../../lib/users.js';
import { createLogger } from '../../lib/logger.js';
import { assertCloudProcessingAllowed, DirectModeError } from '../../lib/sessionGuard.js';
import { riserva, commit, release } from '../../wallet/riserva.js';
import { COSTO_CLONAZIONE_SECONDI } from '../../wallet/tariffe.js';
import { TESTING_MODE } from '../../lib/config.js';

const log = createLogger('voiceClone');

// b.157 — audit pagamenti: CONFERMATO DOPPIO DIFETTO. Questa rotta
// non usava resolveAuth: gate e addebito guardavano SOLO il vecchio
// user.credits (Redis). Per chi paga col wallet (la ricarica vera,
// da tempo l'unico sistema che CreditsView mostra) user.credits e
// SEMPRE zero — quindi la clonazione rispondeva "credito
// insufficiente" a chiunque avesse pagato regolarmente, saldo pieno
// compreso. Ora gate e addebito guardano il wallet vero, stesso
// prezzo (€5,00) di sempre.
const CLONE_COST_EURO = 5;

// ═══════════════════════════════════════
// POST /api/voice-clone — Clone a voice
// ═══════════════════════════════════════
async function handlePost(req) {
  // b.111 — la guardia mancava proprio qui. Vedi lib/modalitaSessione.js:
  // l'intestazione che la fa scattare non la mandava nessuno, quindi
  // anche dove c'era non e mai servita. Ora arriva davvero.
  try { assertCloudProcessingAllowed(req); } catch (e) {
    if (e instanceof DirectModeError) {
      return NextResponse.json({ error: e.message, direct: true }, { status: 403 });
    }
    throw e;
  }

  // b.164 (roadmap utente dopo b.163, punto 2 "Voice Clone idem") —
  // fuori dal try: la rete di sicurezza nel catch esterno deve poter
  // rilasciare la riserva per QUALUNQUE errore imprevisto.
  let riservaId = null;
  try {
    // b.363 — UNA RICHIESTA MALFORMATA NON E' UN GUASTO NOSTRO. Se il
    // corpo non e un modulo (richiesta vuota, sonda, chiamata sbagliata),
    // leggere il modulo esplode e finiva nel catch generale, che rispondeva
    // "errore interno" con un 500: cioe l'app dichiarava rotta se stessa
    // per colpa di chi aveva chiamato male. Trovato collaudando il
    // campionamento voce con Luca (21/08). Ora si rifiuta pulito.
    let formData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: 'Serve un modulo con la registrazione' }, { status: 400 });
    }

    // ── b.363 · IL MODULO ARRIVAVA E SI USAVA COM'ERA ──
    //
    // `formData.get()` restituisce una stringa OPPURE un file: nessuno
    // guardava quale delle due. `userToken` finiva nella ricerca della
    // sessione anche se era un file; `voiceName` veniva spedito a
    // ElevenLabs e poi salvato sul profilo con qualunque lunghezza; e
    // `audio` era accettato senza controllarne ne il tipo ne il peso —
    // cioe si poteva caricare qualsiasi cosa e mandarla a un servizio a
    // pagamento a nostro nome. Il limite generale della guardia comune
    // (256KB) non copre i moduli, che possono essere molto piu grandi.
    const MAX_AUDIO = 10 * 1024 * 1024; // dieci megabyte: un campione voce e' molto meno
    const testo = (v, max) => (typeof v === 'string' && v.length <= max ? v : null);

    const userToken = testo(formData.get('userToken'), 200);
    const voiceName = testo(formData.get('voiceName'), 60) || 'My Voice';
    const audioFile = formData.get('audio');
    const action = testo(formData.get('action'), 20);

    // Delete action (sent as FormData for consistency)
    if (action === 'delete') {
      return handleDelete(userToken);
    }

    if (!userToken || !audioFile) {
      return NextResponse.json({ error: 'userToken and audio required' }, { status: 400 });
    }
    if (typeof audioFile === 'string' || typeof audioFile.arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'audio deve essere un file' }, { status: 400 });
    }
    if (typeof audioFile.size === 'number' && audioFile.size > MAX_AUDIO) {
      log.warn('campione voce rifiutato: troppo grande', { byte: audioFile.size });
      return NextResponse.json({ error: 'Campione audio troppo grande (max 10MB)' }, { status: 413 });
    }

    // Auth check
    const session = await getSession(userToken);
    if (!session?.email) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    const user = await getUser(session.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // TESTING_MODE: skip il controllo del credito
    // b.159 — CONFERMATO (audit b.158, punto 13): leggeva la variabile
    // d'ambiente grezza invece della costante blindata di config.js, che
    // in produzione (VERCEL_ENV==='production') resta SEMPRE false anche
    // se TESTING_MODE=true finisse per sbaglio nelle env di prod. Con la
    // lettura diretta, quella rete di sicurezza non copriva questa rotta.
    const testingMode = TESTING_MODE;

    // Resolve ElevenLabs API key
    let apiKey = process.env.ELEVENLABS_API_KEY;
    if (user.useOwnKeys && user.apiKeys?.elevenlabs) {
      apiKey = user.apiKeys.elevenlabs;
    }
    if (!apiKey) {
      return NextResponse.json({ error: 'ElevenLabs API key not available' }, { status: 400 });
    }

    // ── Wallet: riserva ATOMICA prima di chiamare ElevenLabs ──
    // b.164 — CONFERMATO (roadmap utente dopo b.163, punto 2): il vecchio
    // gate (creditoInsufficientePerClonazione, poi addebitaClonazione a
    // fine chiamata) chiudeva solo il bypass ripetibile, non la finestra
    // di CORSA fra due clonazioni concorrenti dello stesso utente — stessa
    // classe di difetto gia chiusa su transcribe/translate/tts/
    // tts-elevenlabs. Costo fisso (€5,00 = COSTO_CLONAZIONE_SECONDI):
    // riserva e commit usano sempre lo stesso numero.
    const isOwnKey = user.useOwnKeys && user.apiKeys?.elevenlabs;
    if (!isOwnKey && !testingMode) {
      const r = await riserva(session.email, COSTO_CLONAZIONE_SECONDI, {
        tipo: 'clonazione_voce',
        costo_cent: 500,
      });
      if (!r.ok) {
        return NextResponse.json({
          error: `Credito insufficiente. Servono €${CLONE_COST_EURO.toFixed(2)} di credito wallet.`,
          needEuro: CLONE_COST_EURO,
        }, { status: 402 });
      }
      riservaId = r.riservaId;
    }

    // If user already has a cloned voice, delete it first
    if (user.clonedVoiceId) {
      try {
        await fetch(`https://api.elevenlabs.io/v1/voices/${user.clonedVoiceId}`, {
          method: 'DELETE',
          headers: { 'xi-api-key': apiKey }
        });
      } catch (e) { log.warn('ElevenLabs cleanup failed:', e?.message); }
    }

    // Call ElevenLabs voice clone API
    const elFormData = new FormData();
    elFormData.append('name', `VT-${voiceName}`);
    elFormData.append('description', `BarTalk cloned voice for ${session.email}`);

    // Convert webm blob to a File object for ElevenLabs
    const audioBuffer = await audioFile.arrayBuffer();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });
    elFormData.append('files', audioBlob, 'voice-sample.webm');

    const elRes = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
      },
      body: elFormData
    });

    if (!elRes.ok) {
      const errBody = await elRes.text();
      log.error('ElevenLabs error:', elRes.status, errBody);
      // b.164 — nessuna voce clonata, la riserva torna intera nel wallet.
      if (riservaId) { await release(riservaId, 'elevenlabs_fallito'); riservaId = null; }
      return NextResponse.json({
        error: `Voice cloning failed: ${elRes.status}`,
        details: errBody
      }, { status: 500 });
    }

    const elData = await elRes.json();
    const voiceId = elData.voice_id;

    if (!voiceId) {
      // b.164 — stesso discorso: nessun voice_id, nessun addebito.
      if (riservaId) { await release(riservaId, 'elevenlabs_no_voice_id'); riservaId = null; }
      // b.363 — uscita di guasto muta: dal registro sembrava che non
      // fosse successo niente. Una clonazione a pagamento andata a vuoto spariva dal registro.
      log.error('Clonazione voce: ElevenLabs non ha restituito voice_id');
      return NextResponse.json({ error: 'No voice_id returned from ElevenLabs' }, { status: 500 });
    }

    // ── Wallet: CONFERMA la riserva SUBITO dopo il voice_id valido ──
    // b.164-bis — CONFERMATO dall'utente: l'ordine precedente (salva
    // utente POI commit) faceva RILASCIARE un costo provider gia
    // realmente sostenuto se updateUser falliva (il catch esterno
    // vedeva ancora riservaId valorizzato) — BarTalk pagava ElevenLabs
    // per una voce clonata mai fatturata al cliente. Da qui in poi il
    // costo e reale e va confermato, che la scrittura locale funzioni
    // o no.
    if (riservaId) {
      await commit(riservaId, COSTO_CLONAZIONE_SECONDI, { tipo: 'clonazione_voce' });
      riservaId = null;
    }

    // Save to user record — un fallimento qui NON deve piu risalire al
    // catch esterno: l'addebito sopra e gia confermato sul costo REALE,
    // rilasciarlo lascerebbe BarTalk a pagare ElevenLabs per un
    // servizio consegnato e mai fatturato. Si logga per bonifica
    // manuale (voiceId noto e recuperabile lato ElevenLabs); il
    // cliente riceve comunque voiceId, perche la voce esiste davvero.
    try {
      await updateUser(session.email, {
        clonedVoiceId: voiceId,
        clonedVoiceName: voiceName,
        clonedVoiceAt: Date.now()
      });
    } catch (e) {
      log.error('BONIFICA MANUALE — voce clonata e addebitata ma salvataggio utente fallito:', session.email, voiceId, e?.message);
    }

    return NextResponse.json({
      ok: true,
      voiceId,
      name: voiceName,
      cost: isOwnKey ? 0 : CLONE_COST_EURO
    });

  } catch (e) {
    // b.164 — rete di sicurezza: qualunque errore imprevisto dopo la
    // riserva ma prima del commit deve restituire il credito.
    if (riservaId) await release(riservaId, 'errore_imprevisto').catch(() => {});
    log.error('Error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ═══════════════════════════════════════
// GET /api/voice-clone — Get cloned voice info
// ═══════════════════════════════════════
async function handleGet(req) {
  try {
    // SECURITY: tokens ONLY via Authorization header — never from query string
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });

    const session = await getSession(token);
    if (!session?.email) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const user = await getUser(session.email);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if (!user.clonedVoiceId) {
      return NextResponse.json({ hasClonedVoice: false });
    }

    return NextResponse.json({
      hasClonedVoice: true,
      voiceId: user.clonedVoiceId,
      name: user.clonedVoiceName || 'My Voice',
      createdAt: user.clonedVoiceAt || null
    });

  } catch (e) {
    // b.363 — uscita di guasto muta: dal registro sembrava che non fosse
    // successo niente. Il client riceveva 'Internal error' e anche noi,
    // dopo, avevamo esattamente la stessa informazione: nessuna.
    log.error('Stato voce clonata: errore imprevisto', { err: e?.message });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 10, prefix: 'voice-clone' });
export const GET = withApiGuard(handleGet, { maxRequests: 10, prefix: 'voice-clone', skipBodyCheck: true });

// ═══════════════════════════════════════
// DELETE handler (called from POST with action=delete)
// ═══════════════════════════════════════
async function handleDelete(userToken) {
  try {
    if (!userToken) return NextResponse.json({ error: 'userToken required' }, { status: 400 });

    const session = await getSession(userToken);
    if (!session?.email) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const user = await getUser(session.email);
    if (!user?.clonedVoiceId) {
      return NextResponse.json({ error: 'No cloned voice to delete' }, { status: 404 });
    }

    // Resolve API key
    let apiKey = process.env.ELEVENLABS_API_KEY;
    if (user.useOwnKeys && user.apiKeys?.elevenlabs) {
      apiKey = user.apiKeys.elevenlabs;
    }

    // Delete from ElevenLabs
    if (apiKey) {
      try {
        await fetch(`https://api.elevenlabs.io/v1/voices/${user.clonedVoiceId}`, {
          method: 'DELETE',
          headers: { 'xi-api-key': apiKey }
        });
      } catch (e) {
        log.error('Delete from EL error:', e);
      }
    }

    // Remove from user record
    await updateUser(session.email, {
      clonedVoiceId: null,
      clonedVoiceName: null,
      clonedVoiceAt: null
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    // b.363 — stessa uscita muta: una cancellazione di voce fallita non
    // lasciava niente nel registro.
    log.error('Cancellazione voce clonata: errore imprevisto', { err: e?.message });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
