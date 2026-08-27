// ═══════════════════════════════════════════════════════════════
// I RAMI — dove puo crescere una ricerca.
//
// b.541, dal disegno di Luca: «le ricerche sono un seme che fa crescere
// una pianta in una determinata direzione... e ogni ramo ne crea altri
// quando ha esaurito le informazioni».
//
// Questo e' l'unico pezzo che non si puo scrivere a mano: sapere che
// accanto a «tom cruise» ci sono Brad Pitt, Mission Impossible e il
// cinema d'azione — e che accanto al «chelsea» c'e la Champions League,
// le altre inglesi e i risultati di giornata — e' conoscenza del mondo.
// Un elenco fisso invecchierebbe in un mese e sarebbe italiano-centrico.
//
// La spesa e' tenuta bassa da tre cose: la cache di sette giorni (i rami
// di «tom cruise» in italiano si calcolano UNA volta a settimana per
// tutti), il tetto di otto rami, e il fatto che si chiede solo quando il
// giardino ha davvero bisogno di crescere.
// ═══════════════════════════════════════════════════════════════
import { NextResponse } from 'next/server';
import { withApiGuard } from '../../../lib/apiGuard.js';
import { generaTesto } from '../../../lib/compagni/ponte.js';
import { redis } from '../../../lib/redis.js';
import { sanaRami, normalizza } from '../../../lib/giardino.js';
import { createLogger } from '../../../lib/logger.js';

const log = createLogger('topics/rami');
const TTL = 7 * 24 * 3600;   // una settimana: i rami di un tema non cambiano ogni ora
const MAX_LIVELLO = 3;       // oltre il terzo salto si e' lontanissimi dal seme

function chiave(seme, lingua, paese) {
  return `rami:${lingua}:${paese || '-'}:${normalizza(seme).slice(0, 60)}`;
}

const ISTRUZIONI = `Sei il giardiniere delle ricerche di un giornale mondiale.
Ricevi un SEME (una ricerca fatta da una persona) e proponi 6 RICERCHE NUOVE
in cui quel seme puo' crescere. Non spieghi: elenchi.

Le sei devono coprire famiglie DIVERSE, una per riga, in questo formato:
tipo|ricerca

I tipi ammessi:
- stesso: lo stesso soggetto da un altro lato (novita, retroscena, dichiarazioni)
- vicino: soggetti affini che chi ama il seme probabilmente ama (persone, squadre, opere simili)
- ambito: la materia che sta sopra al seme (il settore, il genere, la disciplina)
- evento: cio che ACCADE attorno al seme adesso (gare, uscite, risultati, appuntamenti)
- luogo: il taglio geografico, legato al Paese di chi guarda

Regole ferree:
- ogni ricerca e' una frase breve da motore di ricerca, MAI una domanda
- scrivile nella lingua indicata
- mai ripetere il seme identico
- niente virgolette, niente numerazione, niente commenti`;

async function handlePost(req) {
  try {
    const body = await req.json();
    const seme = String(body?.seme || '').trim().slice(0, 80);
    const lingua = String(body?.lingua || 'it').slice(0, 8);
    const paese = String(body?.paese || '').slice(0, 8);
    const livello = Math.max(1, Math.min(Number(body?.livello) || 1, MAX_LIVELLO));
    const userToken = typeof body?.userToken === 'string' ? body.userToken : null;
    if (!seme) return NextResponse.json({ error: 'seme mancante' }, { status: 400 });

    // 1. Il giardino comune: se qualcuno ha gia chiesto questo seme in
    //    questa lingua, i rami sono di tutti. Niente spesa ripetuta.
    const k = chiave(seme, lingua, paese);
    try {
      const salvati = await redis('GET', k);
      if (salvati) {
        const rami = JSON.parse(salvati);
        if (Array.isArray(rami) && rami.length) {
          return NextResponse.json({ rami: rami.map((r) => ({ ...r, livello })), daCache: true });
        }
      }
    } catch { /* senza cache si calcola: costa di piu, non si rompe niente */ }

    const esito = await generaTesto({
      system: ISTRUZIONI,
      prompt: `SEME: ${seme}\nLINGUA: ${lingua}\nPAESE DI CHI GUARDA: ${paese || 'non dichiarato'}\n\nSei righe, formato tipo|ricerca.`,
      userToken,
      maxTokens: 260,
      temperature: 0.8,   // i rami devono sorprendere un po', se no si ramifica sempre uguale
    });
    if (!esito.ok) {
      // Un giardino che non cresce non deve rompere il giornale: si
      // risponde «nessun ramo» e chi guarda continua coi semi che ha.
      log.warn('rami non generati', { motivo: esito.motivo });
      return NextResponse.json({ rami: [], motivo: esito.motivo || 'non-generati' });
    }

    const grezzi = String(esito.testo || '')
      .split('\n')
      .map((r) => r.trim())
      .filter(Boolean)
      .map((r) => {
        const [tipo, ...resto] = r.split('|');
        return { tipo: String(tipo || '').trim().toLowerCase(), query: resto.join('|').trim() };
      })
      .filter((r) => r.query);

    const rami = sanaRami(grezzi, seme, livello);
    if (rami.length) {
      try { await redis('SET', k, JSON.stringify(rami), 'EX', TTL); }
      catch { /* la prossima volta si ricalcola */ }
    }
    return NextResponse.json({ rami, daCache: false });
  } catch (e) {
    log.error('errore', e);
    return NextResponse.json({ rami: [], motivo: 'errore' });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 30, prefix: 'topics-rami' });
