-- ═══════════════════════════════════════════════════════════════
-- b.364 — LA TOLLERANZA: si puo andare sotto zero, entro un limite.
--
-- Ordine di Luca, e il modello e quello delle schede telefoniche:
--   «carichi dieci euro, poi se vai oltre fino a due euro ti e
--    permesso, e alla ricarica successiva di dieci parti da otto. In
--    questo modo non perdi mai, a meno che l'utente non smetta di
--    caricare.»
--
-- PERCHE' QUESTO MODELLO E' MIGLIORE DI UNO A SCAGLIONI. Il recupero
-- non si programma: SI FA DA SOLO. Questo registro e una somma di
-- righe — saldo -1800, arriva un acquisto di +10800, il saldo diventa
-- 9000. Nessun codice di riscossione, nessuno da rincorrere, nessuno
-- stato in piu da tenere. Il debito e gia dentro la somma.
--
-- E l'unico caso in cui ci perdiamo e chi non ricarica mai piu: e li
-- che serve il secondo pezzo, sotto.
--
-- LA TOLLERANZA E' UNA PROPRIETA' DELLA SCHEDA CARICATA. Una scheda
-- telefonica mai ricaricata non va in rosso: non c'e niente da
-- recuperare alla ricarica dopo, perche una ricarica dopo non c'e mai
-- stata. Quindi chi non ha MAI ricaricato ha tolleranza ZERO — non e
-- una punizione, ha i suoi trenta minuti di benvenuto che fanno
-- esattamente lo stesso lavoro. Ed e anche l'unica difesa che serve
-- contro gli account usa-e-getta: senza questa riga, chiunque si
-- iscrive prende mezz'ora di benvenuto PIU' mezz'ora di rosso, sparisce
-- e si iscrive di nuovo.
--
-- QUANTO. Trenta minuti, la stessa misura del benvenuto — cosi c'e un
-- numero solo da ricordare in tutto il portafoglio. Sul pacchetto piu
-- piccolo (tre ore) e circa un sesto: le stesse proporzioni dei due
-- euro su dieci dell'esempio. E' quanto basta per finire qualunque
-- conversazione, chiamata o diretta cominciata.
--
-- DOVE VIVE IL NUMERO. Qui dentro, in una funzione sola, che e la
-- stessa che leggono sia il database sia il telefono. Scriverlo anche
-- nel codice JavaScript vorrebbe dire due posti che possono
-- disallinearsi, e il giorno che si disallineano il portafoglio dice
-- una cosa e ne fa un'altra.
-- ═══════════════════════════════════════════════════════════════

-- 1) IL NUMERO, in un posto solo.
CREATE OR REPLACE FUNCTION wallet_tolleranza(p_user_id TEXT)
RETURNS INTEGER LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  -- Solo chi ha gia ricaricato almeno una volta: vedi sopra.
  IF EXISTS (
    SELECT 1 FROM credit_ledger
    WHERE user_id = p_user_id AND tipo = 'acquisto'
  ) THEN
    RETURN 1800;  -- 30 minuti
  END IF;
  RETURN 0;
END $$;

-- 2) QUANTO SI PUO' ANCORA SPENDERE = saldo + tolleranza.
-- Serve al telefono e ai controlli prima di chiamare un fornitore, in
-- un giro solo invece di due.
CREATE OR REPLACE FUNCTION wallet_spendibile(p_user_id TEXT)
RETURNS INTEGER LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE v_saldo INTEGER;
BEGIN
  SELECT COALESCE(SUM(secondi), 0) INTO v_saldo FROM credit_ledger WHERE user_id = p_user_id;
  RETURN v_saldo + wallet_tolleranza(p_user_id);
END $$;

-- 3) L'USO — identico a prima, cambia SOLO la riga che diceva "no".
-- Prima: si rifiutava appena il saldo non copriva. Ora si rifiuta solo
-- quando l'uso porterebbe il saldo OLTRE la tolleranza.
CREATE OR REPLACE FUNCTION wallet_usa(p_user_id TEXT, p_secondi INTEGER, p_dettaglio JSONB DEFAULT '{}')
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_saldo INTEGER;
BEGIN
  IF p_secondi IS NULL OR p_secondi <= 0 THEN
    RAISE EXCEPTION 'p_secondi deve essere positivo';
  END IF;
  IF p_secondi > 100000 THEN
    RAISE EXCEPTION 'p_secondi supera il limite massimo per singolo uso';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id));
  SELECT COALESCE(SUM(secondi), 0) INTO v_saldo FROM credit_ledger WHERE user_id = p_user_id;
  -- b.364 — il pavimento non e piu zero: e meno la tolleranza.
  IF v_saldo - p_secondi < -wallet_tolleranza(p_user_id) THEN RETURN false; END IF;
  INSERT INTO credit_ledger (user_id, tipo, secondi, dettaglio)
  VALUES (p_user_id, 'uso', -p_secondi, p_dettaglio);
  RETURN true;
END $$;

-- 4) LA RISERVA — stesso identico cambio.
-- E qui la tolleranza fa la cosa che ci eravamo detti: NON SI SBARRA
-- L'INGRESSO. Chi ha poco credito riesce comunque a entrare in una
-- diretta, e siccome la riserva blocca subito quello che servira, e
-- garantito che la finisce senza fermarsi a meta.
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

  PERFORM pg_advisory_xact_lock(hashtext(p_user_id));
  SELECT COALESCE(SUM(secondi), 0) INTO v_saldo FROM credit_ledger WHERE user_id = p_user_id;
  -- b.364 — vedi wallet_usa.
  IF v_saldo - p_secondi < -wallet_tolleranza(p_user_id) THEN
    RETURN QUERY SELECT false, NULL::BIGINT, 'saldo insufficiente'; RETURN;
  END IF;

  INSERT INTO wallet_riserve (user_id, secondi, dettaglio) VALUES (p_user_id, p_secondi, p_dettaglio) RETURNING id INTO v_id;
  INSERT INTO credit_ledger (user_id, tipo, secondi, dettaglio)
  VALUES (p_user_id, 'riserva', -p_secondi, jsonb_build_object('riserva_id', v_id) || p_dettaglio);

  RETURN QUERY SELECT true, v_id, ''::TEXT;
END $$;

-- 5) I permessi, con la stessa regola di sempre: solo il server.
REVOKE EXECUTE ON FUNCTION wallet_tolleranza(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION wallet_spendibile(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION wallet_tolleranza(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION wallet_spendibile(TEXT) TO service_role;
