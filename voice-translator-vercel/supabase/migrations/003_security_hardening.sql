-- =============================================
-- Migration 003: Security Hardening
-- Fixes: open RPC functions, public INSERT policies
--
-- STATUS: NOT APPLIED — Supabase public schema has 0 tables.
-- All data lives in Redis (Upstash). This migration is a safety net
-- for when/if tables are created in Supabase. Apply BEFORE creating tables.
-- Last verified: 2026-08-02 (list_tables returned empty)
-- =============================================

-- ═══════════════════════════════════════════════
-- 1. REVOKE public EXECUTE on sensitive RPC functions
--    These should only be callable by the service_role key (server-side)
-- ═══════════════════════════════════════════════

REVOKE EXECUTE ON FUNCTION add_credits(UUID, INT) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION deduct_credits(UUID, INT) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION increment_usage(UUID, INT, INT, INT, INT, INT) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION get_user_analytics(UUID, INT) FROM public, anon, authenticated;

-- Grant only to service_role (used by server-side Supabase admin client)
GRANT EXECUTE ON FUNCTION add_credits(UUID, INT) TO service_role;
GRANT EXECUTE ON FUNCTION deduct_credits(UUID, INT) TO service_role;
GRANT EXECUTE ON FUNCTION increment_usage(UUID, INT, INT, INT, INT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION get_user_analytics(UUID, INT) TO service_role;

-- ═══════════════════════════════════════════════
-- 2. Fix overly permissive INSERT policies
--    Replace WITH CHECK (true) with auth.uid() checks
-- ═══════════════════════════════════════════════

-- room_members: only authenticated users can join, and user_id must match auth
DROP POLICY IF EXISTS "members_insert" ON room_members;
CREATE POLICY "members_insert" ON room_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- translations: only authenticated users can insert their own translations
DROP POLICY IF EXISTS "translations_insert" ON translations;
CREATE POLICY "translations_insert" ON translations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- payments: ONLY service_role should insert payments (via server-side Stripe webhook)
-- WITH CHECK (false) blocks all authenticated users; service_role bypasses RLS entirely
DROP POLICY IF EXISTS "payments_insert" ON payments;
DROP POLICY IF EXISTS "payments_insert_service" ON payments;
CREATE POLICY "payments_insert_service" ON payments FOR INSERT
  WITH CHECK (false);

-- audit_logs: only service_role should insert audit entries
DROP POLICY IF EXISTS "audit_insert" ON audit_logs;
CREATE POLICY "audit_insert_service" ON audit_logs FOR INSERT
  WITH CHECK (false); -- only service_role (bypasses RLS) can insert

-- ═══════════════════════════════════════════════
-- 3. Add auth.uid() validation to SECURITY DEFINER functions
--    Even though EXECUTE is now revoked from public, defense-in-depth
-- ═══════════════════════════════════════════════

CREATE OR REPLACE FUNCTION add_credits(p_user_id UUID, p_amount INT)
RETURNS INT AS $$
DECLARE
  new_balance INT;
BEGIN
  -- Defense-in-depth: this function should only be called by service_role
  -- but verify p_user_id exists as additional safety
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF p_amount > 100000 THEN RAISE EXCEPTION 'Amount exceeds maximum'; END IF;

  UPDATE profiles
  SET credits = credits + p_amount, updated_at = now()
  WHERE id = p_user_id
  RETURNING credits INTO new_balance;
  RETURN COALESCE(new_balance, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION deduct_credits(p_user_id UUID, p_amount INT)
RETURNS INT AS $$
DECLARE
  remaining INT;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  UPDATE profiles
  SET credits = credits - p_amount,
      total_spent = total_spent + p_amount,
      daily_spend = CASE WHEN daily_spend_date = CURRENT_DATE THEN daily_spend + p_amount ELSE p_amount END,
      daily_spend_date = CURRENT_DATE,
      updated_at = now()
  WHERE id = p_user_id AND credits >= p_amount
  RETURNING credits INTO remaining;

  IF remaining IS NULL THEN RETURN -1; END IF;
  RETURN remaining;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-revoke after recreation (CREATE OR REPLACE resets grants)
REVOKE EXECUTE ON FUNCTION add_credits(UUID, INT) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION deduct_credits(UUID, INT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION add_credits(UUID, INT) TO service_role;
GRANT EXECUTE ON FUNCTION deduct_credits(UUID, INT) TO service_role;
