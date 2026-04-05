import { NextResponse } from 'next/server';
import { createUser, getUser, createSession, saveApiKeys } from '../../lib/users.js';

const TEST_EMAIL = 'test@bartalk.dev';

// POST /api/test-login — Creates or restores a test account with full access
// Only works when TESTING_MODE is enabled (NEXT_PUBLIC_TESTING_MODE !== 'false')
export async function POST(req) {
  // Production guard: test endpoints disabled unless TESTING_MODE active
  // Only block when TESTING_MODE is explicitly set to 'false'
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_TESTING_MODE === 'false') {
    return NextResponse.json({ error: 'Test endpoint disabled in production' }, { status: 403 });
  }

  try {
    // Create or get test user
    let user = await getUser(TEST_EMAIL);
    if (!user) {
      user = await createUser(TEST_EMAIL, 'Test User', 'it', '/avatars/1.png');
    }

    // Set up test API keys (use platform keys from env)
    const testKeys = {};
    if (process.env.OPENAI_API_KEY) testKeys.openai = process.env.OPENAI_API_KEY;
    if (process.env.ANTHROPIC_API_KEY) testKeys.anthropic = process.env.ANTHROPIC_API_KEY;
    if (process.env.ELEVENLABS_API_KEY) testKeys.elevenlabs = process.env.ELEVENLABS_API_KEY;
    if (process.env.GOOGLE_GEMINI_KEY) testKeys.gemini = process.env.GOOGLE_GEMINI_KEY;

    if (Object.keys(testKeys).length > 0) {
      user = await saveApiKeys(TEST_EMAIL, testKeys, true);
    }

    // Create a valid session
    const token = await createSession(TEST_EMAIL);

    // Re-fetch user with decrypted keys for response
    user = await getUser(TEST_EMAIL);

    return NextResponse.json({
      ok: true,
      token,
      user: {
        ...user,
        credits: 99999,
        tier: 'pro',
        useOwnKeys: true,
      },
      platformHasElevenLabs: !!process.env.ELEVENLABS_API_KEY,
    });
  } catch (e) {
    console.error('[test-login] Error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
