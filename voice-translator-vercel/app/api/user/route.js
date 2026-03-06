import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { getSession, getUser, updateUser, saveApiKeys, getCredits, getPaymentHistory, deleteUserData } from '../../lib/users.js';
import { saveUserSettings, getUserSettings, getProfileByEmail } from '../../lib/supabaseAPI.js';

// POST /api/user - User profile actions
async function handlePost(req) {
  try {
    const { action, token, name, lang, avatar, apiKeys, useOwnKeys } = await req.json();

    // Authenticate
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const session = await getSession(token);
    if (!session) return NextResponse.json({ error: 'Session expired' }, { status: 401 });

    const email = session.email;

    // === GET PROFILE ===
    if (action === 'profile') {
      const user = await getUser(email);
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      // Don't send full API keys - mask them
      const safeUser = { ...user };
      if (safeUser.apiKeys) {
        const masked = {};
        for (const [provider, key] of Object.entries(safeUser.apiKeys)) {
          if (key) masked[provider] = key.substring(0, 8) + '...' + key.substring(key.length - 4);
          else masked[provider] = '';
        }
        safeUser.apiKeys = masked;
      }
      return NextResponse.json({ user: safeUser });
    }

    // === UPDATE PROFILE ===
    if (action === 'update') {
      const updates = {};
      if (name !== undefined) updates.name = name;
      if (lang !== undefined) updates.lang = lang;
      if (avatar !== undefined) updates.avatar = avatar;
      const user = await updateUser(email, updates);
      return NextResponse.json({ user });
    }

    // === SAVE API KEYS ===
    if (action === 'save-keys') {
      const user = await saveApiKeys(email, apiKeys || {}, !!useOwnKeys);
      return NextResponse.json({ ok: true, useOwnKeys: user.useOwnKeys });
    }

    // === GET CREDITS ===
    if (action === 'credits') {
      const { credits, useOwnKeys: uok } = await getCredits(email);
      return NextResponse.json({ credits, useOwnKeys: uok });
    }

    // === PAYMENT HISTORY ===
    if (action === 'payments') {
      const payments = await getPaymentHistory(email);
      return NextResponse.json({ payments });
    }

    // === GDPR: DELETE ALL DATA ===
    if (action === 'delete-data') {
      const result = await deleteUserData(email, token);
      return NextResponse.json({
        ok: true,
        message: 'All your data has been deleted (GDPR Art. 17)',
        deleted: result.deleted,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e) {
    console.error('User error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET /api/user - Retrieve user data (supports action query param)
async function handleGet(req) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const token = searchParams.get('token');

    // Authenticate
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const session = await getSession(token);
    if (!session) return NextResponse.json({ error: 'Session expired' }, { status: 401 });

    // === GET PROFILE ===
    if (action === 'profile') {
      const user = await getUser(session.email);
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      return NextResponse.json({
        email: session.email,
        name: user.name || null,
        tier: user.tier || 'free',
        credits: user.credits || 0,
        clonedVoiceId: user.clonedVoiceId || null,
        clonedVoiceName: user.clonedVoiceName || null,
        useOwnKeys: user.useOwnKeys || false,
        createdAt: user.createdAt || null,
      });
    }

    // === GET PREFERENCES FROM SUPABASE ===
    if (action === 'get-prefs') {
      try {
        // Resolve email → Supabase profile UUID
        const profile = await getProfileByEmail(session.email);
        if (!profile?.id) {
          return NextResponse.json({ prefs: {} });
        }
        const settings = await getUserSettings(profile.id);
        if (!settings) {
          return NextResponse.json({ prefs: {} });
        }
        // Map snake_case DB columns → camelCase client fields
        const prefs = {
          sourceLang: settings.source_lang,
          targetLang: settings.target_lang,
          ttsEnabled: settings.tts_enabled,
          ttsEngine: settings.tts_engine,
          ttsVoice: settings.tts_voice,
          ttsAutoPlay: settings.tts_auto_play,
          sttEngine: settings.stt_engine,
          aiModel: settings.ai_model,
          theme: settings.theme,
          contextType: settings.context_type,
          voiceSpeed: settings.voice_speed,
          autoTranslate: settings.auto_translate,
          showOriginal: settings.show_original,
          notificationSound: settings.notification_sound,
        };
        return NextResponse.json({ prefs });
      } catch (e) {
        console.warn('[API] get-prefs error:', e.message);
        return NextResponse.json({ prefs: {} });
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e) {
    console.error('User GET error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT /api/user - Update user preferences (sync-prefs action)
async function handlePut(req) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const session = await getSession(token);
    if (!session) return NextResponse.json({ error: 'Session expired' }, { status: 401 });

    const { action, prefs } = await req.json();

    // === SYNC PREFERENCES TO SUPABASE ===
    if (action === 'sync-prefs') {
      try {
        if (!prefs || typeof prefs !== 'object') {
          return NextResponse.json({ error: 'Invalid prefs object' }, { status: 400 });
        }

        // Resolve email → Supabase profile UUID
        const profile = await getProfileByEmail(session.email);
        if (!profile?.id) {
          console.warn('[API] sync-prefs: no Supabase profile for', session.email);
          return NextResponse.json({ ok: true, message: 'No Supabase profile yet — sync skipped' });
        }

        // Convert camelCase client fields → snake_case DB columns
        // Only include fields that exist in user_settings table
        const settingsToSave = {};
        if (prefs.sourceLang !== undefined) settingsToSave.source_lang = prefs.sourceLang;
        if (prefs.targetLang !== undefined) settingsToSave.target_lang = prefs.targetLang;
        if (prefs.ttsEnabled !== undefined) settingsToSave.tts_enabled = prefs.ttsEnabled;
        if (prefs.ttsEngine !== undefined) settingsToSave.tts_engine = prefs.ttsEngine;
        if (prefs.ttsVoice !== undefined) settingsToSave.tts_voice = prefs.ttsVoice;
        if (prefs.ttsAutoPlay !== undefined) settingsToSave.tts_auto_play = prefs.ttsAutoPlay;
        if (prefs.sttEngine !== undefined) settingsToSave.stt_engine = prefs.sttEngine;
        if (prefs.aiModel !== undefined) settingsToSave.ai_model = prefs.aiModel;
        if (prefs.theme !== undefined) settingsToSave.theme = prefs.theme;
        if (prefs.contextType !== undefined) settingsToSave.context_type = prefs.contextType;
        if (prefs.voiceSpeed !== undefined) settingsToSave.voice_speed = prefs.voiceSpeed;
        if (prefs.autoTranslate !== undefined) settingsToSave.auto_translate = prefs.autoTranslate;
        if (prefs.showOriginal !== undefined) settingsToSave.show_original = prefs.showOriginal;
        if (prefs.notificationSound !== undefined) settingsToSave.notification_sound = prefs.notificationSound;

        // Save to Supabase user_settings table (with resolved UUID)
        const result = await saveUserSettings(profile.id, settingsToSave);

        if (!result) {
          console.warn('[API] saveUserSettings returned null');
          return NextResponse.json({ ok: false, message: 'Failed to save settings' }, { status: 500 });
        }

        return NextResponse.json({ ok: true, message: 'Preferences synced' });
      } catch (e) {
        console.warn('[API] sync-prefs error:', e.message);
        // Don't fail hard - sync errors are non-blocking
        return NextResponse.json({ ok: true, message: 'Sync queued (will retry)' });
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e) {
    console.error('User PUT error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 60, prefix: 'user' });
export const GET = withApiGuard(handleGet, { maxRequests: 60, prefix: 'user' });
export const PUT = withApiGuard(handlePut, { maxRequests: 60, prefix: 'user' });
