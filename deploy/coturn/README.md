# Il ponte di BarTalk — coturn su Oracle Always Free

Serve quando due telefoni non riescono a vedersi direttamente (doppia
rete mobile). Software libero, macchina gratuita: canone zero.

## La parte di Luca (una volta sola, ~15 minuti)
1. Account su oracle.com/cloud → istanza **Always Free** Ubuntu
   (Ampere A1 o AMD micro), regione europea.
2. Nella **Security List** della rete aprire: 3478 UDP+TCP, 5349 TCP,
   49160–49260 UDP.
3. Copiare su quella macchina la cartella `deploy/coturn` e lanciare:
   `sudo bash setup.sh IP_PUBBLICO_DELLA_VM`
4. Copiare le due variabili che lo script stampa dentro Vercel
   (Production) e dirlo in chat: al rilascio successivo i telefoni
   ricevono il ponte da /api/turn, con credenziali che scadono da sole.

## Verifica
Chiamata iPhone ↔ Android su reti diverse → menu ••• → Rapporto tecnico
chiamata → deve dire `strada: relay`.

## Poi (facoltativo, consigliato)
Dominio `turn.bartalk.app` → certbot sulla VM → scommentare le due righe
TLS in turnserver.conf → aggiungere `turns:turn.bartalk.app:5349` a
TURN_URLS. Il TLS fa passare il ponte anche nelle reti che bloccano
tutto tranne il traffico cifrato.
