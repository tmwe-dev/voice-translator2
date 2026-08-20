# BarTalk nel foglio Condividi di iPhone — come si compila

*Il codice è COMPLETO (Swift + Info.plist in `BarTalkShare/`). L'unica parte
che non può fare l'AI è la firma con il tuo Apple ID in Xcode: 10 minuti, una
volta sola. Poi "Condividi → BarTalk" compare in ogni app dell'iPhone.*

## Passi (Xcode sul Mac)

1. **Xcode → File → New → Project → iOS → App.**
   - Product Name: `BarTalk` · Interface: Storyboard · Language: Swift.
   - L'app contenitore può restare vuota: serve solo a ospitare l'estensione
     (Apple non permette estensioni senza app). Facoltativo: nel suo
     ViewController apri subito `https://voice-translator2.vercel.app` in una
     `WKWebView`, così l'icona BarTalk sull'iPhone apre direttamente l'app.

2. **File → New → Target → iOS → Share Extension.**
   - Product Name: `BarTalkShare` · Activate scheme: sì.

3. **Sostituisci i due file generati** del target `BarTalkShare` con quelli di
   questa cartella:
   - `ShareViewController.swift` (sostituisce quello creato da Xcode)
   - `Info.plist` (sostituisci il contenuto del suo Info.plist)

4. **Signing & Capabilities** (per entrambi i target): seleziona il tuo Team
   (Apple ID). Basta un account gratuito per provarlo sul TUO iPhone;
   per distribuirlo serve l'account sviluppatore.

5. **Collega l'iPhone → Run.** Da quel momento: Instagram/Safari/X →
   Condividi → BarTalk → si apre "Hai condiviso" con Parlane / Spiegamelo /
   Alla Tavola (già in produzione, b.329/b.335).

## Note oneste
- Su **Android** non serve nulla di tutto questo: la PWA installata è GIÀ nel
  menu Condividi (share target nel manifest, consumato da b.329).
- L'estensione non chiede alcun accesso a Instagram/Facebook: riceve SOLO il
  contenuto che l'utente sceglie di condividere (privacy by design).
- Se il dominio dell'app cambia, aggiorna `baseURL` in ShareViewController.swift.
