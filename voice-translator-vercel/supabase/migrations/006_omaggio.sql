-- ═══ 006 — Tipo 'omaggio' nel registro crediti ═══
-- Credito regalato dall'admin dal pannello Sesamo (bottone Accredita).
-- APPLICATA LIVE il 2026-08-03 via Supabase MCP.

ALTER TABLE credit_ledger DROP CONSTRAINT credit_ledger_tipo_check;
ALTER TABLE credit_ledger ADD CONSTRAINT credit_ledger_tipo_check
  CHECK (tipo = ANY (ARRAY['acquisto','benvenuto','voucher','regalo_in','regalo_out','uso','rimborso','omaggio']));
