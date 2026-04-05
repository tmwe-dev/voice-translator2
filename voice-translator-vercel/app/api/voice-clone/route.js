import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { getSession, getUser, updateUser, deductCredits } from '../../lib/users.js';

const CLONE_COST_CREDITS = 500; // 500 cents = €5.00

// ═══════════════════════════════════════
// POST /api/voice-clone — Clone a voice
// ═══════════════════════════════════════
async function handlePost(req) {
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

    // Check tier — must be PRO or TOP PRO (not trial/free)
    // TESTING_MODE: skip tier check
    const testingMode = process.env.TESTING_MODE === 'true';
    const isTrial = !user.credits && !user.useOwnKeys;
    if (isTrial && !testingMode) {
      return NextResponse.json({ error: 'Voice cloning requires PRO plan' }, { status: 403 });
    }

    // Resolve ElevenLabs API key
    let apiKey = process.env.ELEVENLABS_API_KEY;
    if (user.useOwnKeys && user.apiKeys?.elevenlabs) {
      apiKey = user.apiKeys.elevenlabs;
    }
    if (!apiKey) {
      return NextResponse.json({ error: 'ElevenLabs API key not available' }, { status: 400 });
    }

    // Check credits (skip if using own key or TESTING_MODE)
    const isOwnKey = user.useOwnKeys && user.apiKeys?.elevenlabs;
    if (!isOwnKey && !testingMode && (user.credits || 0) < CLONE_COST_CREDITS) {
      return NextResponse.json({
        error: `Insufficient credits. Need ${CLONE_COST_CREDITS} credits (€${(CLONE_COST_CREDITS / 100).toFixed(2)})`,
        needCredits: CLONE_COST_CREDITS
      }, { status: 402 });
    }

    // If user already has a cloned voice, delete it first
    if (user.clonedVoiceId) {
      try {
        await fetch(`https://api.elevenlabs.io/v1/voices/${user.clonedVoiceId}`, {
          method: 'DELETE',
          headers: { 'xi-api-key': apiKey }
        });
      } catch (e) { console.warn('[voice-clone] ElevenLabs cleanup failed:', e?.message); }
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
      console.error('[VoiceClone] ElevenLabs error:', elRes.status, errBody);
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

    // Deduct credits (unless own key)
    if (!isOwnKey) {
      await deductCredits(session.email, CLONE_COST_CREDITS);
    }

    return NextResponse.json({
      ok: true,
      voiceId,
      name: voiceName,
      cost: isOwnKey ? 0 : CLONE_COST_CREDITS
    });

  } catch (e) {
    console.error('[VoiceClone] Error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ═══════════════════════════════════════
// GET /api/voice-clone — Get cloned voice info
// ═══════════════════════════════════════
async function handleGet(req) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });

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
    return NextResponse.json({ error: e.message }, { status: 500 });
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
        console.error('[VoiceClone] Delete from EL error:', e);
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
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
