-- ═══════════════════════════════════════════════════════════════
-- b.614 — LA RISERVA AVEVA PERSO IL FILO CON IL REGISTRO.
--
-- Trovato dal vivo (collaudo 03/09, riserva 1722): una telefonata Dal
-- vivo di 29 secondi e' rimasta addebitata per i 540 del tratto intero.
-- Nel registro la riga era ancora `tipo='riserva', secondi=-540`, senza
-- `secondi_reali`. E non era quella telefonata: dal 22/08 (b.364) OGNI
-- riserva finisce cosi.
--
-- LA CAUSA. La 011 aveva aggiunto `wallet_riserve.ledger_id` e l'UPDATE
-- che lo scrive dentro `wallet_riserva`. La 012 (b.364, la tolleranza)
-- ha riscritto `wallet_riserva` partendo dal testo della 010 — quello
-- PRIMA della 011 — e l'UPDATE e' sparito. Da allora `ledger_id` e' NULL
-- su ogni riserva nuova, e `wallet_commit` / `wallet_release` /
-- `wallet_rilascia_riserve_scadute` fanno `UPDATE credit_ledger WHERE
-- id = NULL`: zero righe, in silenzio. La riserva cambia stato, il
-- registro no: si paga sempre tutto il riservato, anche quando la
-- riserva e' stata RILASCIATA (fornitore fallito, «nessun parlato»).
--
-- In cifre (03/09, prima di questa migrazione): 1.015 riserve senza
-- ledger_id, 1.013 di un solo account (quello di Luca), 2 di altri
-- utenti (77 s e 5 s). 255 di quelle erano rilasciate: 3.450 secondi
-- addebitati per niente.
--
-- COSA FA QUESTA MIGRAZIONE, in ordine:
--   1) `wallet_riserva` = tolleranza (012) + ledger_id (011). Tutte e due.
--   2) commit / release / scadute: se `ledger_id` manca, la riga del
--      registro si ritrova per `dettaglio->>'riserva_id'` — cosi un
--      difetto come questo non puo' piu' azzerare gli aggiornamenti in
--      silenzio.
--   3) Si ricollega `ledger_id` alle 1.015 riserve orfane (solo un
--      puntatore: nessun secondo cambia).
--   4) Le riserve RILASCIATE tornano a costo zero, come dovevano essere:
--      e' l'unica riparazione certa. Le CONFERMATE restano come sono: i
--      secondi reali non sono mai stati scritti da nessuna parte e non
--      si inventano — sono un debito dichiarato, con i numeri, nel
--      changelog.
--   Prima della 4) lo stato di ogni riga toccata finisce in
--   `wallet_riparazione_b614`: si torna indietro da li'.
-- ═══════════════════════════════════════════════════════════════

-- 1) LA RISERVA, con tutti e due i pezzi.
CREATE OR REPLACE FUNCTION wallet_riserva(p_user_id TEXT, p_secondi INTEGER, p_dettaglio JSONB DEFAULT '{}')
RETURNS TABLE (ok BOOLEAN, riserva_id BIGINT, motivo TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_saldo INTEGER; v_id BIGINT; v_ledger_id BIGINT;
BEGIN
  IF p_secondi IS NULL OR p_secondi <= 0 THEN
    RETURN QUERY SELECT false, NULL::BIGINT, 'p_secondi deve essere positivo'; RETURN;
  END IF;
  IF p_secondi > 100000 THEN
    RETURN QUERY SELECT false, NULL::BIGINT, 'p_secondi supera il limite massimo per singola riserva'; RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_user_id));
  SELECT COALESCE(SUM(secondi), 0) INTO v_saldo FROM credit_ledger WHERE user_id = p_user_id;
  -- b.364 — il pavimento e' meno la tolleranza (012).
  IF v_saldo - p_secondi < -wallet_tolleranza(p_user_id) THEN
    RETURN QUERY SELECT false, NULL::BIGINT, 'saldo insufficiente'; RETURN;
  END IF;

  INSERT INTO wallet_riserve (user_id, secondi, dettaglio) VALUES (p_user_id, p_secondi, p_dettaglio) RETURNING id INTO v_id;
  INSERT INTO credit_ledger (user_id, tipo, secondi, dettaglio)
  VALUES (p_user_id, 'riserva', -p_secondi, jsonb_build_object('riserva_id', v_id) || p_dettaglio)
  RETURNING id INTO v_ledger_id;
  -- b.163/011 — il filo con il registro. E' QUESTA la riga che la 012 aveva perso.
  UPDATE wallet_riserve SET ledger_id = v_ledger_id WHERE id = v_id;

  RETURN QUERY SELECT true, v_id, ''::TEXT;
