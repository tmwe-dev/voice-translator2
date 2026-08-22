import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { getSession } from '../../lib/users.js';
import { getSupabaseAdmin } from '../../lib/supabase.js';
import { emailInIndirizzo, normalizzaIndirizzo } from '../../lib/peepoff/indirizzo.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('peepoff');

// ═══════════════════════════════════════════════════════════════
// /api/peepoff — il SERVIZIO DI RETE del PeepOff sorella (b.349).
//
// Regola fondante: qui passano SOLO chiavi pubbliche, presenza e
// segnali d'aggancio a vita breve. MAI oggetto, corpo, allegati o
// qualunque contenuto: quelli viaggiano nel canale diretto cifrato
// fra i dispositivi. L'indirizzo (`nome#dominio`) e derivato
// dall'email dell'account BarTalk, che il login ha gia verificato.
//
// Azioni: dispositivo · risolvi · battito · segnale · segnali
// ═══════════════════════════════════════════════════════════════

const PRESENZA_TTL_MS = 75 * 1000;   // battito ogni 25s, tolleranza tripla
const SEGNALE_TTL_MS = 60 * 1000;    // gli agganci vivono un minuto
const PAYLOAD_MAX = 8 * 1024;        // un segnale e piccolo per definizione

// ═══════════════════════════════════════════════════════════════
// b.381 — QUI DENTRO PASSA SOLO SIGNALING, E LO CONTROLLIAMO NOI.
//
// PeepOff promette che il server non conosce MAI oggetto, corpo,
// allegati o contenuti: e la sua unica ragione di esistere. Ma il
// controllo era `typeof payload === 'object'` piu un tetto di ottomila
// byte — cioe: qualunque cosa, purche piccola. Un client difettoso (o
// scritto apposta) poteva spedire { body: "il messaggio" } sotto il
// nome di "segnale", e il server lo avrebbe conservato.
//
// Che oggi il nostro client non lo faccia non c'entra: una promessa di
// riservatezza che dipende dal buon comportamento del telefono non e
// una promessa, e una speranza. Il server deve poter dire di no da solo.
//
// Quindi si tiene SOLO cio che serve ad agganciare due dispositivi, e
// si butta via tutto il resto senza nemmeno guardarlo.
// ═══════════════════════════════════════════════════════════════
const CAMPI_SEGNALE = {
  offerta:  ['type', 'sdp'],
  risposta: ['type', 'sdp'],
  ghiaccio: ['candidate', 'sdpMid', 'sdpMLineIndex', 'usernameFragment'],
};

/** Ripulisce un segnale: restano solo i campi previsti per quel tipo. */
function soloSignaling(tipo, payload) {
  const ammessi = CAMPI_SEGNALE[tipo];
  if (!ammessi) return null;
  const pulito = {};
  for (const k of ammessi) {
    const v = payload[k];
    if (v === undefined || v === null) continue;
    // niente oggetti annidati: un campo di signaling e testo o numero.
    if (typeof v === 'object') return null;
    pulito[k] = typeof v === 'string' ? v.slice(0, PAYLOAD_MAX) : v;
  }
  // un'offerta senza sdp, o un ghiaccio senza candidate, non e un segnale.
  if ((tipo === 'offerta' || tipo === 'risposta') && !pulito.sdp) return null;
  if (tipo === 'ghiaccio' && pulito.candidate === undefined) return null;
  return pulito;
}

