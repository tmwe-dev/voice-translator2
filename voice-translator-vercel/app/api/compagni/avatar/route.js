import { NextResponse } from 'next/server';
import { withApiGuard } from '../../../lib/apiGuard.js';
import { createLogger } from '../../../lib/logger.js';
import { generaAvatar } from '../../../lib/compagni/ponte.js';
import { promptAvatar, promptIllustrazione } from '../../../lib/compagni/genera.js';
import { promptScena, promptIcona, AMBIENTI } from '../../../lib/compagni/corsi/scena.js';

const log = createLogger('compagni-avatar');

// ═══════════════════════════════════════════════════════════════
// /api/compagni/avatar — genera l'IMMAGINE dell'avatar di un Compagno con
// gpt-image-1 (OpenAI). Riceve nome/ruolo/genere (o una descrizione) e,
// opzionale, un riferimento (template o immagine caricata) da cui prendere il
// volto. Il prompt lo costruiamo noi (stile coerente coi nostri avatar). La
// generazione e l'addebito passano dalla cerniera (ponte → wallet). Modulo
// Life parallelo. Ritorna { ok, dataUrl } (l'immagine la salva il client).
// ═══════════════════════════════════════════════════════════════

// La generazione immagine può superare i 15s: diamo tempo alla funzione.
export const maxDuration = 60;

async function handlePost(req) {
  try {
    const body = await req.json();
    const userToken = typeof body.userToken === 'string' ? body.userToken : null;
    const nome = typeof body.nome === 'string' ? body.nome.trim().slice(0, 80) : '';
    const ruolo = typeof body.ruolo === 'string' ? body.ruolo.trim().slice(0, 120) : '';
    const genere = ['male', 'female', 'neutral'].includes(body.genere) ? body.genere : 'neutral';
    const descrizione = typeof body.descrizione === 'string' ? body.descrizione.trim().slice(0, 300) : '';
    // Riferimento facoltativo: un data URL PNG/JPEG (template o upload dell'utente).
    const riferimentoDataUrl = typeof body.riferimentoDataUrl === 'string' && body.riferimentoDataUrl.startsWith('data:image/')
      ? body.riferimentoDataUrl : null;

    // b.229 — stessa rotta genera anche le ILLUSTRAZIONI delle lezioni (tipo).
    // b.348 — e ora le TAVOLE del libro di lingue ('scena': ambiente + oggetti
    // da nominare, stile fisso per livello) e l'ICONA che accompagna il corso.
    const tipi = ['lezione', 'scena', 'icona'];
    const tipo = tipi.includes(body.tipo) ? body.tipo : 'avatar';
    const livelloReq = typeof body.livello === 'string' ? body.livello : 'base';
    const ambienteReq = typeof body.ambienteId === 'string'
      ? AMBIENTI.find((a) => a.id === body.ambienteId) || null : null;
    const elementiReq = Array.isArray(body.elementi)
      ? body.elementi.filter((x) => typeof x === 'string').map((x) => x.slice(0, 40)).slice(0, 8) : [];
    const prompt =
      tipo === 'scena' ? promptScena({ titolo: nome, argomento: descrizione, livello: livelloReq, ambiente: ambienteReq, elementi: elementiReq })
      : tipo === 'icona' ? promptIcona({ argomento: descrizione || nome, livello: livelloReq })
      : tipo === 'lezione' ? promptIllustrazione({ titolo: nome, argomento: descrizione, livello: livelloReq })
      : promptAvatar({ nome, ruolo, genere, descrizione });
    // La tavola e larga (come nei libri), l'icona quadrata.
    const dimensione = (tipo === 'lezione' || tipo === 'scena') ? '1536x1024' : '1024x1024';
    const r = await generaAvatar({ prompt, userToken, riferimentoDataUrl, dimensione });
    if (!r.ok) {
      if (r.status === 401) return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
      if (r.status === 402) return NextResponse.json({ error: 'Credito insufficiente', creditoEsaurito: true }, { status: 402 });
      if (r.motivo === 'rifiutata') return NextResponse.json({ error: 'Immagine rifiutata dal modello', motivo: 'rifiutata' }, { status: 422 });
      return NextResponse.json({ error: 'Generazione non riuscita', motivo: r.motivo }, { status: 502 });
    }
    return NextResponse.json({ ok: true, dataUrl: r.dataUrl });
  } catch (e) {
    log.error('Errore:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// Generazione immagine: tetto di frequenza basso (costa).
export const POST = withApiGuard(handlePost, { maxRequests: 12, prefix: 'compagni-avatar' });
