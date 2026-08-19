import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { generaCredenzialiTURN } from '../../lib/turnCredenziali.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('turn');

// ═══════════════════════════════════════════════════════════════
// /api/turn — la porta da cui il telefono riceve il ponte (b.282)
//
// GET → { iceServers: [{ urls, username, credential }], scadenza }
//     → { iceServers: [] } se il relay non e configurato: il client
//       prosegue con i soli STUN, come oggi. Nessun errore: l'assenza
//       del ponte e uno stato normale, non un guasto.
//
// Configurazione (variabili del SERVER, mai NEXT_PUBLIC):
//   TURN_SECRET  il segreto condiviso col coturn (static-auth-secret)
//   TURN_URLS    indirizzi separati da virgola, es.
//                turn:turn.bartalk.app:3478,turns:turn.bartalk.app:5349
//
// Le credenziali sono temporanee (HMAC, 4 ore): chi le pesca dal
// browser ha in mano una chiave che si spegne da sola, non la password
// del nostro relay.
// ═══════════════════════════════════════════════════════════════

async function handleGet() {
  try {
    const segreto = process.env.TURN_SECRET;
    const urls = (process.env.TURN_URLS || '').split(',').map(u => u.trim()).filter(Boolean);
    if (!segreto || !urls.length) return NextResponse.json({ iceServers: [] });
    const c = generaCredenzialiTURN(segreto, urls);
    return NextResponse.json({
      iceServers: [{ urls: c.urls, username: c.username, credential: c.credential }],
      scadenza: c.scadenza,
    });
  } catch (e) {
    log.error('GET turn:', e.message);
    return NextResponse.json({ iceServers: [] });
  }
}

export const GET = withApiGuard(handleGet, { maxRequests: 120, prefix: 'turn' });
