import { NextResponse } from 'next/server';
import { withApiGuard } from '../../../../lib/apiGuard.js';
import { createLogger } from '../../../../lib/logger.js';
import { getSession } from '../../../../lib/users.js';
import { getLang } from '../../../../lib/constants.js';
import { risolviCompagno } from '../../../../lib/compagni/persistenza.js';
import { apriLineaDalVivo, rinnovaLineaDalVivo, chiudiLineaDalVivo, turniPuliti } from '../../../../lib/compagni/ponte.js';
// b.609 — la memoria del Compagno entra nella telefonata ed esce dalla
// telefonata (da Ermes: contesto a tre livelli + memoria durante la
// sessione). Stesse funzioni della chat scritta: nessun secondo deposito.
import { ricordiPerContesto, contestoMemoria, tagsDalTesto, estraiRicordi, aggiungiRicordi } from '../../../../lib/compagni/memoria.js';
import { dopo } from '../../../../lib/dopo.js';

// ═══════════════════════════════════════════════════════════════
// LA PORTA DEL DAL VIVO — b.407, Via B (docs/PIANO-LIFE-COMPAGNI.md §5-ter)
//
// Prima di questa rotta il browser apriva da solo una sessione vocale
// con un identificativo pubblico. Nessuno chiedeva chi fosse, se il
// Compagno fosse suo, se avesse credito; e niente veniva contabilizzato.
// Non era un buco di segreti — l'identificativo dell'agente non e un
// segreto — era che la governance non esisteva proprio.
//
// Ora la linea passa di qui, e la rotta risponde a otto domande in ordine:
//
//   chi sei?              → il gettone, non il corpo della richiesta
//   con chi vuoi parlare? → risolto dal NOSTRO database
//   e' tuo quel Compagno? → 404 se non e ne predefinito ne tuo
//   in che lingua?        → quella del Compagno, se ne ha una
//   puoi permettertelo?   → riserva sul portafoglio, 402 se no
//   come parli?           → un indirizzo firmato, valido pochi minuti
//   quanto e durata?      → la misura il server, non il telefono
//   quanto hai speso?     → commit alla chiusura, il resto torna
//
// Il browser riceve solo l'indirizzo firmato e le variabili gia
// costruite: non decide piu ne chi e il Compagno ne come parla.
// ═══════════════════════════════════════════════════════════════

const log = createLogger('compagni-live-session');

// Un messaggio per motivo. Un guasto di configurazione non deve mai
// leggersi come «hai finito il credito», e viceversa.
const SPIEGAZIONI = {
  'agente-non-configurato': 'Il dal vivo non e configurato su questo ambiente.',
  'chiave-mancante': 'Il dal vivo non e configurato su questo ambiente.',
  'non-autorizzato': 'Accedi per parlare dal vivo col tuo Compagno.',
  'credito-insufficiente': 'Credito insufficiente per aprire la linea.',
  'firma-non-riuscita': 'La linea vocale non risponde. Riprova fra poco.',
  'sessione-mancante': 'Sessione non indicata.',
  'sessione-illeggibile': 'Sessione non valida.',
  'non-e-tua': 'Questa sessione non e tua.',
  // b.418
  'gia-in-corso': 'Hai gia una telefonata aperta. Chiudila prima di aprirne un altra.',
  'credito-finito': 'Il credito e finito: la telefonata si chiude qui.',
  'sessione-chiusa': 'La telefonata non e piu aperta.',
};

