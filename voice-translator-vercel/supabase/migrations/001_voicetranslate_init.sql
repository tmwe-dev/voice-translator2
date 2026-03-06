-- VoiceTranslate — Schema PostgreSQL (Supabase)
-- Run in Supabase Dashboard → SQL Editor
-- Adapted from BarTalk v79 + VoiceTranslate-specific tables

-- ══════════════════════════════════════════════════════════════════════
-- 1. PROFILES: extends auth.users with app-specific data
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT UNIQUE NOT NULL,
  name            TEXT DEFAULT '',
  avatar          TEXT DEFAULT 'default',
  lang            TEXT DEFAULT 'it',
  tier            TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'business', 'admin')),
  credits         INT DEFAULT 0,                    -- euro-cents
  total_spent     INT DEFAULT 0,                    -- euro-cents lifetime
  total_messages  INT DEFAULT 0,
  use_own_keys    BOOLEAN DEFAULT false,
  cloned_voice_id TEXT,
  cloned_voice_name TEXT,
  referral_code   TEXT UNIQUE,
  referred_by     TEXT,                             -- referral code used at signup
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT DEFAULT 'none' CHECK (subscription_status IN ('none', 'active', 'past_due', 'canceled', 'trialing')),
  subscription_plan TEXT DEFAULT 'free' CHECK (subscription_plan IN ('free', 'pro', 'business')),
  subscription_period_end TIMESTAMPTZ,
  daily_spend     INT DEFAULT 0,                    -- euro-cents spent today
  daily_spend_date DATE DEFAULT CURRENT_DATE,
  onboarding_done BOOLEAN DEFAULT false,
  last_login      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_own" ON profiles FOR ALL
  USING (auth.uid() = id);

-- Auto-create profile on auth signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, name, referral_code)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    encode(gen_random_bytes(6), 'hex')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ══════════════════════════════════════════════════════════════════════
-- 2. USER SETTINGS: per-user preferences (replaces localStorage)
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_settings (
  user_id           UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  source_lang       TEXT DEFAULT 'it',
  target_lang       TEXT DEFAULT 'en',
  tts_enabled       BOOLEAN DEFAULT true,
  tts_engine        TEXT DEFAULT 'openai' CHECK (tts_engine IN ('openai', 'elevenlabs', 'edge')),
  tts_voice         TEXT DEFAULT 'nova',
  tts_auto_play     BOOLEAN DEFAULT true,
  stt_engine        TEXT DEFAULT 'browser' CHECK (stt_engine IN ('browser', 'whisper', 'auto')),
  ai_model          TEXT DEFAULT 'gpt-4o-mini',
  theme             TEXT DEFAULT 'dark',
  context_type      TEXT DEFAULT 'general',
  voice_speed       REAL DEFAULT 1.0,
  auto_translate    BOOLEAN DEFAULT true,
  show_original     BOOLEAN DEFAULT true,
  notification_sound BOOLEAN DEFAULT true,
  glossary_id       UUID,                          -- active glossary
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_own" ON user_settings FOR ALL USING (auth.uid() = user_id);

-- Auto-create settings on profile creation
CREATE OR REPLACE FUNCTION create_default_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_settings (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION create_default_settings();

-- ══════════════════════════════════════════════════════════════════════
-- 3. API KEYS VAULT: encrypted provider keys
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS api_keys_vault (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'gemini', 'elevenlabs')),
  encrypted_key TEXT NOT NULL,
  model         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, provider)
);

