-- ═══════════════════════════════════════════════════════════════
-- 007_wallet_webhook_idempotency.sql — b.154
--
-- APPLICATA GIA' in produzione (Supabase MCP, 14/8).
--
-- CONFERMATO leggendo app/api/wallet/webhook/route.js: il webhook
-- Stripe non registrava da nessuna parte quale Stripe Session ID
-- fosse gia stato accreditato. Stripe puo consegnare lo stesso
-- evento piu volte (retry, resend manuale): senza un vincolo A
-- LIVELLO DB, un doppio invio duplica l'accredito.
--
-- Indice unico parziale: un solo movimento 'acquisto' per ogni
-- Stripe Session ID. L'unicita' vive nel database, non in un
-- controllo JavaScript che puo essere aggirato da due richieste
-- concorrenti (stesso problema, versione "corsa tra due processi").
-- ═══════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_stripe_session
  ON credit_ledger ((dettaglio->>'stripe'))
  WHERE tipo = 'acquisto' AND dettaglio->>'stripe' IS NOT NULL;
