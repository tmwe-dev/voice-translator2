-- ═══════════════════════════════════════════════════════════════
-- 016 — IL REGISTRO LO SCRIVE SOLO IL SERVIZIO (b.630)
--
-- La 015 aveva lasciato la porta aperta, e l'ha trovata il secondo
-- revisore. `segna_visita_rotta` e SECURITY DEFINER: scavalca la RLS per
-- costruzione. E in PostgreSQL l'EXECUTE su una funzione nuova e
-- concesso a PUBLIC per default, che `anon` eredita. Risultato: chiunque,
-- con la chiave pubblica che sta nel bundle del browser, poteva
-- scrivere righe a piacere nel registro.
--
-- Non e un danno ai dati di prodotto — dentro non c'e niente di nessuno.
-- E peggio in un altro senso: avvelena la MISURA con cui il 3 dicembre
-- si decidera cosa togliere. Si poteva far sembrare viva una rotta morta,
-- o sommergere di rumore il segnale di una viva.
--
-- In questo stesso repository la convenzione esisteva gia (003, 008,
-- 013): ogni funzione SECURITY DEFINER viene revocata a public e anon.
-- Qui era stata dimenticata.
--
-- Aggiunto anche pg_temp al search_path, e un tetto di 200 caratteri sul
-- nome della rotta: le rotte vere sono corte, e una chiave lunga a
-- piacere e solo un modo di gonfiare la tabella.
--
-- COME SI TORNA INDIETRO: e una restrizione, non una funzione nuova.
-- Per riaprire basterebbe un GRANT — ma non c'e ragione di farlo.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION segna_visita_rotta(p_rotta text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO rotte_visite AS r (rotta, visite)
  VALUES (left(p_rotta, 200), 1)
  ON CONFLICT (rotta) DO UPDATE
    SET visite = r.visite + 1,
        ultima_visita = now();
$$;

REVOKE EXECUTE ON FUNCTION segna_visita_rotta(text) FROM public, anon, authenticated;
REVOKE ALL ON public.rotte_visite FROM anon, authenticated;
