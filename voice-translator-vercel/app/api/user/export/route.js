import { NextResponse } from 'next/server';
import { getSession, getUser } from '../../../lib/users.js';
import { createLogger } from '../../../lib/logger.js';
import { withApiGuard } from '../../../lib/apiGuard.js';

const log = createLogger('userExport');

// ═══════════════════════════════════════════════════════════════
// b.422 — L'ESPORTAZIONE PROMETTEVA UN CAPITOLO CHE NON C'ERA MAI.
//
// Il fascicolo consegnato aveva un campo `supabase_data` che doveva
// contenere abbonamento, consumo giornaliero, storico traduzioni e
// pagamenti. Tutte e quattro le letture partivano da
// `profiles` per ricavare l'UUID della persona, e poi leggevano
// `usage_daily` e `payments`. Verificato sul database vivo di
// produzione: `profiles`, `usage_daily` e `payments` NON ESISTONO
// nello schema `public`.
//
// Quindi `supabaseUserId` restava sempre vuoto, i tre `if` che
// dipendevano da lui non entravano mai, e il campo usciva come
// `{ profile: null, usage_daily: [], translation_history: [],
// payments: [] }`. A chi esercita l'articolo 20 del GDPR quel campo
// diceva «di te non abbiamo altro», il che era vero per caso, non per
// costruzione: se un giorno quelle tabelle fossero apparse, avremmo
// continuato a non saperlo. Meglio non dichiarare un capitolo che non
// si sa riempire: il campo e stato tolto del tutto.
//
// Lo storico delle traduzioni non e recuperabile per persona nemmeno
// oggi che `translations` viene finalmente scritta (b.422): la colonna
// `user_id` nasceva come chiave esterna verso `profiles`, e senza
// `profiles` non c'e nessun UUID da metterci.
// ═══════════════════════════════════════════════════════════════


/**
 * GET /api/user/export
 * GDPR Article 20 - Right to Data Portability
 *
 * Returns all user data in a machine-readable JSON format.
 * Requires authentication via Bearer token.
 */
async function handleGet(req) {
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

      summary: {
        total_credits: userProfile.credits || 0,
        total_spent: userProfile.totalSpent || 0,
        total_messages: userProfile.totalMessages || 0,
        referral_stats: {
          note: 'Referral data available in account settings',
        },
      },
    };

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
    log.error('Data export error:', error);
    return NextResponse.json(
      { error: 'Internal server error during data export' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/export
 * Alternative endpoint for browsers that can't send GET with Authorization header
 */
async function handlePost(req) {
  try {
    // b.363 — il gettone arrivava dal corpo e veniva passato cosi com'era
    // alla ricerca della sessione: bastava mandare `token` come oggetto o
    // come lista di centomila caratteri per farlo finire dentro una chiave
    // del database. Qui si esporta TUTTO cio che sappiamo di una persona,
    // quindi la porta va guardata prima di aprirla: dev'essere una stringa,
    // e un gettone di sessione non supera i duecento caratteri.
    const corpo = await req.json();
    const token = corpo?.token;

    if (!token || typeof token !== 'string' || token.length > 200) {
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

      summary: {
        total_credits: userProfile.credits || 0,
        total_spent: userProfile.totalSpent || 0,
        total_messages: userProfile.totalMessages || 0,
        referral_stats: {
          note: 'Referral data available in account settings',
        },
      },
    };

    return NextResponse.json(exportData, { status: 200 });
  } catch (error) {
    log.error('Data export error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// b.363 — questa rotta consegna l'intero fascicolo di una persona (profilo,
// pagamenti, cronologia) e non aveva NESSUN tetto di frequenza ne limite
// alla dimensione del corpo: era l'unica strada, in tutto il repo, per
// provare gettoni di sessione a raffica senza che nessuno contasse. Sei
// esportazioni al minuto sono piu che sufficienti a una persona vera.
export const GET = withApiGuard(handleGet, { maxRequests: 6, prefix: 'user-export', skipBodyCheck: true });
export const POST = withApiGuard(handlePost, { maxRequests: 6, prefix: 'user-export' });
