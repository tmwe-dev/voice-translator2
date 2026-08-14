-- ═══════════════════════════════════════════════════════════════
-- 006_wallet_security_fix.sql — b.154, chiusura falla CRITICA
--
-- APPLICATA GIA' in produzione (Supabase MCP, 14/8) perche il buco
-- era attivo ORA, non solo nel codice: il Security Advisor di
-- Supabase confermava le 6 funzioni wallet_* chiamabili da anon E
-- authenticated via /rest/v1/rpc/..., e wallet_usa non controllava
-- che p_secondi fosse positivo — un p_secondi negativo passa il
-- controllo `saldo < p_secondi` (quasi sempre vero se negativo) e
-- l'INSERT scrive -p_secondi, cioe un accredito. Combinati: chiunque,
-- senza login, poteva potenzialmente accreditarsi credito dal nulla
-- chiamando la RPC pubblica con un numero negativo.
--
-- Verificato dal vivo dopo l'applicazione:
--   · Security Advisor: i warning anon/authenticated su wallet_* sono
--     spariti (restano solo gli INFO "RLS enabled no policy", che
--     sono corretti: nessuno tranne service_role tocca quelle tabelle).
--   · `select wallet_usa('x', -5000, '{}')` ora solleva
--     "p_secondi deve essere positivo" invece di accreditare.
--
-- Questo file esiste per tenere il repository allineato al database
-- reale: se il progetto Supabase viene ricreato da zero, applicare
-- le migration in ordine (001→006) la porta allo stesso stato.
-- ═══════════════════════════════════════════════════════════════

-- 1) wallet_usa: rifiuta importi non positivi e assurdi
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
  IF v_saldo < p_secondi THEN RETURN false; END IF;
  INSERT INTO credit_ledger (user_id, tipo, secondi, dettaglio)
  VALUES (p_user_id, 'uso', -p_secondi, p_dettaglio);
  RETURN true;
END $$;

-- 2) search_path fisso su tutte le funzioni SECURITY DEFINER (difesa
--    in profondita contro dirottamento dello schema di ricerca)
ALTER FUNCTION wallet_saldo(TEXT) SET search_path = public, pg_temp;
ALTER FUNCTION wallet_uso(TEXT) SET search_path = public, pg_temp;
ALTER FUNCTION wallet_riscatta_voucher(TEXT, TEXT) SET search_path = public, pg_temp;
ALTER FUNCTION wallet_riscatta_regalo(TEXT, TEXT) SET search_path = public, pg_temp;
ALTER FUNCTION wallet_rimborsa_regali() SET search_path = public, pg_temp;

-- 3) Nessuna di queste deve essere chiamabile da anon o da un utente
--    autenticato qualsiasi: solo il server (service_role) le usa,
--    sempre passando dal proprio userToken/sessione gia verificati.
REVOKE EXECUTE ON FUNCTION wallet_saldo(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION wallet_uso(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION wallet_usa(TEXT, INTEGER, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION wallet_riscatta_voucher(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION wallet_riscatta_regalo(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION wallet_rimborsa_regali() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION wallet_saldo(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION wallet_uso(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION wallet_usa(TEXT, INTEGER, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION wallet_riscatta_voucher(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION wallet_riscatta_regalo(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION wallet_rimborsa_regali() TO service_role;

-- 4) Le tre viste economiche (wallet_economics, wallet_totali,
--    wallet_per_utente) segnalate dall'Advisor come SECURITY DEFINER:
--    dati economici aggregati (incassi, saldo in circolo, costi
--    provider) non devono essere leggibili da anon/authenticated.
REVOKE ALL ON wallet_economics FROM PUBLIC, anon, authenticated;
REVOKE ALL ON wallet_totali FROM PUBLIC, anon, authenticated;
REVOKE ALL ON wallet_per_utente FROM PUBLIC, anon, authenticated;
GRANT SELECT ON wallet_economics TO service_role;
GRANT SELECT ON wallet_totali TO service_role;
GRANT SELECT ON wallet_per_utente TO service_role;