ALTER TABLE api_keys_vault ENABLE ROW LEVEL SECURITY;
CREATE POLICY "keys_own" ON api_keys_vault FOR ALL USING (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════════════════
-- 4. ROOMS: real-time translation rooms (replaces Redis room:{id})
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS rooms (
  id            TEXT PRIMARY KEY,                   -- 6-char room code
  host_id       UUID NOT NULL REFERENCES profiles(id),
  host_email    TEXT NOT NULL,
  mode          TEXT DEFAULT 'conversation' CHECK (mode IN ('conversation', 'classroom', 'freetalk', 'simultaneous')),
  context_type  TEXT DEFAULT 'general',
  context_prompt TEXT,
  description   TEXT,
  max_members   INT DEFAULT 10,
  is_active     BOOLEAN DEFAULT true,
  total_cost    REAL DEFAULT 0,                    -- USD
  msg_count     INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now(),
  ended_at      TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ DEFAULT (now() + interval '2 hours')
);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rooms_public_read" ON rooms FOR SELECT USING (true);
CREATE POLICY "rooms_host_write" ON rooms FOR UPDATE USING (auth.uid() = host_id);
CREATE POLICY "rooms_host_insert" ON rooms FOR INSERT WITH CHECK (auth.uid() = host_id);

-- ══════════════════════════════════════════════════════════════════════
-- 5. ROOM MEMBERS: who's in which room
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS room_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES profiles(id),
  name        TEXT NOT NULL,
  lang        TEXT NOT NULL DEFAULT 'en',
  avatar      TEXT DEFAULT 'default',
  role        TEXT DEFAULT 'guest' CHECK (role IN ('host', 'guest')),
  is_online   BOOLEAN DEFAULT true,
  last_seen   TIMESTAMPTZ DEFAULT now(),
  joined_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_read" ON room_members FOR SELECT USING (true);
CREATE POLICY "members_insert" ON room_members FOR INSERT WITH CHECK (true);
CREATE POLICY "members_update_own" ON room_members FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX idx_room_members_room ON room_members(room_id);

-- ══════════════════════════════════════════════════════════════════════
-- 6. TRANSLATIONS: every translated message (replaces Redis messages)
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS translations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         TEXT REFERENCES rooms(id) ON DELETE SET NULL,
  user_id         UUID REFERENCES profiles(id),
  source_lang     TEXT NOT NULL,
  target_lang     TEXT NOT NULL,
  source_text     TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  provider        TEXT,                             -- 'microsoft', 'google', 'gpt-4o-mini', etc.
  ai_model        TEXT,
  tokens_in       INT DEFAULT 0,
  tokens_out      INT DEFAULT 0,
  duration_ms     INT DEFAULT 0,
  cost_usd        REAL DEFAULT 0,
  cost_eur_cents  REAL DEFAULT 0,
  is_cached       BOOLEAN DEFAULT false,
  validation_ok   BOOLEAN DEFAULT true,
  context_type    TEXT,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "translations_own" ON translations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "translations_insert" ON translations FOR INSERT WITH CHECK (true);

CREATE INDEX idx_translations_user ON translations(user_id, created_at DESC);
CREATE INDEX idx_translations_room ON translations(room_id, created_at ASC);

-- ══════════════════════════════════════════════════════════════════════
-- 7. CONVERSATIONS: saved room sessions (after room ends)
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS conversations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  room_id       TEXT,
  title         TEXT NOT NULL DEFAULT 'Conversazione',
  participants  JSONB DEFAULT '[]'::jsonb,
  languages     TEXT[] DEFAULT ARRAY[]::TEXT[],
  msg_count     INT DEFAULT 0,
  duration_sec  INT DEFAULT 0,
  summary       TEXT,
  summary_key_points JSONB DEFAULT '[]'::jsonb,
  total_cost    REAL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conversations_own" ON conversations FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_conversations_user ON conversations(user_id, updated_at DESC);

-- ══════════════════════════════════════════════════════════════════════
-- 8. GLOSSARIES: domain-specific translation rules
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS glossaries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  domain      TEXT DEFAULT 'general',              -- medical, legal, technical, etc.
  source_lang TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  entries     JSONB DEFAULT '[]'::jsonb,           -- [{source, target, context}]
  is_active   BOOLEAN DEFAULT true,
  is_shared   BOOLEAN DEFAULT false,               -- shareable with room
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE glossaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "glossaries_own" ON glossaries FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "glossaries_shared_read" ON glossaries FOR SELECT USING (is_shared = true);

-- ══════════════════════════════════════════════════════════════════════
-- 9. PAYMENTS: full payment history (replaces Redis payments)
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES profiles(id),
  stripe_session_id   TEXT UNIQUE,
  stripe_payment_intent TEXT,
  type                TEXT NOT NULL CHECK (type IN ('credits', 'subscription', 'refund')),
  amount_eur_cents    INT NOT NULL,
  credits_added       INT DEFAULT 0,
  plan                TEXT,                         -- 'pro', 'business' for subscriptions
  status              TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  metadata            JSONB DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments_own" ON payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "payments_insert" ON payments FOR INSERT WITH CHECK (true);

CREATE INDEX idx_payments_user ON payments(user_id, created_at DESC);

-- ══════════════════════════════════════════════════════════════════════
-- 10. CONTACTS: user contacts & presence
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  contact_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nickname    TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, contact_id)
);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contacts_own" ON contacts FOR ALL USING (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════════════════
-- 11. AUDIT LOG: compliance & GDPR trail
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES profiles(id),
  action      TEXT NOT NULL,
  resource    TEXT,
  details     JSONB DEFAULT '{}'::jsonb,
  ip_address  INET,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_own_read" ON audit_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "audit_insert" ON audit_logs FOR INSERT WITH CHECK (true);

CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at DESC);

-- ══════════════════════════════════════════════════════════════════════
-- 12. USAGE ANALYTICS: daily aggregated stats per user
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS usage_daily (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  translations    INT DEFAULT 0,
  tts_chars       INT DEFAULT 0,
  stt_seconds     INT DEFAULT 0,
  rooms_created   INT DEFAULT 0,
  rooms_joined    INT DEFAULT 0,
  cost_eur_cents  INT DEFAULT 0,
  tokens_used     INT DEFAULT 0,
  providers_used  JSONB DEFAULT '{}'::jsonb,        -- {"openai": 15, "microsoft": 42}
  languages_used  JSONB DEFAULT '{}'::jsonb,        -- {"it->en": 20, "en->th": 5}
  UNIQUE(user_id, date)
);