END $$;

-- 2) IL FILO SI RITROVA ANCHE SE MANCA: la riga 'riserva' porta
--    riserva_id nel dettaglio fin dalla 010.
CREATE OR REPLACE FUNCTION wallet_ledger_di_riserva(p_riserva_id BIGINT, p_ledger_id BIGINT)
RETURNS BIGINT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id BIGINT;
BEGIN
  IF p_ledger_id IS NOT NULL THEN RETURN p_ledger_id; END IF;
  SELECT id INTO v_id FROM credit_ledger
    WHERE (dettaglio->>'riserva_id')::bigint = p_riserva_id
    ORDER BY id LIMIT 1;
  RETURN v_id;
END $$;
REVOKE EXECUTE ON FUNCTION wallet_ledger_di_riserva(BIGINT, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION wallet_ledger_di_riserva(BIGINT, BIGINT) TO service_role;

CREATE OR REPLACE FUNCTION wallet_commit(p_riserva_id BIGINT, p_secondi_reali INTEGER, p_dettaglio JSONB DEFAULT '{}')
RETURNS TABLE (ok BOOLEAN, motivo TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r wallet_riserve%ROWTYPE; v_reali INTEGER; v_costo_orig NUMERIC; v_ledger BIGINT;
BEGIN
  SELECT * INTO r FROM wallet_riserve WHERE id = p_riserva_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT false, 'riserva inesistente'; RETURN; END IF;
  IF r.stato <> 'attiva' THEN RETURN QUERY SELECT false, 'riserva gia chiusa (' || r.stato || ')'; RETURN; END IF;

  v_ledger := wallet_ledger_di_riserva(r.id, r.ledger_id);
  -- b.614 — senza registro non si conferma: si direbbe «pagato» e il
  -- conto resterebbe a tutto il riservato.
  IF v_ledger IS NULL THEN RETURN QUERY SELECT false, 'riga di registro non trovata'; RETURN; END IF;

  v_reali := GREATEST(0, LEAST(COALESCE(p_secondi_reali, r.secondi), r.secondi));
  UPDATE wallet_riserve SET stato = 'confermata', chiuso_il = now(), ledger_id = v_ledger WHERE id = p_riserva_id;

  SELECT (dettaglio->>'costo_cent')::numeric INTO v_costo_orig FROM credit_ledger WHERE id = v_ledger;
  UPDATE credit_ledger
  SET tipo = 'uso',
      secondi = -v_reali,
      dettaglio = dettaglio
        || jsonb_build_object('secondi_riservati', r.secondi, 'secondi_reali', v_reali)
        || p_dettaglio
        || CASE WHEN v_costo_orig IS NOT NULL AND r.secondi > 0
                THEN jsonb_build_object('costo_cent', round(v_costo_orig * v_reali / r.secondi, 2))
                ELSE '{}'::jsonb END
  WHERE id = v_ledger;

  RETURN QUERY SELECT true, ''::TEXT;
END $$;

CREATE OR REPLACE FUNCTION wallet_release(p_riserva_id BIGINT, p_motivo TEXT DEFAULT '')
RETURNS TABLE (ok BOOLEAN, motivo TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r wallet_riserve%ROWTYPE; v_ledger BIGINT;
BEGIN
  SELECT * INTO r FROM wallet_riserve WHERE id = p_riserva_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT false, 'riserva inesistente'; RETURN; END IF;
  IF r.stato <> 'attiva' THEN RETURN QUERY SELECT false, 'riserva gia chiusa (' || r.stato || ')'; RETURN; END IF;

  v_ledger := wallet_ledger_di_riserva(r.id, r.ledger_id);
  IF v_ledger IS NULL THEN RETURN QUERY SELECT false, 'riga di registro non trovata'; RETURN; END IF;

  UPDATE wallet_riserve SET stato = 'rilasciata', chiuso_il = now(), ledger_id = v_ledger WHERE id = p_riserva_id;
  UPDATE credit_ledger
  SET tipo = 'rilascio', secondi = 0,
      dettaglio = dettaglio || jsonb_build_object('motivo', p_motivo)
  WHERE id = v_ledger;

  RETURN QUERY SELECT true, ''::TEXT;
END $$;

CREATE OR REPLACE FUNCTION wallet_rilascia_riserve_scadute()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r RECORD; n INTEGER := 0; v_ledger BIGINT;
BEGIN
  FOR r IN SELECT * FROM wallet_riserve
    WHERE stato = 'attiva' AND created_at < now() - INTERVAL '10 minutes'
    FOR UPDATE
  LOOP
    v_ledger := wallet_ledger_di_riserva(r.id, r.ledger_id);
    UPDATE wallet_riserve SET stato = 'rilasciata', chiuso_il = now(), ledger_id = v_ledger WHERE id = r.id;
    UPDATE credit_ledger
    SET tipo = 'rilascio', secondi = 0,
        dettaglio = dettaglio || jsonb_build_object('motivo', 'scaduta_10min')
    WHERE id = v_ledger;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

-- 3) SI RICOLLEGA IL FILO alle riserve orfane. Solo il puntatore.
UPDATE wallet_riserve r
SET ledger_id = l.id
FROM credit_ledger l
WHERE r.ledger_id IS NULL
  AND l.user_id = r.user_id
  AND (l.dettaglio->>'riserva_id')::bigint = r.id;

-- 4) LE RILASCIATE TORNANO A ZERO — con la copia di prima da parte.
CREATE TABLE IF NOT EXISTS wallet_riparazione_b614 (
  ledger_id BIGINT PRIMARY KEY,
  riserva_id BIGINT NOT NULL,
  user_id TEXT NOT NULL,
  tipo_prima TEXT NOT NULL,
  secondi_prima INTEGER NOT NULL,
  dettaglio_prima JSONB NOT NULL,
  riparato_il TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE wallet_riparazione_b614 ENABLE ROW LEVEL SECURITY;

INSERT INTO wallet_riparazione_b614 (ledger_id, riserva_id, user_id, tipo_prima, secondi_prima, dettaglio_prima)
SELECT l.id, r.id, l.user_id, l.tipo, l.secondi, l.dettaglio
FROM wallet_riserve r JOIN credit_ledger l ON l.id = r.ledger_id
WHERE r.stato = 'rilasciata' AND l.tipo = 'riserva'
ON CONFLICT (ledger_id) DO NOTHING;

UPDATE credit_ledger l
SET tipo = 'rilascio', secondi = 0,
    dettaglio = l.dettaglio || jsonb_build_object('motivo', 'riparazione_b614', 'secondi_prima', l.secondi)
FROM wallet_riserve r
WHERE l.id = r.ledger_id AND r.stato = 'rilasciata' AND l.tipo = 'riserva';

-- Per tornare indietro dalla 4):
--   UPDATE credit_ledger l SET tipo = b.tipo_prima, secondi = b.secondi_prima, dettaglio = b.dettaglio_prima
--   FROM wallet_riparazione_b614 b WHERE l.id = b.ledger_id;
