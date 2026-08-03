# Wallet — crediti e pagamenti di BarTalk

Regole della cartella:

1. **Ogni file fa UNA cosa.** Se un file inizia a fare due cose, si divide.
2. **I numeri dei soldi stanno SOLO in `tariffe.js`.** Prezzi, costi, bonus,
   moltiplicatori: si cambiano lì e in nessun altro posto.
3. **Il saldo è la somma del registro.** Nessun contatore parallelo:
   la tabella `credit_ledger` è l'unica verità.
4. **Stripe non tocca i crediti, la contabilità non tocca Stripe.**
   Si parlano solo attraverso l'API webhook.

## I file

| File | Cosa fa | Parla con |
|------|---------|-----------|
| `tariffe.js` | Prezzi, pacchetti, costi provider, soglie batteria | nessuno (solo numeri) |
| `consumo.js` | "Hai usato X → ti scalo Y secondi" | nessuno (solo matematica) |
| `contabilita.js` | Registro movimenti, saldo, uso, storico | Supabase |
| `stripe.js` | Checkout e verifica webhook | Stripe |
| `voucher.js` | Riscatto codici promozionali | Supabase + contabilità |
| `regali.js` | Regala minuti a un amico | Supabase + contabilità |

## Il flusso dei soldi

```
utente compra  → stripe.js crea checkout → Stripe incassa
Stripe webhook → api/wallet/webhook → contabilita.registraMovimento('acquisto')
utente parla   → consumo.costoConversazione → contabilita.scalaSeDisponibile
saldo/batteria → contabilita.saldo + usoOggiEMese
voucher/regali → voucher.js / regali.js → contabilita
```

## Unità di misura

- Interna: **secondi di conversazione** (interi, mai frazioni)
- Mostrata all'utente: **minuti e ore** (`formattaDurata`)
- Voce premium ElevenLabs: consuma **3×** (vedi `MOLTIPLICATORE_PREMIUM`)

## Database

Migration: `supabase/migrations/004_wallet.sql`
- `credit_ledger` — il registro (RLS: solo service role)
- `vouchers` + `voucher_redemptions` — codici promo
- `gifts` — regali tra utenti
- Le operazioni delicate (scala credito, riscatti) sono funzioni SQL
  atomiche: `wallet_usa`, `wallet_riscatta_voucher`, `wallet_riscatta_regalo`

## Creare un voucher promozionale

```sql
INSERT INTO vouchers (codice, secondi, usi_massimi, scade_il, campagna)
VALUES ('ESTATE26', 3600, 100, '2026-09-30', 'lancio-estate');
-- = 1 ora gratis, primi 100 utenti, scade a fine settembre
```
