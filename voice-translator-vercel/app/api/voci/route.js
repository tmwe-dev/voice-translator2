import { NextResponse } from 'next/server';
import { withApiGuard, safeCompare } from '../../lib/apiGuard.js';
import {
  vociPerLingua, aggiungiVoce, togliVoce, impostaPredefinita, tuttoIlCatalogo,
} from '../../lib/vociCatalogo.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('voci');

// ═══════════════════════════════════════════════════════════════
// /api/voci — il catalogo voci curato per lingua (b.262)
//
// GET  ?lang=it            → { curate:[...], curata:bool }   (pubblica: e solo
//                            l'elenco dei nomi/id approvati, niente di sensibile)
// POST { pass, azione,...} → amministrazione, protetta da ADMIN_PASS con
//                            confronto a tempo costante (stessa regola di
//                            tutte le altre rotte admin, b.161).
//   azioni: 'elenco' | 'aggiungi' {lang,voiceId,nome,genere,ordine}
//         | 'togli' {lang,voiceId} | 'predefinita' {lang,voiceId,genere}
// ═══════════════════════════════════════════════════════════════

async function handleGet(req) {
  try {
    const { searchParams } = new URL(req.url);
    const lang = (searchParams.get('lang') || '').slice(0, 10);
    if (!lang) return NextResponse.json({ error: 'lang required' }, { status: 400 });
    const curate = await vociPerLingua(lang);
    // `curata: false` dice al selettore di comportarsi come prima
    // (elenco pieno): il ripiego e una scelta dichiarata, non un buco.
    return NextResponse.json({ curate, curata: curate.length > 0 });
  } catch (e) {
    log.error('GET voci:', e.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handlePost(req) {
  try {
    const body = await req.json();
    if (!safeCompare(body.pass || '', process.env.ADMIN_PASS || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const azione = String(body.azione || '');
    if (azione === 'elenco') {
      return NextResponse.json({ catalogo: await tuttoIlCatalogo() });
    }
    if (azione === 'aggiungi') {
      const esito = await aggiungiVoce({
        lang: String(body.lang || '').slice(0, 10),
        voiceId: String(body.voiceId || '').slice(0, 80),
        nome: String(body.nome || '').slice(0, 120),
        genere: ['female', 'male', 'other'].includes(body.genere) ? body.genere : 'female',
        ordine: Number(body.ordine) || 0,
      });
      return NextResponse.json(esito, { status: esito.ok ? 200 : 500 });
    }
    if (azione === 'togli') {
      const esito = await togliVoce({
        lang: String(body.lang || '').slice(0, 10),
        voiceId: String(body.voiceId || '').slice(0, 80),
      });
      return NextResponse.json(esito, { status: esito.ok ? 200 : 500 });
    }
    if (azione === 'predefinita') {
      const esito = await impostaPredefinita({
        lang: String(body.lang || '').slice(0, 10),
        voiceId: String(body.voiceId || '').slice(0, 80),
        genere: ['female', 'male', 'other'].includes(body.genere) ? body.genere : 'female',
      });
      return NextResponse.json(esito, { status: esito.ok ? 200 : 500 });
    }
    return NextResponse.json({ error: 'Invalid azione' }, { status: 400 });
  } catch (e) {
    log.error('POST voci:', e.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withApiGuard(handleGet, { maxRequests: 120, prefix: 'voci' });
export const POST = withApiGuard(handlePost, { maxRequests: 60, prefix: 'voci-admin' });
