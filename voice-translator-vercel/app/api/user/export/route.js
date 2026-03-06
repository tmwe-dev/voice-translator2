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
        // Fetch subscription data if table exists
        const { data: subscriptions, error: subError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('email', userEmail)
          .limit(10);

        // Fetch usage logs if table exists
        const { data: usageLogs, error: usageError } = await supabase
          .from('usage_logs')
          .select('*')
          .eq('email', userEmail)
          .order('created_at', { ascending: false })
          .limit(1000);

        // Fetch translation history if table exists
        const { data: translations, error: translationError } = await supabase
          .from('translations')
          .select('*')
          .eq('email', userEmail)
          .order('created_at', { ascending: false })
          .limit(500);

        exportData.supabase_data = {
          subscriptions: subscriptions && !subError ? subscriptions.map(s => ({
            id: s.id,
            email: s.email,
            tier: s.tier,
            status: s.status,
            created_at: s.created_at,
            expires_at: s.expires_at,
          })) : [],

          usage_logs: usageLogs && !usageError ? usageLogs.map(u => ({
            id: u.id,
            date: u.created_at,
            type: u.type,
            provider: u.provider,
            source_language: u.source_language,
            target_language: u.target_language,
            characters_processed: u.characters_processed,
            cost_cents: u.cost_cents,
          })) : [],

          translation_history: translations && !translationError ? translations.map(t => ({
            id: t.id,
            created_at: t.created_at,
            source_language: t.source_language,
            target_language: t.target_language,
            // Note: actual translation text is not included for privacy
            status: t.status,
          })) : [],
        };

        // Update summary with actual counts
        if (usageLogs && !usageError) {
          exportData.summary.usage_log_count = usageLogs.length;
        }
        if (translations && !translationError) {
          exportData.summary.translation_history_count = translations.length;
        }
      }
    } catch (supabaseError) {
      // Supabase might not be configured or accessible
      // This is okay - we still return the user data from Redis
      console.warn('Supabase fetch failed during export:', supabaseError.message);
      exportData.supabase_data = {
        error: 'Supabase data unavailable',
        subscriptions: [],
        usage_logs: [],
        translation_history: [],
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
        const { data: subscriptions } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('email', userEmail)
          .limit(10);

        const { data: usageLogs } = await supabase
          .from('usage_logs')
          .select('*')
          .eq('email', userEmail)
          .order('created_at', { ascending: false })
          .limit(1000);

        const { data: translations } = await supabase
          .from('translations')
          .select('*')
          .eq('email', userEmail)
          .order('created_at', { ascending: false })
          .limit(500);

        exportData.supabase_data = {
          subscriptions: subscriptions || [],
          usage_logs: usageLogs ? usageLogs.map(u => ({
            date: u.created_at,
            type: u.type,
            provider: u.provider,
            cost_cents: u.cost_cents,
          })) : [],
          translation_history: translations ? translations.map(t => ({
            created_at: t.created_at,
            source_language: t.source_language,
            target_language: t.target_language,
          })) : [],
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
