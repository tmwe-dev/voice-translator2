import { NextResponse } from 'next/server';
import { withApiGuard } from '../../../../lib/apiGuard.js';
import { createLogger } from '../../../../lib/logger.js';
import { getSession } from '../../../../lib/users.js';
import { getLang } from '../../../../lib/constants.js';
import { risolviCompagno } from '../../../../lib/compagni/persistenza.js';
import { apriLineaDalVivo, chiudiLineaDalVivo } from '../../../../lib/compagni/ponte.js';

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
};

async function handlePost(req) {
  try {
    const body = await req.json();
    const azione = body.azione === 'chiudi' ? 'chiudi' : 'apri';
    const userToken = typeof body.userToken === 'string' ? body.userToken : '';

    // ── CHI SEI. Sempre dal gettone: il corpo della richiesta lo scrive
    //    chi chiama, e chi chiama non puo dichiarare la propria identita.
    const sessione = userToken ? await getSession(userToken) : null;
    if (!sessione?.email) {
      return NextResponse.json({ error: 'Accedi per parlare dal vivo col tuo Compagno' }, { status: 401 });
    }
    const email = sessione.email;
    const adesso = Date.now();

    // ── CHIUSURA: si paga il vero e il resto torna nel portafoglio.
    if (azione === 'chiudi') {
      const sessioneId = typeof body.sessioneId === 'string' ? body.sessioneId.slice(0, 64) : '';
      const r = await chiudiLineaDalVivo({ sessioneId, email, adesso });
      if (!r.ok) {
        return NextResponse.json({ error: SPIEGAZIONI[r.motivo] || 'Chiusura non riuscita', motivo: r.motivo }, { status: r.status || 400 });
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

    const r = await apriLineaDalVivo({
      compagno,
      email,
      userToken,
      nomeLingua,
      contesto: typeof body.contesto === 'string' ? body.contesto.slice(0, 4000) : '',
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
    });
  } catch (e) {
    log.error('Errore:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// Una telefonata sola per volta, e una manciata di tentativi: aprire una
// linea e un gesto raro. Il tetto basso e la rete contro chi provasse a
// far firmare indirizzi a raffica.
export const maxDuration = 30;
export const POST = withApiGuard(handlePost, { maxRequests: 10, prefix: 'compagni-live-session' });
