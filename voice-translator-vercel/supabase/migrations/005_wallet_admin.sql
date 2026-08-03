-- ═══════════════════════════════════════════════════════════════
-- 005_wallet_admin.sql — Monitor admin: config servizi + economics
-- ═══════════════════════════════════════════════════════════════

-- ── Interruttori dei servizi AI (li cambi dal monitor admin) ──
CREATE TABLE IF NOT EXISTS ai_config (
  chiave TEXT PRIMARY KEY,          -- es. 'motore_traduzione', 'motore_tts_standard'
  valore TEXT NOT NULL,             -- es. 'gemini-flash-lite', 'edge-tts'
  attivo BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE ai_config ENABLE ROW LEVEL SECURITY;

-- Valori iniziali (motori consigliati dallo studio costi 08/2026)
INSERT INTO ai_config (chiave, valore) VALUES
  ('motore_traduzione', 'gemini-flash-lite'),
  ('motore_traduzione_premium', 'claude-haiku-4.5'),
  ('motore_tts_standard', 'edge-tts'),
  ('motore_tts_premium', 'elevenlabs-flash'),
  ('motore_stt', 'deepgram-nova')
ON CONFLICT (chiave) DO NOTHING;

-- ── Economics: la vista che risponde a "quanto guadagniamo?" ──
-- euro_incassati: dai dettagli dei movimenti 'acquisto' (campo euro)
-- costo_provider_cent: dai dettagli dei movimenti 'uso' (campo costo_cent)
CREATE OR REPLACE VIEW wallet_economics AS
SELECT
  date_trunc('day', created_at)::date AS giorno,
  -- venduto (€) dagli acquisti
  COALESCE(SUM(CASE WHEN tipo = 'acquisto' THEN (dettaglio->>'euro')::numeric END), 0) AS euro_incassati,
  -- secondi venduti e consumati
  COALESCE(SUM(CASE WHEN secondi > 0 THEN secondi END), 0) AS secondi_accreditati,
  COALESCE(SUM(CASE WHEN tipo = 'uso' THEN -secondi END), 0) AS secondi_consumati,
  -- costo provider reale (centesimi €) registrato ad ogni uso
  COALESCE(SUM(CASE WHEN tipo = 'uso' THEN (dettaglio->>'costo_cent')::numeric END), 0) / 100 AS euro_costi_provider,
  COUNT(DISTINCT user_id) AS utenti_attivi
FROM credit_ledger
GROUP BY 1 ORDER BY 1 DESC;

-- Totali di sempre: saldo aggregato = passività (crediti venduti non ancora consumati)
CREATE OR REPLACE VIEW wallet_totali AS
SELECT
  COALESCE(SUM(CASE WHEN tipo = 'acquisto' THEN (dettaglio->>'euro')::numeric END), 0) AS euro_incassati_totale,
  COALESCE(SUM(secondi), 0) AS secondi_in_circolo,   -- crediti inutilizzati (passività)
  COALESCE(SUM(CASE WHEN tipo = 'uso' THEN -secondi END), 0) AS secondi_consumati_totale,
  COALESCE(SUM(CASE WHEN tipo = 'uso' THEN (dettaglio->>'costo_cent')::numeric END), 0) / 100 AS euro_costi_totale
FROM credit_ledger;

-- ── Snapshot dei contatori ufficiali dei provider (per riconciliazione) ──
CREATE TABLE IF NOT EXISTS provider_snapshots (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  dati JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_snapshots ON provider_snapshots (provider, created_at DESC);
ALTER TABLE provider_snapshots ENABLE ROW LEVEL SECURITY;
