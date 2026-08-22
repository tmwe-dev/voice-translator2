import { NextResponse } from 'next/server';
import { withApiGuard } from '../../../lib/apiGuard.js';
import { createLogger } from '../../../lib/logger.js';
import { generaAvatar } from '../../../lib/compagni/ponte.js';
import { promptAvatar, promptIllustrazione } from '../../../lib/compagni/genera.js';
import { promptScena, promptIcona, AMBIENTI, ambientePer } from '../../../lib/compagni/corsi/scena.js';
import { getSupabaseAdmin } from '../../../lib/supabase.js';
import { createHash } from 'crypto';

const log = createLogger('compagni-avatar');

// ── b.350 — IL CASSETTO DELLE TAVOLE (Luca: «così le immagini prodotte
// da ognuno andranno perse per gli altri?»). Le tavole e le icone di un
// corso si disegnano UNA volta sola: il primo che apre la lezione paga
// la generazione, tutti gli altri ricevono la STESSA tavola dal cassetto
// — gratis, e identica per ogni studente, come le pagine di un libro
// stampato. La chiave ignora i dettagli personali: stesso corso, stessa
// lezione, stesso livello, stesso ambiente → stessa tavola per tutti.

function chiaveCassetto(tipo, pezzi) {
  const h = createHash('sha256').update(pezzi.map((p) => String(p || '').toLowerCase().trim()).join('|')).digest('hex');
  return `${tipo}/${h}.png`;
}

async function dalCassetto(sb, chiave) {
  try {
    const { data } = await sb.storage.from('tavole').list(chiave.split('/')[0], { search: chiave.split('/')[1], limit: 1 });
    if (!data?.length) return null;
    return sb.storage.from('tavole').getPublicUrl(chiave).data?.publicUrl || null;
  } catch { return null; }
}

async function riponi(sb, chiave, dataUrl) {
  try {
    const base64 = dataUrl.split(',')[1];
    if (!base64) return null;
    const { error } = await sb.storage.from('tavole')
      .upload(chiave, Buffer.from(base64, 'base64'), { contentType: 'image/png', upsert: true });
    if (error) { log.warn('cassetto: riporre fallito:', error.message); return null; }
    return sb.storage.from('tavole').getPublicUrl(chiave).data?.publicUrl || null;
  } catch (e) { log.warn('cassetto: riporre fallito:', e?.message); return null; }
}

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

    // b.350 — le immagini DI CORSO (tavole, icone, illustrazioni) passano dal
    // cassetto condiviso: prima si guarda, poi eventualmente si disegna e si
    // ripone. Gli AVATAR restano personali: mai in cassetto.
    const sb = tipo !== 'avatar' ? getSupabaseAdmin() : null;
    // b.378 — IL CATALOGO DELLE TAVOLE (piano approvato da Luca).
    //
    // La chiave della scena conteneva il TITOLO e la DESCRIZIONE della
    // lezione: due lezioni ambientate tutte e due al bar, allo stesso
    // livello, producevano due disegni diversi — e ognuno costava. Il
    // cassetto c'era, ma non ci entrava mai due volte la stessa cosa.
    //
    // Adesso la chiave e (ambiente + livello + oggetti nominati): tutte
    // le lezioni che si svolgono al bar per un principiante ricevono LA
    // STESSA tavola, in ogni corso e in ogni lingua. Le dodici situazioni
    // diventano un catalogo che si riempie da solo e non si ridisegna
    // piu — che era il senso della "preparazione preventiva".
    //
    // E c'e il pezzo che conta di piu: un disegno che esce male esce male
    // UNA VOLTA, e si sostituisce nel cassetto. Prima usciva male ogni
    // volta in modo diverso, e il primo a vederlo era sempre l'utente.
    const chiave = sb ? chiaveCassetto(tipo,
      tipo === 'scena' ? [ambienteReq?.id || ambientePer(nome, descrizione).id, livelloReq, elementiReq.slice(0, 5).join('|')]
      : tipo === 'icona' ? [descrizione || nome, livelloReq]
      : [nome, descrizione, livelloReq]) : null;
    if (sb && chiave) {
      const giaPronta = await dalCassetto(sb, chiave);
      if (giaPronta) return NextResponse.json({ ok: true, url: giaPronta, dalCassetto: true });
    }

    const r = await generaAvatar({ prompt, userToken, riferimentoDataUrl, dimensione });
    if (!r.ok) {
      if (r.status === 401) return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
      if (r.status === 402) return NextResponse.json({ error: 'Credito insufficiente', creditoEsaurito: true }, { status: 402 });
      if (r.motivo === 'rifiutata') return NextResponse.json({ error: 'Immagine rifiutata dal modello', motivo: 'rifiutata' }, { status: 422 });
      // b.363 — uscita di guasto muta: dal registro sembrava che non
      // fosse successo niente. Il motivo del rifiuto del fornitore andava perso.
      log.warn('Avatar compagno: il modello non ha prodotto immagine');
      return NextResponse.json({ error: 'Generazione non riuscita', motivo: r.motivo }, { status: 502 });
    }

    if (sb && chiave) {
      const url = await riponi(sb, chiave, r.dataUrl);
      if (url) return NextResponse.json({ ok: true, url });
    }
    return NextResponse.json({ ok: true, dataUrl: r.dataUrl });
  } catch (e) {
    log.error('Errore:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// Generazione immagine: tetto di frequenza basso (costa).
export const POST = withApiGuard(handlePost, { maxRequests: 12, prefix: 'compagni-avatar' });
