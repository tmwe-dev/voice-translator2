-- ═══════════════════════════════════════════════════════════════
-- 010_wallet_riserva.sql — b.161-bis, punto 5 dell'ordine di intervento
--
-- RESERVE → PROVIDER → COMMIT/RELEASE.
--
-- Il punto 1 (b.161) ha chiuso il bypass RIPETIBILE ("saldo positivo
-- ma insufficiente"): un preventivo pre-chiamata blocca chi non ha
-- credito a sufficienza. Ma resta una finestra di CORSA: due richieste
-- concorrenti dello stesso utente leggono lo stesso saldo di partenza,
-- passano ENTRAMBE il preventivo, e SOLO l'addebito finale (atomico)
-- le distingue — la seconda torna "esaurito" ma il fornitore, per
-- quella singola richiesta, e gia stato chiamato e il servizio gia
-- consegnato una volta di troppo.
--
-- Questa migrazione chiude quella finestra: invece di
--   "controlla il saldo" → chiama il fornitore → "scala il saldo"
-- (due letture separate dello stesso saldo, in mezzo puo cambiare
-- tutto), diventa
--   "blocca ATOMICAMENTE il saldo" (wallet_riserva) → chiama il
--   fornitore → "conferma al costo vero" (wallet_commit) o "restituisci
--   tutto" (wallet_release)
-- Il saldo scende SUBITO alla riserva, prima ancora di chiamare il
-- fornitore: una seconda richiesta concorrente vede gia il saldo
-- ridotto e non passa piu il controllo, anche se parte un millisecondo
-- dopo la prima.
--
-- Stesso stile di sicurezza di wallet_usa (migration 006): SECURITY
-- DEFINER, search_path fisso, lock per-utente con
-- pg_advisory_xact_lock, nessun accesso da anon/authenticated.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS wallet_riserve (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  secondi INTEGER NOT NULL CHECK (secondi > 0),
  stato TEXT NOT NULL DEFAULT 'attiva' CHECK (stato IN ('attiva', 'confermata', 'rilasciata')),
  dettaglio JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  chiuso_il TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_wallet_riserve_attive ON wallet_riserve(user_id) WHERE stato = 'attiva';

ALTER TABLE wallet_riserve ENABLE ROW LEVEL SECURITY;

-- 1) RISERVA — blocca atomicamente il saldo, PRIMA di chiamare il fornitore.
CREATE OR REPLACE FUNCTION wallet_riserva(p_user_id TEXT, p_secondi INTEGER, p_dettaglio JSONB DEFAULT '{}')
RETURNS TABLE (ok BOOLEAN, riserva_id BIGINT, motivo TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_saldo INTEGER; v_id BIGINT;
BEGIN
  IF p_secondi IS NULL OR p_secondi <= 0 THEN
    RETURN QUERY SELECT false, NULL::BIGINT, 'p_secondi deve essere positivo'; RETURN;
  END IF;
  IF p_secondi > 100000 THEN
    RETURN QUERY SELECT false, NULL::BIGINT, 'p_secondi supera il limite massimo per singola riserva'; RETURN;
  END IF;

  -- Stesso lock per-utente di wallet_usa: una seconda riserva per lo
  -- stesso utente aspetta che questa transazione finisca, quindi vede
  -- gia il saldo ridotto (o l'INSERT sotto, o il rollback se rifiutata).
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id));
  SELECT COALESCE(SUM(secondi), 0) INTO v_saldo FROM credit_ledger WHERE user_id = p_user_id;
  IF v_saldo < p_secondi THEN
    RETURN QUERY SELECT false, NULL::BIGINT, 'saldo insufficiente'; RETURN;
  END IF;

  INSERT INTO wallet_riserve (user_id, secondi, dettaglio) VALUES (p_user_id, p_secondi, p_dettaglio) RETURNING id INTO v_id;
  -- Il saldo scende SUBITO: una riserva 'attiva' pesa sul saldo come
  -- un uso vero, finche non viene confermata o rilasciata.
  INSERT INTO credit_ledger (user_id, tipo, secondi, dettaglio)
  VALUES (p_user_id, 'riserva', -p_secondi, jsonb_build_object('riserva_id', v_id) || p_dettaglio);

  RETURN QUERY SELECT true, v_id, ''::TEXT;
END $$;

-- 2) COMMIT — il fornitore ha risposto: conferma al costo VERO.
-- Se il costo reale e inferiore alla riserva, restituisce la differenza.
-- Se e superiore, NON addebita di piu (coerente con "mai un addebito a
-- sorpresa" gia in vigore ovunque nel wallet): resta il tetto della
-- riserva, e chi chiama puo loggare lo scostamento per l'analisi costi.
CREATE OR REPLACE FUNCTION wallet_commit(p_riserva_id BIGINT, p_secondi_reali INTEGER, p_dettaglio JSONB DEFAULT '{}')
RETURNS TABLE (ok BOOLEAN, motivo TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r wallet_riserve%ROWTYPE; v_reali INTEGER;
BEGIN
  SELECT * INTO r FROM wallet_riserve WHERE id = p_riserva_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'riserva inesistente'; RETURN;
  END IF;
  IF r.stato <> 'attiva' THEN
    RETURN QUERY SELECT false, 'riserva gia chiusa (' || r.stato || ')'; RETURN;
  END IF;

  -- Mai sotto zero, mai sopra il tetto riservato: vedi commento sopra.
  v_reali := GREATEST(0, LEAST(COALESCE(p_secondi_reali, r.secondi), r.secondi));

  UPDATE wallet_riserve SET stato = 'confermata', chiuso_il = now() WHERE id = p_riserva_id;
  IF v_reali < r.secondi THEN
    INSERT INTO credit_ledger (user_id, tipo, secondi, dettaglio)
    VALUES (r.user_id, 'rilascio_parziale', r.secondi - v_reali,
      jsonb_build_object('riserva_id', p_riserva_id, 'secondi_reali', v_reali) || p_dettaglio);
  END IF;

  RETURN QUERY SELECT true, ''::TEXT;
END $$;

-- 3) RELEASE — il fornitore e fallito (o la richiesta si e interrotta):
-- restituisce l'INTERA riserva, come se non fosse mai stata fatta.
CREATE OR REPLACE FUNCTION wallet_release(p_riserva_id BIGINT, p_motivo TEXT DEFAULT '')
RETURNS TABLE (ok BOOLEAN, motivo TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r wallet_riserve%ROWTYPE;
BEGIN
  SELECT * INTO r FROM wallet_riserve WHERE id = p_riserva_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'riserva inesistente'; RETURN;
  END IF;
  IF r.stato <> 'attiva' THEN
    RETURN QUERY SELECT false, 'riserva gia chiusa (' || r.stato || ')'; RETURN;
  END IF;

  UPDATE wallet_riserve SET stato = 'rilasciata', chiuso_il = now() WHERE id = p_riserva_id;
  INSERT INTO credit_ledger (user_id, tipo, secondi, dettaglio)
  VALUES (r.user_id, 'rilascio', r.secondi, jsonb_build_object('riserva_id', p_riserva_id, 'motivo', p_motivo));

  RETURN QUERY SELECT true, ''::TEXT;
END $$;

-- 4) PULIZIA — una riserva 'attiva' che non viene mai confermata ne
-- rilasciata (richiesta serverless morta a meta, senza che ne il commit
-- ne il release facciano in tempo a partire) resterebbe a bloccare
-- credito per sempre. Rilascia dopo 10 minuti: piu che sufficiente per
-- qualunque chiamata provider reale (anche le piu lente, Whisper su
-- audio lungo), abbastanza breve da non lasciare l'utente bloccato a
-- lungo da un crash isolato. Da chiamare periodicamente con un cron.
CREATE OR REPLACE FUNCTION wallet_rilascia_riserve_scadute()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r RECORD; n INTEGER := 0;
BEGIN
  FOR r IN SELECT * FROM wallet_riserve
    WHERE stato = 'attiva' AND created_at < now() - INTERVAL '10 minutes'
    FOR UPDATE
  LOOP
    UPDATE wallet_riserve SET stato = 'rilasciata', chiuso_il = now() WHERE id = r.id;
    INSERT INTO credit_ledger (user_id, tipo, secondi, dettaglio)
    VALUES (r.user_id, 'rilascio', r.secondi, jsonb_build_object('riserva_id', r.id, 'motivo', 'scaduta_10min'));
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

-- 5) tipo di ledger: la CHECK su credit_ledger.tipo (migration 006_omaggio)
-- deve accettare le nuove voci, altrimenti ogni INSERT sopra fallisce.
ALTER TABLE credit_ledger DROP CONSTRAINT IF EXISTS credit_ledger_tipo_check;
ALTER TABLE credit_ledger ADD CONSTRAINT credit_ledger_tipo_check
  CHECK (tipo = ANY (ARRAY['acquisto','benvenuto','voucher','regalo_in','regalo_out','uso',
                           'rimborso','omaggio','riserva','rilascio','rilascio_parziale']));

-- 6) stessa postura di sicurezza di wallet_usa: solo service_role.
REVOKE EXECUTE ON FUNCTION wallet_riserva(TEXT, INTEGER, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION wallet_commit(BIGINT, INTEGER, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION wallet_release(BIGINT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION wallet_rilascia_riserve_scadute() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION wallet_riserva(TEXT, INTEGER, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION wallet_commit(BIGINT, INTEGER, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION wallet_release(BIGINT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION wallet_rilascia_riserve_scadute() TO service_role;
REVOKE ALL ON wallet_riserve FROM PUBLIC, anon, authenticated;
GRANT ALL ON wallet_riserve TO service_role;
