// ═══════════════════════════════════════════════════════════════
// LA PAGINA CHE IL QR CERCAVA E NON TROVAVA (b.124)
//
// TaxiQRView genera questo indirizzo (TaxiQRView.js:83):
//
//     `${window.location.origin}/taxi/${id}#k=${key}`
//
// e useInitializeApp e pronto a leggerlo (useInitializeApp.js:190):
//
//     window.location.pathname.match(/^\/taxi\/([a-z0-9]+)$/i)
//
// Le due meta si aspettavano da anni, e non si sono mai incontrate:
// in mezzo mancava la rotta. Next non instradava `/taxi/QUALCOSA` da
// nessuna parte, quindi il tassista che inquadrava il QR riceveva una
// pagina 404 e il codice che sa leggere quell'indirizzo non partiva
// nemmeno.
//
// La destinazione, la cifratura, la chiave nel frammento: tutto
// corretto e tutto inutile, perche la porta d'ingresso non esisteva.
//
// ── PERCHE UNA ROTTA VERA E NON UNA REWRITE ──
//
// Si poteva far comparire una regola in next.config che riscrive
// `/taxi/:id` verso `/`. Avrebbe funzionato, e sarebbe stata invisibile:
// chi legge l'albero delle pagine non trova niente, e chi legge il QR
// continua a non capire dove atterra. Una rotta vera si vede.
//
// ── LA CHIAVE RESTA FUORI DAL SERVER ──
//
// L'indirizzo porta la chiave dopo il cancelletto: `#k=...`. Il
// frammento NON viene spedito al server — resta nel browser. E il
// motivo per cui la destinazione cifrata puo viaggiare per QR senza
// che noi si possa leggerla. Questa pagina non tocca il frammento:
// lo raccoglie useInitializeApp, dove gia si sa cosa farne.
// ═══════════════════════════════════════════════════════════════
import Home from '../../page.js';

// Il codice arriva come parte dell'indirizzo, ma non serve leggerlo
// qui: e `useInitializeApp` a rileggere `location.pathname` insieme al
// frammento con la chiave. Duplicare la lettura vorrebbe dire avere
// due punti che decidono la stessa cosa — l'errore che b.123 ha appena
// finito di togliere dagli ingressi delle stanze.
export default function PaginaTaxi() {
  return <Home />;
}

// Un identificativo di destinazione dura poco e non va messo in cache
// da nessuna parte lungo la strada.
export const dynamic = 'force-dynamic';
