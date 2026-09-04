-- ═══════════════════════════════════════════════════════════════
-- 015 — IL REGISTRO DELLE VISITE ALLE ROTTE (b.628)
--
-- PERCHE ESISTE. L'audit della b.627 si e chiuso con una domanda che
-- non si poteva rispondere: QUALI DELLE 84 ROTTE non serve piu a
-- nessuno? Il codice dice solo chi PUO essere chiamato; per sapere chi
-- VIENE chiamato serve il traffico vero. E il traffico vero, su Vercel,
-- lo si perde: i registri normali durano un giorno, e una rotta che
-- lavora una volta al mese in un giorno non si vede.
--
-- Sulle finestre corte il Protocollo Bonifica e categorico: «due
-- settimane dichiarano morto tutto cio che vive a trimestre». Quindi
-- non si guarda meglio: si tiene il conto in un posto che non
-- dimentica. Una riga per rotta, il primo e l'ultimo passaggio, e
-- quante volte.
--
-- COSA NON E. Non e un registro di chi naviga: non ci finisce nessun
-- utente, nessun indirizzo IP, nessun contenuto. Solo il nome della
-- rotta e tre numeri. Non serve a misurare le persone, serve a sapere
-- quali porte sono ancora usate prima di murarle.
--
-- COME SI TORNA INDIETRO: `DROP TABLE rotte_visite;` piu
-- `DROP FUNCTION segna_visita_rotta;`. Non ci sono dati di prodotto
-- dentro: si perde solo l'osservazione, e si ricomincia a contare.
-- Nessuna tabella esistente viene toccata.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS rotte_visite (
  rotta          text PRIMARY KEY,
  visite         bigint      NOT NULL DEFAULT 0,
  prima_visita   timestamptz NOT NULL DEFAULT now(),
  ultima_visita  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE rotte_visite IS
  'b.628 — quante volte ogni rotta API e stata chiamata davvero. Nessun dato di persona: solo il nome della rotta. Serve a decidere cosa e ancora vivo prima di togliere.';

-- Il conteggio si fa in una sola andata, atomica: due richieste
-- contemporanee sulla stessa rotta non si sovrascrivono a vicenda.
CREATE OR REPLACE FUNCTION segna_visita_rotta(p_rotta text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO rotte_visite AS r (rotta, visite)
  VALUES (p_rotta, 1)
  ON CONFLICT (rotta) DO UPDATE
    SET visite = r.visite + 1,
        ultima_visita = now();
$$;

COMMENT ON FUNCTION segna_visita_rotta(text) IS
  'b.628 — segna un passaggio su una rotta. Atomica: due chiamate insieme contano due.';

-- La tabella la scrive solo il servizio (chiave di servizio, che salta
-- le regole di riga). Nessun accesso dal browser: non c'e niente da
-- leggere per un utente, e niente che un utente debba poter scrivere.
ALTER TABLE rotte_visite ENABLE ROW LEVEL SECURITY;
