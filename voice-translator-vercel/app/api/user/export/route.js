import { NextResponse } from 'next/server';
import { getSession, getUser } from '../../../lib/users.js';
import { getSupabaseAdmin } from '../../../lib/supabase.js';

/**
 * GET /api/user/export
 * GDPR Article 20 - Right to Data Portability
 *
 * Returns all user data in a machine-readable JSON format.
 * Requires authentication via Bearer token.
 */
export async function GET(req) {
  try {
    // Extract and validate Bearer token
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized - Bearer token required' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }

    // Validate session
    const session = await getSession(token);
    if (!session?.email) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid or expired session' },
        { status: 401 }
      );
    }

    const userEmail = session.email;

    // Get user profile from Redis
    const userProfile = await getUser(userEmail);
    if (!userProfile) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Initialize export data
    const exportData = {
      export_date: new Date().toISOString(),
      export_format: 'GDPR Article 20 - Right to Data Portability',
      data_subject_email: userEmail,

      user: {
        email: userProfile.email,
        name: userProfile.name || null,
        avatar: userProfile.avatar || null,
        language_preference: userProfile.lang || 'en',
        subscription_tier: userProfile.tier || 'free',
        credits_balance: userProfile.credits || 0,
        use_own_api_keys: userProfile.useOwnKeys || false,
        created_at: userProfile.created ? new Date(userProfile.created).toISOString() : null,
        last_login: userProfile.lastLogin ? new Date(userProfile.lastLogin).toISOString() : null,
        last_updated: userProfile.updated ? new Date(userProfile.updated).toISOString() : null,
        // Note: API keys are intentionally excluded for security reasons
      },

      // Try to get additional data from Supabase if available
      supabase_data: null,

      summary: {
        total_credits: userProfile.credits || 0,
        total_spent: userProfile.totalSpent || 0,
        total_messages: userProfile.totalMessages || 0,
        referral_stats: {
          note: 'Referral data available in account settings',
        },
      },
    };

    // Attempt to fetch additional data from Supabase (optional)
    try {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        // Resolve user_id from profiles table
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, tier, subscription_plan, subscription_status, subscription_period_end, credits, total_spent, total_messages, created_at')
          .eq('email', userEmail)
          .single();

        const supabaseUserId = profile?.id;

        // Fetch daily usage stats (using correct table: usage_daily)
        let usageData = [];
        if (supabaseUserId) {
          const { data: usage, error: usageError } = await supabase
            .from('usage_daily')
            .select('date, translations, tts_chars, stt_seconds, cost_eur_cents, tokens_used, providers_used, languages_used')
            .eq('user_id', supabaseUserId)
            .order('date', { ascending: false })
            .limit(365);
          if (!usageError && usage) usageData = usage;
        }

        // Fetch translation history (using correct column: user_id not email)
        let translationData = [];
        if (supabaseUserId) {
          const { data: translations, error: translationError } = await supabase
            .from('translations')
            .select('id, source_lang, target_lang, provider, ai_model, duration_ms, cost_eur_cents, created_at')
            .eq('user_id', supabaseUserId)
            .order('created_at', { ascending: false })
            .limit(500);
          if (!translationError && translations) translationData = translations;
        }

        // Fetch payment history
        let paymentData = [];
        if (supabaseUserId) {
          const { data: payments, error: payError } = await supabase
            .from('payments')
            .select('id, type, plan, amount_eur_cents, credits_added, status, created_at')
            .eq('user_id', supabaseUserId)
            .order('created_at', { ascending: false })
            .limit(100);
          if (!payError && payments) paymentData = payments;
        }

        exportData.supabase_data = {
          profile: profile && !profileError ? {
            tier: profile.tier,
            subscription_plan: profile.subscription_plan,
            subscription_status: profile.subscription_status,
            subscription_period_end: profile.subscription_period_end,
            credits: profile.credits,
            total_spent: profile.total_spent,
            total_messages: profile.total_messages,
            created_at: profile.created_at,
          } : null,

          usage_daily: usageData.map(u => ({
            date: u.date,
            translations: u.translations,
            tts_chars: u.tts_chars,
            stt_seconds: u.stt_seconds,
            cost_eur_cents: u.cost_eur_cents,
            tokens_used: u.tokens_used,
          })),

          translation_history: translationData.map(t => ({
            id: t.id,
            created_at: t.created_at,
            source_lang: t.source_lang,
            target_lang: t.target_lang,
            provider: t.provider,
            ai_model: t.ai_model,
            // Note: actual translation text excluded for privacy
          })),

          payments: paymentData.map(p => ({
            id: p.id,
            type: p.type,
            plan: p.plan,
            amount_eur_cents: p.amount_eur_cents,
            credits_added: p.credits_added,
            status: p.status,
            created_at: p.created_at,
          })),
        };

        // Update summary with actual counts
        exportData.summary.usage_days_count = usageData.length;
        exportData.summary.translation_history_count = translationData.length;
        exportData.summary.payments_count = paymentData.length;
      }
    } catch (supabaseError) {
      // Supabase might not be configured or accessible
      // This is okay - we still return the user data from Redis
      console.warn('Supabase fetch failed during export:', supabaseError.message);
      exportData.supabase_data = {
        error: 'Supabase data unavailable',
      };
    }

    // Generate filename with email and date
    const filename = `voicetranslate-data-export-${userEmail.replace(/@/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;

    // Return as downloadable JSON file
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      },
    });
  } catch (error) {
    console.error('Data export error:', error);
    return NextResponse.json(
      { error: 'Internal server error during data export', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/export
 * Alternative endpoint for browsers that can't send GET with Authorization header
 */
export async function POST(req) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json(
        { error: 'Token required in request body' },
        { status: 400 }
      );
    }

    // Reuse GET logic by creating a fake Request with Authorization header
    const session = await getSession(token);
    if (!session?.email) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid or expired session' },
        { status: 401 }
      );
    }

    const userEmail = session.email;
    const userProfile = await getUser(userEmail);
    if (!userProfile) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Initialize export data (same as GET)
    const exportData = {
      export_date: new Date().toISOString(),
      export_format: 'GDPR Article 20 - Right to Data Portability',
      data_subject_email: userEmail,

      user: {
        email: userProfile.email,
        name: userProfile.name || null,
        avatar: userProfile.avatar || null,
        language_preference: userProfile.lang || 'en',
        subscription_tier: userProfile.tier || 'free',
        credits_balance: userProfile.credits || 0,
        use_own_api_keys: userProfile.useOwnKeys || false,
        created_at: userProfile.created ? new Date(userProfile.created).toISOString() : null,
        last_login: userProfile.lastLogin ? new Date(userProfile.lastLogin).toISOString() : null,
        last_updated: userProfile.updated ? new Date(userProfile.updated).toISOString() : null,
      },

      supabase_data: null,

      summary: {
        total_credits: userProfile.credits || 0,
        total_spent: userProfile.totalSpent || 0,
        total_messages: userProfile.totalMessages || 0,
        referral_stats: {
          note: 'Referral data available in account settings',
        },
      },
    };

    // Attempt to fetch additional data from Supabase
    try {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        // Resolve user_id from profiles
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, tier, subscription_plan, subscription_status, credits, total_spent')
          .eq('email', userEmail)
          .single();

        const supabaseUserId = profile?.id;

        let usageData = [], translationData = [];
        if (supabaseUserId) {
          const { data: usage } = await supabase
            .from('usage_daily')
            .select('date, translations, tts_chars, stt_seconds, cost_eur_cents')
            .eq('user_id', supabaseUserId)
            .order('date', { ascending: false })
            .limit(365);
          usageData = usage || [];

          const { data: translations } = await supabase
            .from('translations')
            .select('source_lang, target_lang, provider, created_at')
            .eq('user_id', supabaseUserId)
            .order('created_at', { ascending: false })
            .limit(500);
          translationData = translations || [];
        }

        exportData.supabase_data = {
          profile: profile ? { tier: profile.tier, subscription_plan: profile.subscription_plan, credits: profile.credits } : null,
          usage_daily: usageData.map(u => ({
            date: u.date,
            translations: u.translations,
            cost_eur_cents: u.cost_eur_cents,
          })),
          translation_history: translationData.map(t => ({
            created_at: t.created_at,
            source_lang: t.source_lang,
            target_lang: t.target_lang,
          })),
        };
      }
    } catch (supabaseError) {
      console.warn('Supabase fetch failed:', supabaseError.message);
      exportData.supabase_data = {
        error: 'Supabase data unavailable',
      };
    }

    return NextResponse.json(exportData, { status: 200 });
  } catch (error) {
    console.error('Data export error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
