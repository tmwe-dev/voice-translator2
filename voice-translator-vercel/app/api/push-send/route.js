// ═══════════════════════════════════════════════════════════════
// AVVISARE UN CONTATTO (b.134)
//
// "La app sara in grado di inviare messaggi e notifiche tra utenti che
//  si conoscono."
//
// Il "si conoscono" e la parte che conta. Senza quel vincolo questa
// rotta e un modo per recapitare testo arbitrario sulla schermata di
// blocco di chiunque abbia installato l'applicazione — cioe posta
// indesiderata, con la suoneria.
//
// Percio si esigono tre cose, tutte e tre verificate qui e non credute:
//
//   1. chi spedisce dimostra chi e, col gettone di sessione;
//   2. il destinatario e nei suoi contatti E lui nei contatti del
//      destinatario (`siConoscono` guarda tutte e due le direzioni);
//   3. il testo lo scriviamo NOI, non chi chiama.
//
// Il punto 3 e il meno ovvio e il piu importante. Il corpo della
// richiesta puo dire "invito" o "messaggio" e passare un codice stanza:
// non puo passare la frase che comparira sul telefono. Altrimenti il
// vincolo dei contatti servirebbe a poco — basterebbe un contatto solo,
// accettato una volta per cortesia, per poterci scrivere qualsiasi cosa
// a ripetizione.
// ═══════════════════════════════════════════════════════════════
import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { getSession, getUser } from '../../lib/users.js';
import { inviaPush, siConoscono, notificheAttive } from '../../lib/notifichePush.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('push-send');

// I soli avvisi che sappiamo produrre. Chi chiama sceglie QUALE, mai
// COSA c'e scritto.
const AVVISI = {
  invito: (nome) => ({
    titolo: nome,
    corpo: 'ti invita a una conversazione tradotta',
  }),
  messaggio: (nome) => ({
    titolo: nome,
    corpo: 'ti ha scritto',
  }),
  chiamata: (nome) => ({
    titolo: nome,
    corpo: 'ti sta chiamando',
  }),
};

async function handlePost(request) {
  if (!notificheAttive()) {
    // 503 e non 500: non e un guasto, e una configurazione che manca.
    // Chi chiama puo distinguere e smettere di riprovare.
    // b.363 — uscita di guasto muta: dal registro sembrava che non
    // fosse successo niente. Le notifiche non partivano per nessuno e non risultava da nessuna parte.
    log.warn('Invio notifiche: chiavi VAPID assenti');
    return NextResponse.json(
      { error: 'Notifiche non configurate', motivo: 'chiavi VAPID assenti' },
      { status: 503 },
    );
  }

  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corpo non leggibile' }, { status: 400 });
  }

  const { token, a: destinatario, tipo = 'messaggio', roomId = null } = corpo || {};

  if (!token) {
    return NextResponse.json({ error: 'Sessione richiesta' }, { status: 401 });
  }
  const session = await getSession(token);
  if (!session?.email) {
    return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
  }
  const mittente = String(session.email).toLowerCase();

  if (!destinatario || typeof destinatario !== 'string') {
    return NextResponse.json({ error: 'Destinatario mancante' }, { status: 400 });
  }
  const avviso = AVVISI[tipo];
  if (!avviso) {
    return NextResponse.json({ error: 'Tipo di avviso sconosciuto' }, { status: 400 });
  }

  // ── IL CANCELLO ──
  // Si risponde 403 e non 404 di proposito: dire "non e un tuo contatto"
  // non rivela niente che chi chiama non sappia gia, mentre distinguere
  // "non esiste" da "non e tuo contatto" trasformerebbe questa rotta in
  // un modo per scoprire chi e iscritto.
  if (!(await siConoscono(mittente, destinatario))) {
    return NextResponse.json(
      { error: 'Si possono avvisare solo i propri contatti' },
      { status: 403 },
    );
  }

  // Il nome mostrato e quello registrato dal mittente, non uno passato
  // nella richiesta: nessuno puo comparire sul telefono altrui col nome
  // di un terzo.
  let nome = mittente.split('@')[0];
  try {
    const u = await getUser(mittente);
    if (u?.name) nome = u.name;
  } catch { /* senza profilo si usa la parte prima della chiocciola: un avviso con un nome povero vale piu di nessun avviso */ }

  const { titolo, corpo: testo } = avviso(nome);
  const esito = await inviaPush(destinatario, {
    titolo,
    corpo: testo,
    url: roomId ? `/?room=${encodeURIComponent(String(roomId).toUpperCase())}` : '/',
    roomId,
  });

  log.info('avviso spedito', { tipo, inviate: esito.inviate, morte: esito.morte });

  // `inviate: 0` non e un errore: puo semplicemente non avere ancora
  // installato l'applicazione. Chi chiama lo distingue dal motivo.
  return NextResponse.json({ ok: true, ...esito });
}

export const POST = withApiGuard(handlePost, { maxRequests: 20, prefix: 'push-send' });