ALTER TABLE usage_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usage_own" ON usage_daily FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_usage_user_date ON usage_daily(user_id, date DESC);

-- ══════════════════════════════════════════════════════════════════════
-- 13. SUBSCRIPTION PLANS: pricing definition
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS subscription_plans (
  id                  TEXT PRIMARY KEY,             -- 'free', 'pro', 'business'
  name                TEXT NOT NULL,
  price_eur_monthly   INT NOT NULL,                 -- euro-cents
  price_eur_yearly    INT NOT NULL,                 -- euro-cents (discounted)
  credits_monthly     INT DEFAULT 0,                -- bonus credits per month
  features            JSONB DEFAULT '{}'::jsonb,
  stripe_price_monthly TEXT,                        -- Stripe price ID
  stripe_price_yearly  TEXT,                        -- Stripe price ID
  is_active           BOOLEAN DEFAULT true,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- Seed plans
INSERT INTO subscription_plans (id, name, price_eur_monthly, price_eur_yearly, credits_monthly, features) VALUES
  ('free', 'Free', 0, 0, 0, '{"max_rooms": 3, "max_members": 2, "tts_engines": ["edge"], "ai_models": [], "voice_clone": false, "glossaries": 0, "history_days": 7, "free_chars_daily": 50000}'::jsonb),
  ('pro', 'Pro', 990, 9900, 500, '{"max_rooms": 50, "max_members": 5, "tts_engines": ["openai", "elevenlabs", "edge"], "ai_models": ["gpt-4o-mini", "claude-haiku", "gemini-flash"], "voice_clone": true, "glossaries": 5, "history_days": 90, "free_chars_daily": 0}'::jsonb),
  ('business', 'Business', 2990, 29900, 3000, '{"max_rooms": -1, "max_members": 10, "tts_engines": ["openai", "elevenlabs", "edge"], "ai_models": ["gpt-4o", "claude-sonnet", "gemini-pro", "gpt-4o-mini", "claude-haiku", "gemini-flash"], "voice_clone": true, "glossaries": -1, "history_days": -1, "free_chars_daily": 0, "api_access": true, "priority_support": true}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════
-- HELPER FUNCTIONS
-- ══════════════════════════════════════════════════════════════════════

-- Increment usage stats atomically
CREATE OR REPLACE FUNCTION increment_usage(
  p_user_id UUID,
  p_translations INT DEFAULT 0,
  p_tts_chars INT DEFAULT 0,
  p_stt_seconds INT DEFAULT 0,
  p_cost_cents INT DEFAULT 0,
  p_tokens INT DEFAULT 0
) RETURNS VOID AS $$
BEGIN
  INSERT INTO usage_daily (user_id, date, translations, tts_chars, stt_seconds, cost_eur_cents, tokens_used)
  VALUES (p_user_id, CURRENT_DATE, p_translations, p_tts_chars, p_stt_seconds, p_cost_cents, p_tokens)
  ON CONFLICT (user_id, date) DO UPDATE SET
    translations = usage_daily.translations + p_translations,
    tts_chars = usage_daily.tts_chars + p_tts_chars,
    stt_seconds = usage_daily.stt_seconds + p_stt_seconds,
    cost_eur_cents = usage_daily.cost_eur_cents + p_cost_cents,
    tokens_used = usage_daily.tokens_used + p_tokens;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Deduct credits atomically (returns remaining or -1 if insufficient)
CREATE OR REPLACE FUNCTION deduct_credits(p_user_id UUID, p_amount INT)
RETURNS INT AS $$
DECLARE
  remaining INT;
BEGIN
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

-- Add credits (from payment or referral)
CREATE OR REPLACE FUNCTION add_credits(p_user_id UUID, p_amount INT)
RETURNS INT AS $$
DECLARE
  new_balance INT;
BEGIN
  UPDATE profiles
  SET credits = credits + p_amount, updated_at = now()
  WHERE id = p_user_id
  RETURNING credits INTO new_balance;
  RETURN COALESCE(new_balance, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user analytics summary
CREATE OR REPLACE FUNCTION get_user_analytics(p_user_id UUID, p_days INT DEFAULT 30)
RETURNS TABLE (
  total_translations BIGINT,
  total_tts_chars BIGINT,
  total_stt_seconds BIGINT,
  total_cost BIGINT,
  total_tokens BIGINT,
  active_days BIGINT,
  avg_daily_translations NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(translations), 0),
    COALESCE(SUM(tts_chars), 0),
    COALESCE(SUM(stt_seconds), 0),
    COALESCE(SUM(cost_eur_cents), 0),
    COALESCE(SUM(tokens_used), 0),
    COUNT(DISTINCT date),
    ROUND(COALESCE(AVG(translations), 0), 1)
  FROM usage_daily
  WHERE user_id = p_user_id
    AND date >= CURRENT_DATE - p_days;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
