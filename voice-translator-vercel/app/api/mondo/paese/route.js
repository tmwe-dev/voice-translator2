// ═══════════════════════════════════════════════════════════════
// GET /api/mondo/paese?code=JP — CHI C'E, QUI DENTRO
//
// b.399, dal documento di Luca sul globo come porta. Toccando un Paese
// deve comparire il riquadro che dice quanto quel posto e vivo:
//
//     136 persone attive · 8 stanze · 12 temi
//
// Serviva UNA chiamata sola: con due, il riquadro comparirebbe a pezzi.
//
// LA REGOLA CHE COMANDA QUI DENTRO e scritta nel documento stesso:
// «Mai inventare percentuali o consenso». Quindi ogni numero che esce da
// qui e contato, mai stimato, e quando non si puo contare si dice `null`
// — che l'interfaccia mostra come niente, non come zero. Uno zero e
// un'affermazione («non c'e nessuno»); un niente e la verita quando la
// verita non la sappiamo.
//
// LE PERSONE sono quelle DENTRO LE STANZE di quel Paese, e non c'e
// trucco: la stanza vera porta l'elenco dei presenti, gia potato da chi
// non da piu segno di vita. Non e «quante persone di quel Paese hanno
// l'app aperta» — quello non lo sappiamo, e non lo scriviamo.
//
// IL PAESE DI UNA STANZA e quello vero da b.397 in avanti. Le stanze
// nate prima non ce l'hanno: per loro vale ancora la lingua di casa di
// quel Paese, che e un'approssimazione dichiarata da mesi nel codice.
// Il riquadro dice quante ne ha contate per approssimazione, cosi chi
// legge sa quanto fidarsi invece di doverlo indovinare.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { redis } from '../../../lib/redis.js';
import { createLogger } from '../../../lib/logger.js';
import { withApiGuard } from '../../../lib/apiGuard.js';
import { linguaDelPaese } from '../../../lib/schedaMondo.js';

const log = createLogger('api-mondo-paese');
const MONDO_KEY = 'mondo:rooms';
const MONDO_TTL = 3600;

/** Due lettere, o niente. Non si cerca un posto che non puo esistere. */
function codiceValido(x) {
  const c = String(x || '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : null;
}

async function handleGet(req) {
  const url = new URL(req.url);
  const grezzo = url.searchParams.get('code');
  // Senza codice si intende il mondo intero: e una destinazione, non
  // un'assenza di filtro (il documento la vuole selezionabile).
  const paese = grezzo ? codiceValido(grezzo) : null;
  if (grezzo && !paese) return NextResponse.json({ error: 'codice paese non valido' }, { status: 400 });

  let stanze = null, persone = null, perApprossimazione = 0;
  try {
    const raw = await redis('LRANGE', MONDO_KEY, 0, 29);
    const voci = (raw || []).map((s) => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
    const ora = Date.now();
    const vive = voci.filter((r) => (ora - r.createdAt) < MONDO_TTL * 1000);

    const linguaDiLa = paese ? linguaDelPaese(paese) : null;
    const mie = !paese ? vive : vive.filter((r) => {
      if (r.paese) return r.paese === paese;
      // vecchia, senza luogo: ci si avvicina con la lingua, e si segna
      perApprossimazione += (linguaDiLa && r.lang === linguaDiLa) ? 1 : 0;
      return linguaDiLa ? r.lang === linguaDiLa : false;
    });

    // Quante persone ci sono ADESSO: si guarda la stanza vera, non la
    // fotografia scattata alla nascita (che diceva sempre "1").
    const chiavi = mie.map((r) => `room:${String(r.roomId || '').toUpperCase()}`).filter((k) => k !== 'room:');
    let dentro = 0, aperte = 0;
    if (chiavi.length) {
      const grezze = await redis('MGET', ...chiavi);
      if (Array.isArray(grezze)) {
        for (const g of grezze) {
          if (!g) continue;                 // stanza gia finita: non si conta
          try {
            const stanza = JSON.parse(g);
            aperte += 1;
            dentro += Array.isArray(stanza.members) ? stanza.members.length : 0;
          } catch { /* una voce illeggibile non falsa il totale: si salta */ }
        }
      } else {
        // Senza la lettura viva non si sa quante persone: NON si ripiega
        // sui numeri della nascita, che qui diventerebbero una bugia
        // (varrebbero uno a stanza). Si dice che non si sa.
        aperte = mie.length;
        dentro = null;
      }
    }
    stanze = aperte;
    persone = dentro;
  } catch (e) {
    log.warn('conteggio stanze non riuscito', { paese, errore: e?.message || 'ignoto' });
    stanze = null; persone = null;
  }

  // I TEMI: quanti argomenti distinti si stanno discutendo qui. Le
  // discussioni, a differenza delle stanze, il Paese ce l'hanno sempre.
  let temi = null;
  try {
    const { elencoDiscussioni } = await import('../../../lib/mondoDB.js');
    const lista = await elencoDiscussioni({ country: paese, limit: 60 });
    temi = new Set((lista || []).map((d) => d.topic).filter(Boolean)).size;
  } catch (e) {
    log.warn('conteggio temi non riuscito', { paese, errore: e?.message || 'ignoto' });
    temi = null;
  }

  return NextResponse.json({
    paese,
    persone,
    stanze,
    temi,
    // Quante delle stanze contate lo sono per approssimazione (lingua al
    // posto del luogo). Chi legge merita di sapere quanto e solido il
    // numero che sta guardando.
    approssimate: perApprossimazione,
  });
}

export const GET = withApiGuard(handleGet, { maxRequests: 30, prefix: 'mondo-paese', skipBodyCheck: true });
