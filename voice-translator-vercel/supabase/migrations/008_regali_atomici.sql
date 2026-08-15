-- ═══════════════════════════════════════════════════════════════
-- 008_regali_atomici.sql — Regali e voucher, atomici davvero
--
-- b.157 — audit pagamenti (Luca, 14/8): "atomicità voucher/regali
-- completa" era ancora aperto. CONFERMATO leggendo il codice:
--
-- 1. inviaRegalo (app/wallet/regali.js) faceva TRE passi separati,
--    non transazionali: leggeva il saldo (saldo()), inseriva la riga
--    in `gifts`, POI scalava il credito (registraMovimento()). Due
--    invii concorrenti dello stesso utente potevano leggere lo STESSO
--    saldo di partenza, passare entrambi il controllo, e portare il
--    wallet sotto zero — la stessa classe di corsa critica che
--    wallet_usa (004_wallet.sql) chiude da tempo con un lock
--    (pg_advisory_xact_lock) per l'uso normale, ma che qui non
--    esisteva affatto. Se il terzo passo falliva DOPO il secondo, il
--    codice regalo restava valido e riscattabile senza che il
--    mittente fosse mai stato addebitato.
--
-- 2. riscattaRegalo e riscattaVoucher marcavano il regalo/voucher
--    come "usato" con una funzione SQL atomica (corretto), ma la riga
--    nel registro (`registraMovimento`, +secondi) veniva scritta DOPO,
--    con una seconda chiamata separata. Un guasto proprio in mezzo
--    lasciava il codice segnato come riscattato ma il beneficiario
--    MAI accreditato — secondi persi, non duplicati, ma persi.
--
-- Qui: una nuova funzione atomica per l'invio (blocco+verifica+
-- scrittura in un colpo solo, come wallet_usa), e le due funzioni di
-- riscatto estese per scrivere la riga di registro nella STESSA
-- transazione della funzione, non in una seconda chiamata da JS.
-- ═══════════════════════════════════════════════════════════════

-- ── Invio regalo: blocco, verifica saldo, crea il regalo, scala — un colpo solo ──
CREATE OR REPLACE FUNCTION wallet_regala(p_user_id TEXT, p_secondi INTEGER, p_codice TEXT, p_messaggio TEXT DEFAULT '')
RETURNS TABLE (ok BOOLEAN, motivo TEXT) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_saldo INTEGER;
BEGIN
  IF p_secondi IS NULL OR p_secondi < 60 THEN
    RETURN QUERY SELECT false, 'Minimo 1 minuto'; RETURN;
  END IF;
  IF p_secondi > 100000 THEN
    RETURN QUERY SELECT false, 'Regalo troppo grande'; RETURN;
  END IF;

  -- Stesso lock di wallet_usa: due invii dello stesso utente, anche
  -- simultanei, non possono piu leggere lo stesso saldo di partenza.
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id));
  SELECT COALESCE(SUM(secondi), 0) INTO v_saldo FROM credit_ledger WHERE user_id = p_user_id;
  IF v_saldo < p_secondi THEN
    RETURN QUERY SELECT false, 'Credito insufficiente'; RETURN;
  END IF;

  INSERT INTO gifts (codice, da_user_id, secondi, messaggio)
  VALUES (p_codice, p_user_id, p_secondi, p_messaggio);

  INSERT INTO credit_ledger (user_id, tipo, secondi, dettaglio)
  VALUES (p_user_id, 'regalo_out', -p_secondi, jsonb_build_object('codice', p_codice));

  RETURN QUERY SELECT true, ''::TEXT;
END $$;

REVOKE EXECUTE ON FUNCTION wallet_regala(TEXT, INTEGER, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION wallet_regala(TEXT, INTEGER, TEXT, TEXT) TO service_role;

-- ── Riscatto regalo: marca E accredita, nella stessa transazione ──
CREATE OR REPLACE FUNCTION wallet_riscatta_regalo(p_user_id TEXT, p_codice TEXT)
RETURNS TABLE (ok BOOLEAN, secondi INTEGER, motivo TEXT) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE g gifts%ROWTYPE;
BEGIN
  SELECT * INTO g FROM gifts WHERE codice = p_codice FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT false, 0, 'Regalo inesistente'; RETURN; END IF;
  IF g.riscattato_il IS NOT NULL THEN RETURN QUERY SELECT false, 0, 'Già riscattato'; RETURN; END IF;
  IF g.rimborsato THEN RETURN QUERY SELECT false, 0, 'Regalo scaduto'; RETURN; END IF;
  IF g.da_user_id = p_user_id THEN RETURN QUERY SELECT false, 0, 'Non puoi riscattare il tuo regalo'; RETURN; END IF;
  UPDATE gifts SET a_user_id = p_user_id, riscattato_il = now() WHERE codice = p_codice;
  INSERT INTO credit_ledger (user_id, tipo, secondi, dettaglio)
  VALUES (p_user_id, 'regalo_in', g.secondi, jsonb_build_object('codice', p_codice));
  RETURN QUERY SELECT true, g.secondi, ''::TEXT;
END $$;

-- ── Riscatto voucher: marca E accredita, nella stessa transazione ──
CREATE OR REPLACE FUNCTION wallet_riscatta_voucher(p_user_id TEXT, p_codice TEXT)
RETURNS TABLE (ok BOOLEAN, secondi INTEGER, motivo TEXT) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v vouchers%ROWTYPE;
BEGIN
  SELECT * INTO v FROM vouchers WHERE codice = p_codice FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT false, 0, 'Codice inesistente'; RETURN; END IF;
  IF v.scade_il IS NOT NULL AND v.scade_il < now() THEN RETURN QUERY SELECT false, 0, 'Codice scaduto'; RETURN; END IF;
  IF v.usi_fatti >= v.usi_massimi THEN RETURN QUERY SELECT false, 0, 'Codice esaurito'; RETURN; END IF;
  IF EXISTS (SELECT 1 FROM voucher_redemptions WHERE codice = p_codice AND user_id = p_user_id) THEN
    RETURN QUERY SELECT false, 0, 'Già usato da te'; RETURN;
  END IF;
  UPDATE vouchers SET usi_fatti = usi_fatti + 1 WHERE codice = p_codice;
  INSERT INTO voucher_redemptions (codice, user_id) VALUES (p_codice, p_user_id);
  INSERT INTO credit_ledger (user_id, tipo, secondi, dettaglio)
  VALUES (p_user_id, 'voucher', v.secondi, jsonb_build_object('codice', p_codice));
  RETURN QUERY SELECT true, v.secondi, ''::TEXT;
END $$;
