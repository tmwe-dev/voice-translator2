import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('stripe');

// b.158 — CONFERMATO, difetto critico letto nel codice: questa rotta
// non ha NESSUNA voce che la chiami dall'interfaccia viva (CreditsView.js
// usa solo /api/wallet/*), ma resta pubblica e raggiungibile da chiunque
// abbia un token di sessione valido (basta chiamare l'API direttamente,
// non serve passare dal sito). Chi la chiamava creava un vero addebito
// Stripe con carta vera, e al completamento il webhook GEMELLO
// (/api/stripe/webhook) accreditava in Redis + profiles.credits — un
// sistema che NESSUNA funzione a pagamento legge piu (resolveAuth
// guarda solo il wallet Supabase, vedi apiAuth.js: "l'UNICA verita e
// il wallet"). Risultato pratico: soldi veri incassati, credito
// consegnato in un posto che il prodotto non guarda mai — un cliente
// che avesse trovato questa rotta avrebbe pagato per niente.
// Disattivata qui la creazione dell'addebito. Il webhook gemello resta
// intatto per completare eventuali sessioni gia aperte prima di questo
// deploy (non si lascia un pagamento a meta').
async function handlePost(req) {
  try {
    const { action } = await req.json();

    if (action === 'checkout') {
      return NextResponse.json({
        error: 'Questo percorso di acquisto non e piu attivo. Usa il wallet in-app per ricaricare il credito.',
      }, { status: 410 });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e) {
    log.error('Stripe error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 30, prefix: 'stripe' });
