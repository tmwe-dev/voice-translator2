-- ═══ 007 — Bonus benvenuto unico per utente ═══
-- Indice parziale: una sola riga tipo='benvenuto' per user_id.
-- Anche con due richieste simultanee, il secondo insert fallisce (23505).
-- APPLICATA LIVE il 2026-08-03 via Supabase MCP.

CREATE UNIQUE INDEX IF NOT EXISTS uniq_benvenuto ON credit_ledger (user_id) WHERE tipo = 'benvenuto';
