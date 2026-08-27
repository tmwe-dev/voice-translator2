// ═══════════════════════════════════════════════════════════════
// IL DEEP SEARCH DELLE FONTI (b.543).
//
// Ordine di Luca: «attiveremo una procedura di miglioramento delle fonti
// con un deep search per creare liste sempre aggiornate di potenziali
// informazioni da quel paese... se mi informo di medicina devo cercare
// altre nuove fonti specifiche».
//
// Due passi, e il secondo e' quello che conta:
//   1. si CHIEDE a un modello quali testate coprono quel Paese o quel
//      settore. Un modello sa dire «Le Scienze, Nature, The Lancet»
//      dove un elenco scritto a mano invecchia in un mese;
//   2. si VERIFICA che esistano davvero. Ogni dominio candidato viene
//      bussato (una HEAD, poi una GET leggera): chi non risponde non
//      entra in lista. E' la differenza fra una lista di nomi e una
//      lista di fonti — un modello puo inventarsi un sito, un sito che
//      non risponde no.
//
// La spesa: una chiamata al modello piu N bussate, per Paese o settore,
// una volta al mese (cache trenta giorni, condivisa fra tutti). Si fa a
// richiesta, dal tasto di Luca, mai da sola.
// ═══════════════════════════════════════════════════════════════
import { NextResponse } from 'next/server';
import { withApiGuard } from '../../../lib/apiGuard.js';
import { generaTesto } from '../../../lib/compagni/ponte.js';
import { redis } from '../../../lib/redis.js';
import { sanaFonti, chiaveLista, fondiConDirettorio } from '../../../lib/topics/fonti.js';
import { VERTICALI } from '../../../lib/topics/riordino.js';
import { createLogger } from '../../../lib/logger.js';

const log = createLogger('topics/fonti');
const TTL = 30 * 24 * 3600;
const QUANTE_CHIEDO = 18;
const ATTESA_BUSSATA = 4500;

const ISTRUZIONI = `Elenchi testate giornalistiche autorevoli. Non spieghi: elenchi.
Ricevi un PAESE oppure un SETTORE e restituisci fino a 18 righe, una per testata:
dominio|nome

Regole ferree:
- dominio nudo, senza http e senza www (esempio: ansa.it)
- solo testate VERE che pubblicano notizie o approfondimenti
- MAI aggregatori (google, bing, msn, yahoo) e MAI social
- mescola: grandi testate nazionali, testate specializzate, e almeno tre
  fonti di lingua o area diversa da quella dominante — servono a chi
  vuole leggere la stessa notizia da piu parti
- niente numerazione, niente virgolette, niente commenti`;

/** Bussa a un dominio: esiste e risponde? Non scarica la pagina intera. */
async function risponde(dominio) {
  const prova = async (metodo) => {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ATTESA_BUSSATA);
    try {
      const r = await fetch(`https://${dominio}/`, {
        method: metodo,
        redirect: 'follow',
        signal: ac.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BarTalk/1.0; +https://voice-translator2.vercel.app)' },
      });
      return r.ok || (r.status >= 300 && r.status < 400);
    } catch { return false; }
    finally { clearTimeout(t); }
  };
  // certi siti rifiutano HEAD ma rispondono a GET: si prova due volte
  // prima di dichiarare morta una testata.
  if (await prova('HEAD')) return true;
  return prova('GET');
}

async function handlePost(req) {
  try {
    const body = await req.json();
    const paese = String(body?.paese || '').slice(0, 8);
    const settore = String(body?.settore || '').slice(0, 40);
    const nomePaese = String(body?.nomePaese || '').slice(0, 60);
    const lingua = String(body?.lingua || 'it').slice(0, 8);
    const userToken = typeof body?.userToken === 'string' ? body.userToken : null;
    const rifai = body?.rifai === true;

    const chiave = chiaveLista({ paese, settore });
    if (!chiave) return NextResponse.json({ error: 'serve un paese o un settore' }, { status: 400 });
    const kRedis = `fonti:${chiave}`;

    if (!rifai) {
      try {
        const salvata = await redis('GET', kRedis);
        if (salvata) {
          const lista = JSON.parse(salvata);
          if (lista?.fonti?.length) return NextResponse.json({ ...lista, daCache: true });
        }
      } catch { /* senza cache si rifa: costa, non rompe */ }
    }

    const soggetto = settore
      ? `SETTORE: ${settore} (cerca le testate specializzate di questo settore in tutto il mondo)`
      : `PAESE: ${nomePaese || paese}`;
    const esito = await generaTesto({
      system: ISTRUZIONI,
      prompt: `${soggetto}\nLINGUA DI CHI LEGGE: ${lingua}\n\nFino a ${QUANTE_CHIEDO} righe, formato dominio|nome.`,
      userToken,
      maxTokens: 420,
      temperature: 0.4,   // qui non si deve inventare: si deve ricordare
    });
    if (!esito.ok) {
      log.warn('fonti non proposte', { motivo: esito.motivo });
      return NextResponse.json({ fonti: [], motivo: esito.motivo || 'non-proposte' });
    }

    const proposte = sanaFonti(
      String(esito.testo || '').split('\n').map((r) => {
        const [dominio, ...resto] = r.trim().split('|');
        return { dominio: (dominio || '').trim(), nome: resto.join('|').trim() };
      }).filter((x) => x.dominio),
      { massimo: QUANTE_CHIEDO },
    );

    // ── LA VERIFICA: un modello puo inventarsi un sito, un sito che non
    //    risponde no. Si bussa a tutte insieme, con un tetto di attesa.
    const vive = await Promise.all(proposte.map(async (f) => ({ ...f, viva: await risponde(f.dominio) })));
    const buone = vive.filter((f) => f.viva);

    // il direttorio scritto a mano resta come fondo, dietro alle vive
    const storiche = settore && VERTICALI[settore.toLowerCase()] ? VERTICALI[settore.toLowerCase()].fonti : [];
    const lista = {
      chiave,
      fonti: fondiConDirettorio(buone, storiche),
      proposte: proposte.length,
      scartate: proposte.length - buone.length,
      quando: Date.now(),
    };
    if (lista.fonti.length) {
      try { await redis('SET', kRedis, JSON.stringify(lista), 'EX', TTL); }
      catch { /* si rifara la prossima volta */ }
    }
    return NextResponse.json({ ...lista, daCache: false });
  } catch (e) {
    log.error('errore', e);
    return NextResponse.json({ fonti: [], motivo: 'errore' });
  }
}

/** Leggere una lista gia fatta non costa niente: serve all'icona che si riaccende. */
async function handleGet(req) {
  try {
    const url = new URL(req.url);
    const chiave = chiaveLista({ paese: url.searchParams.get('paese') || '', settore: url.searchParams.get('settore') || '' });
    if (!chiave) return NextResponse.json({ fonti: [] });
    const salvata = await redis('GET', `fonti:${chiave}`);
    if (!salvata) return NextResponse.json({ fonti: [], quando: 0 });
    return NextResponse.json(JSON.parse(salvata));
  } catch {
    return NextResponse.json({ fonti: [], quando: 0 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 10, prefix: 'topics-fonti' });
export const GET = withApiGuard(handleGet, { maxRequests: 60, prefix: 'topics-fonti-get' });
