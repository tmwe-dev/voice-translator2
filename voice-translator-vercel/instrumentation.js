// ═══════════════════════════════════════════════════════════════
// L'ALLARME CHE NON ERA COLLEGATO (b.122)
//
// L'audit diceva "Sentry non e configurato, manca la variabile
// d'ambiente". Era vero e insufficiente: anche mettendo il DSN, non
// sarebbe successo niente.
//
// Da Sentry 8 in poi — qui siamo alla 10.69 con Next 15.5 — i file
// `sentry.server.config.js` e `sentry.edge.config.js` NON vengono piu
// caricati da soli. Vanno agganciati da questo file. Lo dice l'SDK
// stesso, nel proprio sorgente:
//
//     "Could not find a Next.js instrumentation file. This indicates
//      an incomplete configuration of the Sentry SDK. An instrumentation
//      file is required for the Sentry SDK to be initialized on the
//      server."
//
// I tre file di configurazione c'erano, scritti bene, con i tag per
// endpoint e tutto. Erano codice morto: nessuno li importava.
//
// ── COSA VUOL DIRE, IN CONCRETO ──
//
// In tutte le rotte API c'e questa forma:
//
//     import('@sentry/nextjs').then(S => S.captureException(e))
//
// Senza inizializzazione, `captureException` accetta l'errore e lo
// butta. Non e che gli errori non arrivavano a Sentry: e che non
// partivano proprio.
//
// Quindi ogni guasto lato server — le rotte, il webhook Stripe, la
// traduzione — e stato invisibile fin qui, e sarebbe rimasto invisibile
// anche dopo aver acceso il DSN. Un allarme scollegato e peggio di un
// allarme assente, perche si crede di averlo.
//
// ── onRequestError ──
//
// Il secondo avviso dell'SDK: senza questo aggancio, gli errori dei
// componenti server annidati non vengono raccolti. Sono proprio quelli
// che l'utente vede come "pagina che non si carica" senza altra
// spiegazione.
// ═══════════════════════════════════════════════════════════════

export async function register() {
  // Node e Edge hanno due configurazioni diverse: caricare quella
  // sbagliata non fallisce, semplicemente non inizializza niente.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config.js');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config.js');
  }
}

// Next chiama questo aggancio per ogni errore non gestito dentro un
// componente server. Va riesportato esplicitamente: non e automatico.
export async function onRequestError(...args) {
  const Sentry = await import('@sentry/nextjs');
  return Sentry.captureRequestError(...args);
}
