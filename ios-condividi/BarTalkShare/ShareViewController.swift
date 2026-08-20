//
//  ShareViewController.swift — BarTalk Share Extension (b.335)
//
//  Fa comparire BarTalk nel foglio Condividi di iPhone/iPad.
//  Riceve URL o testo da qualunque app (Instagram, Safari, X, Note…),
//  costruisce l'indirizzo che la web-app gia consuma
//  (/?source=share&title&text&url — vedi CondivisoSheet, b.329)
//  e lo apre. Nessun account social richiesto: arriva SOLO il contenuto
//  che l'utente ha scelto di condividere.
//
import UIKit
import Social
import UniformTypeIdentifiers

class ShareViewController: UIViewController {

    // L'origine della web-app. Cambiala qui se un giorno cambia dominio.
    private let baseURL = "https://voice-translator2.vercel.app"

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        estraiEApri()
    }

    private func estraiEApri() {
        guard let item = (extensionContext?.inputItems.first as? NSExtensionItem),
              let attachments = item.attachments, !attachments.isEmpty else {
            chiudi(); return
        }
        let titolo = item.attributedContentText?.string ?? ""

        // Prima scelta: un URL vero. Seconda: testo semplice (spesso contiene il link).
        if let provider = attachments.first(where: { $0.hasItemConformingToTypeIdentifier(UTType.url.identifier) }) {
            provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] (dato, _) in
                let url = (dato as? URL)?.absoluteString ?? ""
                self?.apriBarTalk(titolo: titolo, testo: "", url: url)
            }
            return
        }
        if let provider = attachments.first(where: { $0.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) }) {
            provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { [weak self] (dato, _) in
                let testo = (dato as? String) ?? ""
                self?.apriBarTalk(titolo: titolo, testo: testo, url: "")
            }
            return
        }
        chiudi()
    }

    private func apriBarTalk(titolo: String, testo: String, url: String) {
        var comp = URLComponents(string: baseURL)!
        comp.queryItems = [
            URLQueryItem(name: "source", value: "share"),
            URLQueryItem(name: "title", value: String(titolo.prefix(200))),
            URLQueryItem(name: "text", value: String(testo.prefix(500))),
            URLQueryItem(name: "url", value: String(url.prefix(500))),
        ]
        guard let destinazione = comp.url else { chiudi(); return }

        // Le estensioni non possono chiamare UIApplication.shared: si risale
        // la catena dei responder — la via standard per aprire un URL da qui.
        DispatchQueue.main.async { [weak self] in
            var responder: UIResponder? = self
            while let r = responder {
                if let app = r as? UIApplication {
                    app.open(destinazione, options: [:], completionHandler: nil)
                    break
                }
                if r.responds(to: Selector(("openURL:"))) {
                    r.perform(Selector(("openURL:")), with: destinazione)
                    break
                }
                responder = r.next
            }
            self?.chiudi()
        }
    }

    private func chiudi() {
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }
}
