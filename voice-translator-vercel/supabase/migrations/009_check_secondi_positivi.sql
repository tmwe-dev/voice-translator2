-- b.161 — CONFERMATO (quarto audit esterno, punto 10): ne vouchers.secondi
-- ne gifts.secondi avevano un CHECK a livello database. La difesa contro
-- un valore negativo o nullo viveva SOLO nel codice applicativo (le RPC
-- wallet_usa/wallet_regala validano il PROPRIO input, non cio che e gia
-- scritto in queste due tabelle; l'admin route in app/api/wallet/admin/
-- route.js scrive con un INSERT diretto, che scavalca le RPC del tutto).
--
-- Un voucher o un regalo con secondi<=0 e sempre un errore: rappresentano
-- SOLO un accredito (mai un addebito — quello vive in credit_ledger, che
-- e firmato di proposito e qui NON si tocca: 'uso'/'regalo_out' sono
-- negativi per disegno). Verificato sui dati in produzione prima di
-- applicare: vouchers.secondi e gifts.secondi sono oggi entrambi positivi
-- (3600 e 60), quindi il CHECK non rompe righe esistenti.
--
-- Questo e un secondo strato di difesa, non un sostituto della
-- validazione applicativa gia corretta in app/api/wallet/admin/route.js
-- nello stesso giro: se un domani un altro path scrivesse direttamente
-- su queste tabelle senza passare da li, il database rifiuta comunque.

ALTER TABLE vouchers ADD CONSTRAINT vouchers_secondi_positivi CHECK (secondi > 0);
ALTER TABLE gifts ADD CONSTRAINT gifts_secondi_positivi CHECK (secondi > 0);
