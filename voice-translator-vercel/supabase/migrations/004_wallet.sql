-- ═══════════════════════════════════════════════════════════════
-- 004_wallet.sql — Registro crediti, voucher, regali
-- Regola d'oro: il saldo è la SOMMA delle righe di credit_ledger.
-- ═══════════════════════════════════════════════════════════════

-- ── Il registro: una riga per ogni movimento ──
CREATE TABLE IF NOT EXISTS credit_ledger (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('acquisto','benvenuto','voucher','regalo_in','regalo_out','uso','rimborso')),
  secondi INTEGER NOT NULL,            -- positivo = accredito, negativo = addebito
  dettaglio JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ledger_user ON credit_ledger (user_id, created_at DESC);

-- ── Voucher promozionali (li crei tu) ──
CREATE TABLE IF NOT EXISTS vouchers (
  codice TEXT PRIMARY KEY,
  secondi INTEGER NOT NULL,
  usi_massimi INTEGER NOT NULL DEFAULT 1,
  usi_fatti INTEGER NOT NULL DEFAULT 0,
  scade_il TIMESTAMPTZ,
  campagna TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Chi ha usato quale voucher (per bloccare il doppio riscatto)
CREATE TABLE IF NOT EXISTS voucher_redemptions (
  codice TEXT REFERENCES vouchers(codice),
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (codice, user_id)
);

-- ── Regali tra utenti ──
CREATE TABLE IF NOT EXISTS gifts (
  codice TEXT PRIMARY KEY,
  da_user_id TEXT NOT NULL,
  a_user_id TEXT,                      -- si riempie al riscatto
  secondi INTEGER NOT NULL,
  messaggio TEXT DEFAULT '',
  riscattato_il TIMESTAMPTZ,
  rimborsato BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── RLS: solo il server (service role) tocca queste tabelle ──
ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE voucher_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gifts ENABLE ROW LEVEL SECURITY;

-- ═══ FUNZIONI: i punti delicati sono atomici qui dentro ═══

-- Saldo = somma delle righe
CREATE OR REPLACE FUNCTION wallet_saldo(p_user_id TEXT)
RETURNS INTEGER LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COALESCE(SUM(secondi), 0)::INTEGER FROM credit_ledger WHERE user_id = p_user_id;
$$;

-- Uso di oggi e del mese (in positivo)
CREATE OR REPLACE FUNCTION wallet_uso(p_user_id TEXT)
RETURNS TABLE (oggi INTEGER, mese INTEGER) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    COALESCE(SUM(CASE WHEN created_at >= date_trunc('day', now()) THEN -secondi END), 0)::INTEGER,
    COALESCE(SUM(CASE WHEN created_at >= date_trunc('month', now()) THEN -secondi END), 0)::INTEGER
  FROM credit_ledger
  WHERE user_id = p_user_id AND secondi < 0;
$$;

-- Scala il credito SOLO se il saldo basta (controllo+scrittura atomici)
CREATE OR REPLACE FUNCTION wallet_usa(p_user_id TEXT, p_secondi INTEGER, p_dettaglio JSONB DEFAULT '{}')
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_saldo INTEGER;
BEGIN
  -- Blocca le righe dell'utente per evitare due usi simultanei
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id));
  SELECT COALESCE(SUM(secondi), 0) INTO v_saldo FROM credit_ledger WHERE user_id = p_user_id;
  IF v_saldo < p_secondi THEN RETURN false; END IF;
  INSERT INTO credit_ledger (user_id, tipo, secondi, dettaglio)
  VALUES (p_user_id, 'uso', -p_secondi, p_dettaglio);
  RETURN true;
END $$;

-- Riscatta un voucher (verifiche + conteggio in un colpo solo)
CREATE OR REPLACE FUNCTION wallet_riscatta_voucher(p_user_id TEXT, p_codice TEXT)
RETURNS TABLE (ok BOOLEAN, secondi INTEGER, motivo TEXT) LANGUAGE plpgsql SECURITY DEFINER AS $$
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
  RETURN QUERY SELECT true, v.secondi, ''::TEXT;
END $$;

-- Riscatta un regalo (una volta sola, non chi l'ha creato)
CREATE OR REPLACE FUNCTION wallet_riscatta_regalo(p_user_id TEXT, p_codice TEXT)
RETURNS TABLE (ok BOOLEAN, secondi INTEGER, motivo TEXT) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE g gifts%ROWTYPE;
BEGIN
  SELECT * INTO g FROM gifts WHERE codice = p_codice FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT false, 0, 'Regalo inesistente'; RETURN; END IF;
  IF g.riscattato_il IS NOT NULL THEN RETURN QUERY SELECT false, 0, 'Già riscattato'; RETURN; END IF;
  IF g.rimborsato THEN RETURN QUERY SELECT false, 0, 'Regalo scaduto'; RETURN; END IF;
  IF g.da_user_id = p_user_id THEN RETURN QUERY SELECT false, 0, 'Non puoi riscattare il tuo regalo'; RETURN; END IF;
  UPDATE gifts SET a_user_id = p_user_id, riscattato_il = now() WHERE codice = p_codice;
  RETURN QUERY SELECT true, g.secondi, ''::TEXT;
END $$;

-- Rimborsa i regali non riscattati dopo 30 giorni (da chiamare con un cron)
CREATE OR REPLACE FUNCTION wallet_rimborsa_regali()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE g RECORD; n INTEGER := 0;
BEGIN
  FOR g IN SELECT * FROM gifts
    WHERE riscattato_il IS NULL AND rimborsato = false AND created_at < now() - INTERVAL '30 days'
    FOR UPDATE
  LOOP
    UPDATE gifts SET rimborsato = true WHERE codice = g.codice;
    INSERT INTO credit_ledger (user_id, tipo, secondi, dettaglio)
    VALUES (g.da_user_id, 'rimborso', g.secondi, jsonb_build_object('codice', g.codice));
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
