import { NextResponse } from 'next/server';
import { withApiGuard } from '../../../lib/apiGuard.js';
import { createLogger } from '../../../lib/logger.js';
import { generaAvatar } from '../../../lib/compagni/ponte.js';
import { promptAvatar } from '../../../lib/compagni/genera.js';

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

    const prompt = promptAvatar({ nome, ruolo, genere, descrizione });
    const r = await generaAvatar({ prompt, userToken, riferimentoDataUrl });
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
