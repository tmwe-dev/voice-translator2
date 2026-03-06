// ═══════════════════════════════════════════════
// Supabase Client — shared across app
// Server-side: uses SUPABASE_SERVICE_ROLE_KEY (bypasses RLS)
// Client-side: uses NEXT_PUBLIC_SUPABASE_ANON_KEY (respects RLS)
// ═══════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── Client-side (browser) — RLS enforced ──
let _clientInstance = null;
export function getSupabaseClient() {
  if (typeof window === 'undefined') return null;
  if (_clientInstance) return _clientInstance;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('[Supabase] Client NOT created — URL:', !!SUPABASE_URL, 'ANON_KEY:', !!SUPABASE_ANON_KEY);
    return null;
  }
  console.log('[Supabase] Creating client for:', SUPABASE_URL);
  _clientInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return _clientInstance;
}

// ── Server-side (API routes) — bypasses RLS ──
let _adminInstance = null;
export function getSupabaseAdmin() {
  if (_adminInstance) return _adminInstance;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    // Fallback: return null so callers can check and use Redis
    return null;
  }
  _adminInstance = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _adminInstance;
}

// ── Helper: check if Supabase is configured ──
export function isSupabaseEnabled() {
  return !!(SUPABASE_URL && (SUPABASE_ANON_KEY || SUPABASE_SERVICE_KEY));
}