async function handlePost(req) {
  try {
    const body = await req.json();
    // b.418 — tre azioni: si apre, si tiene viva, si chiude.
    const azione = ['chiudi', 'rinnova'].includes(body.azione) ? body.azione : 'apri';
    const userToken = typeof body.userToken === 'string' ? body.userToken : '';

    // ── CHI SEI. Sempre dal gettone: il corpo della richiesta lo scrive
    //    chi chiama, e chi chiama non puo dichiarare la propria identita.
    const sessione = userToken ? await getSession(userToken) : null;
    if (!sessione?.email) {
      return NextResponse.json({ error: 'Accedi per parlare dal vivo col tuo Compagno' }, { status: 401 });
    }
    const email = sessione.email;
    const adesso = Date.now();

    // ── IL BATTITO (b.418). Il telefono si fa sentire mentre parla; se il
    //    tratto pagato sta per finire, se ne conferma uno e se ne apre un
    //    altro. Se il credito e finito, qui si dice — e il browser chiude.
    if (azione === 'rinnova') {
      const sessioneId = typeof body.sessioneId === 'string' ? body.sessioneId.slice(0, 64) : '';
      const r = await rinnovaLineaDalVivo({ sessioneId, email, adesso });
      if (!r.ok) {
        const corpo = { error: SPIEGAZIONI[r.motivo] || 'La telefonata non prosegue', motivo: r.motivo };
        if (r.motivo === 'credito-finito') { corpo.creditoEsaurito = true; corpo.secondiParlati = r.secondiParlati; corpo.creditoScalato = r.scalato; }
        return NextResponse.json(corpo, { status: r.status || 400 });
      }
      return NextResponse.json({ ok: true, secondiParlati: r.secondiParlati, creditoScalato: r.scalato, rinnovato: !!r.rinnovato });
    }

    // ── CHIUSURA: si paga il vero e il resto torna nel portafoglio.
    if (azione === 'chiudi') {
      const sessioneId = typeof body.sessioneId === 'string' ? body.sessioneId.slice(0, 64) : '';
      const r = await chiudiLineaDalVivo({ sessioneId, email, adesso });
      if (!r.ok) {
        return NextResponse.json({ error: SPIEGAZIONI[r.motivo] || 'Chiusura non riuscita', motivo: r.motivo }, { status: r.status || 400 });
      }
      // b.609 — QUELLO CHE SI E' DETTO AL TELEFONO SI RICORDA. I turni
      // tornavano nella chat (P1.1) ma nessuno li leggeva per estrarne
      // ricordi: dieci minuti di telefonata e il Compagno, alla chat dopo,
      // non sapeva niente. Stessa estrazione e stessa minimizzazione della
      // chat scritta (b.410), dopo la risposta, mai bloccando la chiusura.
      const turni = turniPuliti(body.turni);
      if (turni.length >= 2 && r.compagnoId && !r.gia) {
        const compagnoDellaLinea = await risolviCompagno(r.compagnoId, email).catch(() => null);
        if (compagnoDellaLinea?.memoria) {
          dopo(async () => {
            try {
              const ricordi = await estraiRicordi(turni, { userToken });
              if (ricordi.length) await aggiungiRicordi(email, compagnoDellaLinea.id, ricordi);
            } catch { /* la memoria e' un di piu': la telefonata e' chiusa e pagata comunque */ }
          });
        }
      }
      return NextResponse.json({ ok: true, secondiParlati: r.secondiParlati, creditoScalato: r.creditoScalato });
    }

    // ── CON CHI VUOI PARLARE. Il browser manda un id, non un personaggio:
    //    prima mandava nome, ruolo, personalita e voce, e chiunque poteva
    //    cambiarli per ottenere un Compagno che non era suo.
    const compagnoId = typeof body.compagnoId === 'string' ? body.compagnoId.slice(0, 64) : '';
    const compagno = await risolviCompagno(compagnoId, email);
    if (!compagno) return NextResponse.json({ error: 'Compagno non trovato' }, { status: 404 });

    // ── IN CHE LINGUA. Stessa regola della chat scritta: la lingua del
    //    Compagno vince su quella dell'app (audit, «Lingua effettiva»).
    const linguaApp = typeof body.lingua === 'string' ? body.lingua.slice(0, 8) : 'it';
    const linguaEff = compagno.lingua || linguaApp;
    const nomeLingua = getLang(linguaEff)?.name || 'Italiano';

    const contesto = typeof body.contesto === 'string' ? body.contesto.slice(0, 4000) : '';
    // b.609 — i ricordi (solo se il Compagno ha la memoria accesa), guidati
    // dai tag del contesto scritto come nella chat. Un deposito guasto non
    // ferma la telefonata: si parte senza ricordi.
    let memoria = '';
    if (compagno.memoria) {
      try { memoria = contestoMemoria(await ricordiPerContesto(email, compagno.id, tagsDalTesto(contesto))); }
      catch (e) { log.warn('ricordi non letti per la telefonata', { motivo: e?.message }); }
    }
    const r = await apriLineaDalVivo({
      compagno,
      email,
      userToken,
      nomeLingua,
      contesto,
      memoria,
      codiceLingua: linguaEff,
      adesso,
    });

    if (!r.ok) {
      const messaggio = SPIEGAZIONI[r.motivo] || 'La linea non si apre.';
      const corpo = { error: messaggio, motivo: r.motivo };
      if (r.motivo === 'credito-insufficiente') { corpo.creditoEsaurito = true; corpo.servono = r.servono; }
      if (r.status >= 500) log.warn('linea non aperta', { motivo: r.motivo });
      return NextResponse.json(corpo, { status: r.status || 502 });
    }

    return NextResponse.json({
      ok: true,
      sessioneId: r.sessioneId,
      signedUrl: r.signedUrl,
      variabili: r.variabili,
      voceId: r.voceId,
      lingua: linguaEff,
      tettoSecondi: r.tettoSecondi,
      battitoSecondi: r.battitoSecondi,
    });
  } catch (e) {
    log.error('Errore:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// b.418 — IL TETTO E' SALITO DA 10 A 60, e va detto perche non sembri un
// allentamento distratto. Fino a ieri questa porta la si bussava due
// volte per telefonata (apri, chiudi) e dieci al minuto erano larghi.
// Adesso c'e il battito: una richiesta al minuto per ogni linea aperta,
// e in una casa dietro un solo indirizzo di rete ci stanno piu persone.
// Con dieci, due telefonate in corso sotto lo stesso tetto si
// strozzavano a vicenda — e strozzare un battito vuol dire chiudere una
// telefonata che sta pagando.
// Cio che il tetto proteggeva resta protetto: l'APERTURA e ancora un
// gesto raro, e ogni apertura passa comunque dal paletto della persona
// (una linea sola) e dalla riserva sul portafoglio.
export const maxDuration = 30;
export const POST = withApiGuard(handlePost, { maxRequests: 60, prefix: 'compagni-live-session' });
