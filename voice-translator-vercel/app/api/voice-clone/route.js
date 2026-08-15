import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { getSession, getUser, updateUser } from '../../lib/users.js';
import { createLogger } from '../../lib/logger.js';
import { assertCloudProcessingAllowed, DirectModeError } from '../../lib/sessionGuard.js';
import { creditoInsufficientePerClonazione, addebitaClonazione } from '../../wallet/addebita.js';
import { COSTO_CLONAZIONE_SECONDI } from '../../wallet/tariffe.js';

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

  try {
    const formData = await req.formData();
    const userToken = formData.get('userToken');
    const voiceName = formData.get('voiceName') || 'My Voice';
    const audioFile = formData.get('audio');
    const action = formData.get('action');

    // Delete action (sent as FormData for consistency)
    if (action === 'delete') {
      return handleDelete(userToken);
    }

    if (!userToken || !audioFile) {
      return NextResponse.json({ error: 'userToken and audio required' }, { status: 400 });
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
    const testingMode = process.env.TESTING_MODE === 'true';

    // Resolve ElevenLabs API key
    let apiKey = process.env.ELEVENLABS_API_KEY;
    if (user.useOwnKeys && user.apiKeys?.elevenlabs) {
      apiKey = user.apiKeys.elevenlabs;
    }
    if (!apiKey) {
      return NextResponse.json({ error: 'ElevenLabs API key not available' }, { status: 400 });
    }

    // ── Wallet: unico gate reale (skip con chiave propria o in test) ──
    const isOwnKey = user.useOwnKeys && user.apiKeys?.elevenlabs;
    if (!isOwnKey && !testingMode && await creditoInsufficientePerClonazione(session.email)) {
      return NextResponse.json({
        error: `Credito insufficiente. Servono €${CLONE_COST_EURO.toFixed(2)} di credito wallet.`,
        needEuro: CLONE_COST_EURO,
      }, { status: 402 });
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
      return NextResponse.json({
        error: `Voice cloning failed: ${elRes.status}`,
        details: errBody
      }, { status: 500 });
    }

    const elData = await elRes.json();
    const voiceId = elData.voice_id;

    if (!voiceId) {
      return NextResponse.json({ error: 'No voice_id returned from ElevenLabs' }, { status: 500 });
    }

    // Save to user record
    await updateUser(session.email, {
      clonedVoiceId: voiceId,
      clonedVoiceName: voiceName,
      clonedVoiceAt: Date.now()
    });

    // ── Wallet: addebito vero, dopo la clonazione riuscita ──
    if (!isOwnKey) {
      await addebitaClonazione(session.email);
    }

    return NextResponse.json({
      ok: true,
      voiceId,
      name: voiceName,
      cost: isOwnKey ? 0 : CLONE_COST_EURO
    });

  } catch (e) {
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
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
