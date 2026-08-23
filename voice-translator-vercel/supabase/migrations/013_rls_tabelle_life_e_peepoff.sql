-- ═══════════════════════════════════════════════════════════════
-- 013 — LA PORTA LATERALE DEL DATABASE (b.408)
--
-- APPLICATA IN PRODUZIONE il 23/08/2026 e verificata subito dopo.
-- Questo file e la copia per il repository: la migrazione e gia
-- passata sul progetto `voicetranslate`.
--
-- Trovato da un audit esterno e VERIFICATO sul database vivo prima di
-- toccare qualunque cosa: otto tabelle dello schema pubblico avevano
-- RLS spenta, zero politiche, e i ruoli `anon` e `authenticated` con
-- SELECT e INSERT diretti.
--
-- La chiave anon sta nel browser, come in qualunque applicazione
-- Supabase. Quindi c'era questo:
--
--   Internet -> REST di Supabase -> chiave anon -> tabella senza RLS
--
-- cioe una strada che scavalca del tutto la nostra:
--
--   browser -> API BarTalk -> getSession() -> service role -> database
--
-- Dentro quelle tabelle: compiti e materiali dello studente, scansioni,
-- corsi personali, profilo studente, errori di pronuncia, e i
-- dispositivi PeepOff con le loro chiavi pubbliche e la presenza.
-- L'API di PeepOff era stata scritta bene apposta per non far uscire
-- niente: il portone era chiuso e la finestra sul retro aperta.
--
-- LA CURA E' QUELLA CHE IL DATABASE USA GIA. Le altre venti tabelle
-- pubbliche di questo progetto hanno RLS accesa e ZERO politiche: con
-- PostgREST vuol dire che anon e authenticated non leggono e non
-- scrivono niente, mentre il service role (che salta RLS) continua a
-- lavorare. Non si e inventata nessuna politica nuova: a queste otto e
-- stata messa la stessa serratura delle altre venti, piu la revoca dei
-- permessi diretti — come ha gia `wallet_riserve`, che era l'unica
-- fatta per bene.
--
-- RAGGIO VERIFICATO PRIMA, non dopo: tutte e otto le tabelle sono
-- toccate solo da codice di server che usa `getSupabaseAdmin()`
-- (app/lib/compagni/compiti.js, app/lib/compagni/corsi/biblioteca.js,
-- app/api/peepoff/route.js). Nel browser `getSupabaseClient()` esiste
-- ma lo usano solo useRealtimeRoom e useWebRTC, per i canali realtime:
-- nessun `.from()` su queste tabelle in tutto il client. La guardia che
-- lo tiene vero nel tempo sta in __tests__/rls-porta-laterale-b408.test.js.
--
-- PROVA DOPO L'APPLICAZIONE (interrogando il database vivo):
--   otto tabelle: rls = true, anon SELECT/INSERT = false,
--                 authenticated SELECT = false, service_role legge
--   security advisor Supabase: zero ERROR, zero WARN
--   (restano solo INFO «RLS enabled, no policy», che e il disegno voluto)
--
-- COME SI TORNA INDIETRO, se mai servisse (una riga per tabella):
--   ALTER TABLE public.<tabella> DISABLE ROW LEVEL SECURITY;
--   GRANT SELECT, INSERT, UPDATE, DELETE ON public.<tabella> TO anon, authenticated;
-- ═══════════════════════════════════════════════════════════════

-- ── 1. La serratura, uguale a quella delle altre venti ──
ALTER TABLE public.compiti_jobs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compiti_materiali    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compiti_scansioni    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corsi_utente         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peepoff_dispositivi  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peepoff_segnali      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profilo_studente     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pronuncia_profilo    ENABLE ROW LEVEL SECURITY;

-- ── 2. E via anche i permessi diretti: due chiusure, non una ──
-- RLS da sola basterebbe, ma un permesso che non serve a nessuno e
-- solo una cosa che un domani puo tornare a contare.
REVOKE ALL ON public.compiti_jobs        FROM anon, authenticated;
REVOKE ALL ON public.compiti_materiali   FROM anon, authenticated;
REVOKE ALL ON public.compiti_scansioni   FROM anon, authenticated;
REVOKE ALL ON public.corsi_utente        FROM anon, authenticated;
REVOKE ALL ON public.peepoff_dispositivi FROM anon, authenticated;
REVOKE ALL ON public.peepoff_segnali     FROM anon, authenticated;
REVOKE ALL ON public.profilo_studente    FROM anon, authenticated;
REVOKE ALL ON public.pronuncia_profilo   FROM anon, authenticated;

-- ── 3. P1 dello stesso audit: le tre funzioni privilegiate di Mondo ──
-- `mondo_conta_vista`, `mondo_dopo_commento` e `mondo_ricalcola_like`
-- sono SECURITY DEFINER (girano coi permessi del proprietario) e
-- avevano EXECUTE per anon e authenticated. Non fanno uscire contenuti
-- privati: contano viste, commenti e mi-piace. Ma chiunque poteva
-- chiamarle e gonfiare quei numeri, e i numeri di Mondo sono
-- esattamente cio che decide che cosa la gente vede.
-- Le chiama solo `app/lib/mondoDB.js`, che usa il service role.
REVOKE EXECUTE ON FUNCTION public.mondo_conta_vista(uuid)            FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.mondo_dopo_commento(uuid, uuid)    FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.mondo_ricalcola_like(uuid)         FROM anon, authenticated, public;

-- E gli si mette lo stesso percorso di ricerca blindato che hanno gia
-- tutte le funzioni del portafoglio: con `pg_temp` in coda, una tabella
-- temporanea creata da un chiamante non puo mettersi davanti a una vera.
ALTER FUNCTION public.mondo_conta_vista(uuid)         SET search_path = public, pg_temp;
ALTER FUNCTION public.mondo_dopo_commento(uuid, uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.mondo_ricalcola_like(uuid)      SET search_path = public, pg_temp;