async function handlePost(req) {
  try {
    const body = await req.json();
    const azione = typeof body.azione === 'string' ? body.azione : '';
    const userToken = typeof body.userToken === 'string' ? body.userToken : null;
    const sessione = userToken ? await getSession(userToken) : null;
    if (!sessione?.email) return NextResponse.json({ error: 'Accedi per usare PeepOff' }, { status: 401 });
    const mioIndirizzo = emailInIndirizzo(sessione.email);
    if (!mioIndirizzo) return NextResponse.json({ error: 'email non derivabile' }, { status: 400 });

    const sb = getSupabaseAdmin();
    // b.363 — uscita di guasto muta: dal registro sembrava che non
    // fosse successo niente. Il servizio era spento e sembrava acceso.
    if (!sb) {
      log.warn('Peepoff: archivio non configurato');
      return NextResponse.json({ error: 'archivio non disponibile' }, { status: 503 });
    }

    // ── DISPOSITIVO: pubblica le chiavi pubbliche del MIO dispositivo ──
    if (azione === 'dispositivo') {
      const deviceId = String(body.deviceId || '').slice(0, 64);
      const scambio = body.chiaveScambio;
      const firma = body.chiaveFirma;
      const impronta = String(body.impronta || '').slice(0, 64);
      const jwkValida = (k) => k && k.kty === 'EC' && k.crv === 'P-256' && typeof k.x === 'string' && typeof k.y === 'string' && !k.d;
      if (!deviceId || !jwkValida(scambio) || !jwkValida(firma) || !/^[0-9a-f]{64}$/.test(impronta)) {
        return NextResponse.json({ error: 'dispositivo non valido' }, { status: 400 });
      }
      const { error } = await sb.from('peepoff_dispositivi').upsert({
        address: mioIndirizzo, device_id: deviceId,
        chiave_scambio: { kty: scambio.kty, crv: scambio.crv, x: scambio.x, y: scambio.y },
        chiave_firma: { kty: firma.kty, crv: firma.crv, x: firma.x, y: firma.y },
        impronta,
        presenza_scade: new Date(Date.now() + PRESENZA_TTL_MS).toISOString(),
      }, { onConflict: 'address,device_id' });
      // b.363 — uscita di guasto muta: dal registro sembrava che non
      // fosse successo niente. L errore dell archivio non usciva da nessuna parte.
      if (error) {
        log.error('Peepoff: registrazione fallita');
        return NextResponse.json({ error: 'registrazione fallita' }, { status: 500 });
      }
      return NextResponse.json({ ok: true, indirizzo: mioIndirizzo });
    }

    // ── RISOLVI: esiste? con chiavi pubbliche e presenza. Autenticato e
    // con tetto di frequenza (il cancello e in fondo al file): la domanda
    // "chi e iscritto?" non deve diventare un censimento. ──
    if (azione === 'risolvi') {
      const indirizzo = normalizzaIndirizzo(body.indirizzo);
      if (!indirizzo) return NextResponse.json({ error: 'indirizzo non valido' }, { status: 400 });
      const { data } = await sb.from('peepoff_dispositivi')
        .select('device_id, chiave_scambio, chiave_firma, impronta, presenza_scade')
        .eq('address', indirizzo).limit(8);
      if (!data || data.length === 0) return NextResponse.json({ ok: true, esiste: false });
      const adesso = Date.now();
      return NextResponse.json({
        ok: true, esiste: true,
        dispositivi: data.map((d) => ({
          deviceId: d.device_id, chiaveScambio: d.chiave_scambio, chiaveFirma: d.chiave_firma,
          impronta: d.impronta,
          presente: !!(d.presenza_scade && new Date(d.presenza_scade).getTime() > adesso),
        })),
      });
    }

    // ── BATTITO: sono vivo (e ritiro la presenza al congedo) ──
    if (azione === 'battito') {
      const deviceId = String(body.deviceId || '').slice(0, 64);
      const spegni = body.spegni === true;
      if (!deviceId) return NextResponse.json({ error: 'dispositivo mancante' }, { status: 400 });
      const { error } = await sb.from('peepoff_dispositivi')
        .update({ presenza_scade: spegni ? null : new Date(Date.now() + PRESENZA_TTL_MS).toISOString() })
        .eq('address', mioIndirizzo).eq('device_id', deviceId);
      // b.363 — uscita di guasto muta: dal registro sembrava che non
      // fosse successo niente. L errore dell archivio non usciva da nessuna parte.
      if (error) {
        log.error('Peepoff: battito non registrato');
        return NextResponse.json({ error: 'battito fallito' }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    // ── SEGNALE: l'aggancio del canale diretto (offerta/risposta/ghiaccio) ──
    if (azione === 'segnale') {
      const aDevice = String(body.aDevice || '').slice(0, 64);
      const daDevice = String(body.daDevice || '').slice(0, 64);
      const tipo = ['offerta', 'risposta', 'ghiaccio'].includes(body.tipo) ? body.tipo : null;
      const payload = body.payload;
      if (!aDevice || !daDevice || !tipo || typeof payload !== 'object' || payload === null) {
        return NextResponse.json({ error: 'segnale non valido' }, { status: 400 });
      }
      if (JSON.stringify(payload).length > PAYLOAD_MAX) {
        return NextResponse.json({ error: 'segnale troppo grande' }, { status: 413 });
      }
      // b.381 — si conserva SOLO cio che serve ad agganciare due
      // dispositivi. Tutto il resto non viene rifiutato con un errore
      // che spiega cosa passa: viene tolto e basta.
      const pulito = soloSignaling(tipo, payload);
      if (!pulito) {
        log.warn('Peepoff: segnale scartato, non e signaling', { tipo });
        return NextResponse.json({ error: 'segnale non valido' }, { status: 400 });
      }
      // pulizia dei segnali morti, a ogni scrittura: la tabella resta minuscola
      await sb.from('peepoff_segnali').delete().lt('creato', new Date(Date.now() - SEGNALE_TTL_MS).toISOString());
      const { error } = await sb.from('peepoff_segnali').insert({
        a_device: aDevice, da_address: mioIndirizzo, da_device: daDevice, tipo, payload: pulito,
      });
      // b.363 — uscita di guasto muta: dal registro sembrava che non
      // fosse successo niente. L errore dell archivio non usciva da nessuna parte.
      if (error) {
        log.error('Peepoff: segnale non recapitato');
        return NextResponse.json({ error: 'segnale non recapitato' }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    // ── SEGNALI: prelevo (e consumo) quelli per il mio dispositivo ──
    if (azione === 'segnali') {
      const deviceId = String(body.deviceId || '').slice(0, 64);
      if (!deviceId) return NextResponse.json({ error: 'dispositivo mancante' }, { status: 400 });
      // il dispositivo deve essere DAVVERO mio: i segnali sono personali
      const { data: mio } = await sb.from('peepoff_dispositivi')
        .select('device_id').eq('address', mioIndirizzo).eq('device_id', deviceId).maybeSingle();
      if (!mio) return NextResponse.json({ error: 'dispositivo sconosciuto' }, { status: 403 });
      // b.381 — SI PRENDE E SI CANCELLA IN UN COLPO SOLO.
      //
      // Prima erano due mosse separate: prima si leggeva, poi si
      // cancellava. Due letture ravvicinate dello stesso dispositivo
      // potevano leggere ENTRAMBE prima che la prima cancellasse, e lo
      // stesso segnale veniva consegnato due volte — su un aggancio
      // WebRTC un'offerta ripetuta rompe la connessione invece di
      // aprirla.
      //
      // E i segnali scaduti: si cancellavano solo quando QUALCUN ALTRO
      // scriveva. Se nessuno scriveva, un'offerta di novanta secondi
      // veniva ancora consegnata come fresca. Adesso la scadenza si
      // applica quando si legge, che e l'unico momento in cui conta.
      const limite = new Date(Date.now() - SEGNALE_TTL_MS).toISOString();
      const { data } = await sb.from('peepoff_segnali')
        .delete()
        .eq('a_device', deviceId)
        .gte('creato', limite)
        .select('id, da_address, da_device, tipo, payload');
      // i sopravvissuti scaduti si portano via adesso, senza consegnarli
      await sb.from('peepoff_segnali').delete().eq('a_device', deviceId).lt('creato', limite);
      return NextResponse.json({ ok: true, segnali: data || [] });
    }

    return NextResponse.json({ error: 'azione sconosciuta' }, { status: 400 });
  } catch (e) {
    log.error('rotta peepoff fallita:', e?.message || e);
    return NextResponse.json({ error: 'errore interno' }, { status: 500 });
  }
}

// Tetto stretto: la risoluzione e i segnali sono chiamate piccole e frequenti,
// ma 120/minuto bastano d'avanzo a un client onesto e stroncano l'enumerazione.
export const POST = withApiGuard(handlePost, { maxRequests: 120, prefix: 'peepoff', maxBodySize: 64 * 1024 });
