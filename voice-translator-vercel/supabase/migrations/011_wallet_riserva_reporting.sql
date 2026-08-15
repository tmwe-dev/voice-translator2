-- ═══════════════════════════════════════════════════════════════
-- 011_wallet_riserva_reporting.sql — b.163
--
-- BUG REALE confermato dall'utente, trovato analizzando b.162 (non un
-- audit mio): la migrazione 010 (reserve/commit/release) lasciava,
-- per un uso confermato al costo pieno, UNA riga permanente di tipo
-- 'riserva' — mai convertita in 'uso'. Le tre viste economiche
-- (wallet_economics, wallet_totali, wallet_per_utente) e la funzione
-- wallet_uso() (il numero "oggi/mese" mostrato all'utente) filtrano
-- tutte SOLO tipo = 'uso' (o "secondi < 0" senza nettare gli offset):
-- risultato, un consumo vero spariva dai secondi consumati, dai costi
-- provider e dal numero_usi dell'Admin — il saldo restava corretto,
-- ma la contabilita analitica no. In piu, wallet_uso() vedeva la riga
-- 'riserva' negativa di un fornitore FALLITO senza mai nettarla con
-- la riga 'rilascio' positiva: mostrava "hai consumato X secondi"
-- anche quando il fornitore non aveva consegnato nulla.
--
-- Causa radice: il design di 010 modellava riserva/commit/release come
-- PIU righe indipendenti (riserva -100, poi eventualmente
-- rilascio_parziale +20 o rilascio +100), invece che come UNA riga
-- che arriva al suo stato finale. Le viste/funzioni esistenti erano
-- gia costruite sull'invariante "ogni riga e' gia definitiva" — non
-- serve riscrivere le viste, serve restituire quell'invariante.
--
-- Fix: wallet_commit/wallet_release/wallet_rilascia_riserve_scadute
-- ora AGGIORNANO in place la STESSA riga di credit_ledger creata da
-- wallet_riserva (via un nuovo puntatore wallet_riserve.ledger_id),
-- invece di lasciarla 'riserva' e inserirne una seconda di rettifica:
--
--   commit  → quella riga diventa tipo='uso', secondi=-reali (mai piu
--             del riservato), costo_cent proporzionato al reale
--   release → quella riga diventa tipo='rilascio', secondi=0 (nessun
--             effetto sul saldo, e sparisce dal "consumato" perche
--             nessuna vista conta mai tipo='rilascio')
--
-- Fine di 'rilascio_parziale' come riga a se: non serve piu, il
-- rimborso parziale e' gia dentro il nuovo secondi netto della riga
-- 'uso'. La CHECK su credit_ledger.tipo (migrazione 010) continua ad
-- accettare 'rilascio_parziale' per compatibilita con eventuali righe
-- storiche gia scritte, ma nessuna funzione la scrive piu da qui in
-- avanti.
--
-- ZERO modifiche a app/wallet/riserva.js o alle tre rotte
-- (transcribe/translate/tts): stessa firma RPC, stesso comportamento
-- dal punto di vista del saldo — cambia solo COME la riga finale
-- viene scritta nel ledger.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE wallet_riserve ADD COLUMN IF NOT EXISTS ledger_id BIGINT;

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
  IF v_saldo < p_secondi THEN
    RETURN QUERY SELECT false, NULL::BIGINT, 'saldo insufficiente'; RETURN;
  END IF;

  INSERT INTO wallet_riserve (user_id, secondi, dettaglio) VALUES (p_user_id, p_secondi, p_dettaglio) RETURNING id INTO v_id;
  -- b.163 — questa e' l'UNICA riga di credit_ledger per l'intera vita
  -- della riserva: commit/release la aggiornano, non ne aggiungono
  -- altre. Il saldo scende SUBITO, come prima.
  INSERT INTO credit_ledger (user_id, tipo, secondi, dettaglio)
  VALUES (p_user_id, 'riserva', -p_secondi, jsonb_build_object('riserva_id', v_id) || p_dettaglio)
  RETURNING id INTO v_ledger_id;
  UPDATE wallet_riserve SET ledger_id = v_ledger_id WHERE id = v_id;

  RETURN QUERY SELECT true, v_id, ''::TEXT;
END $$;

CREATE OR REPLACE FUNCTION wallet_commit(p_riserva_id BIGINT, p_secondi_reali INTEGER, p_dettaglio JSONB DEFAULT '{}')
RETURNS TABLE (ok BOOLEAN, motivo TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r wallet_riserve%ROWTYPE; v_reali INTEGER; v_costo_orig NUMERIC;
BEGIN
  SELECT * INTO r FROM wallet_riserve WHERE id = p_riserva_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT false, 'riserva inesistente'; RETURN; END IF;
  IF r.stato <> 'attiva' THEN RETURN QUERY SELECT false, 'riserva gia chiusa (' || r.stato || ')'; RETURN; END IF;

  -- Mai sotto zero, mai sopra il tetto riservato (invariato da 010).
  v_reali := GREATEST(0, LEAST(COALESCE(p_secondi_reali, r.secondi), r.secondi));
  UPDATE wallet_riserve SET stato = 'confermata', chiuso_il = now() WHERE id = p_riserva_id;

  -- b.163 — la riga 'riserva' diventa DIRETTAMENTE la riga 'uso'
  -- finale (stesso id, nessuna riga nuova): e' cosi che wallet_uso()/
  -- wallet_economics/wallet_totali/wallet_per_utente la vedono senza
  -- essere state toccate. costo_cent (stimato alla riserva, sul totale
  -- riservato) viene proporzionato al consumo reale, cosi un rimborso
  -- parziale non gonfia piu il costo provider riportato.
  SELECT (dettaglio->>'costo_cent')::numeric INTO v_costo_orig FROM credit_ledger WHERE id = r.ledger_id;
  UPDATE credit_ledger
  SET tipo = 'uso',
      secondi = -v_reali,
      dettaglio = dettaglio
        || jsonb_build_object('secondi_riservati', r.secondi, 'secondi_reali', v_reali)
        || p_dettaglio
        || CASE WHEN v_costo_orig IS NOT NULL AND r.secondi > 0
                THEN jsonb_build_object('costo_cent', round(v_costo_orig * v_reali / r.secondi, 2))
                ELSE '{}'::jsonb END
  WHERE id = r.ledger_id;

  RETURN QUERY SELECT true, ''::TEXT;
END $$;

CREATE OR REPLACE FUNCTION wallet_release(p_riserva_id BIGINT, p_motivo TEXT DEFAULT '')
RETURNS TABLE (ok BOOLEAN, motivo TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r wallet_riserve%ROWTYPE;
BEGIN
  SELECT * INTO r FROM wallet_riserve WHERE id = p_riserva_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT false, 'riserva inesistente'; RETURN; END IF;
  IF r.stato <> 'attiva' THEN RETURN QUERY SELECT false, 'riserva gia chiusa (' || r.stato || ')'; RETURN; END IF;

  UPDATE wallet_riserve SET stato = 'rilasciata', chiuso_il = now() WHERE id = p_riserva_id;
  -- b.163 — stessa riga, azzerata: nessun addebito (come prima), e
  -- ora sparisce ANCHE dal "consumato" di wallet_uso() (tipo
  -- 'rilascio', nessuna vista/funzione lo conta come uso).
  UPDATE credit_ledger
  SET tipo = 'rilascio', secondi = 0,
      dettaglio = dettaglio || jsonb_build_object('motivo', p_motivo)
  WHERE id = r.ledger_id;

  RETURN QUERY SELECT true, ''::TEXT;
END $$;

CREATE OR REPLACE FUNCTION wallet_rilascia_riserve_scadute()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r RECORD; n INTEGER := 0;
BEGIN
  FOR r IN SELECT * FROM wallet_riserve
    WHERE stato = 'attiva' AND created_at < now() - INTERVAL '10 minutes'
    FOR UPDATE
  LOOP
    UPDATE wallet_riserve SET stato = 'rilasciata', chiuso_il = now() WHERE id = r.id;
    UPDATE credit_ledger
    SET tipo = 'rilascio', secondi = 0,
        dettaglio = dettaglio || jsonb_build_object('motivo', 'scaduta_10min')
    WHERE id = r.ledger_id;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

-- Permessi invariati (le funzioni sono CREATE OR REPLACE sulle stesse
-- firme gia REVOKE/GRANT-ate in 010, non serve ripeterlo).
