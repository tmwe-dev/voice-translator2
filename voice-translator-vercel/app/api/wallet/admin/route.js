import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withApiGuard, safeCompare } from '../../../lib/apiGuard.js';
import { getUser } from '../../../lib/users.js';

// ═══ MONITOR ADMIN — protetto da ADMIN_PASS ═══
// GET  ?pass=... → economics (oggi/mese/totali) + config servizi
// POST { pass, chiave, valore, attivo } → cambia un interruttore AI

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } });
}
// b.161 — CONFERMATO (quarto audit esterno, punto 10): confrontava
// ADMIN_PASS con `===`, l'unica rotta admin a farlo — tutte le altre
// (debug, translate-test, tts-test, startrek) usano gia safeCompare
// (timingSafeEqual), proprio perche un confronto carattere-per-carattere
// con tempo variabile permette in teoria di indovinare la password un
// carattere alla volta misurando la latenza delle risposte. Qui, la
// password piu sensibile di tutte (accredita denaro reale a chi vuole),
// era anche l'unica non protetta.
function autorizzato(pass) {
  return !!process.env.ADMIN_PASS && safeCompare(pass, process.env.ADMIN_PASS);
}

async function handleGet(req) {
  const pass = req.headers.get('x-admin-pass');
  if (!autorizzato(pass)) return NextResponse.json({ error: 'no' }, { status: 401 });

  const [economia, totali, config, utenti, voucher] = await Promise.all([
    db().from('wallet_economics').select('*').limit(31),
    db().from('wallet_totali').select('*').single(),
    db().from('ai_config').select('*').order('chiave'),
    db().from('wallet_per_utente').select('*').limit(100), // top 100 per consumo
    db().from('vouchers').select('*').order('created_at', { ascending: false }).limit(50),
  ]);

  const t = totali.data || {};
  return NextResponse.json({
    // "quanto guadagniamo?" in chiaro
    incassato_euro: t.euro_incassati_totale || 0,
    costi_provider_euro: t.euro_costi_totale || 0,
    utile_euro: (t.euro_incassati_totale || 0) - (t.euro_costi_totale || 0),
    crediti_inutilizzati_secondi: t.secondi_in_circolo || 0,   // passività
    consumato_secondi: t.secondi_consumati_totale || 0,
    per_giorno: economia.data || [],
    servizi: config.data || [],
    utenti: utenti.data || [],   // per-utente: saldo, consumato, speso, costi, ultima attività
    voucher: voucher.data || [],
  });
}

async function handlePost(req) {
  const { pass, azione, chiave, valore, attivo, codice, minuti, usi, scade, utente, nota } = await req.json();
  if (!autorizzato(pass)) return NextResponse.json({ error: 'no' }, { status: 401 });

  // b.161 — CONFERMATO (quarto audit esterno, punto 10): il tetto
  // sotto (100000 minuti, ~69 giorni) non e una regola di business —
  // e un paracadute contro il refuso: un admin che digita uno zero di
  // troppo mintava crediti/voucher arbitrariamente grandi, scritti con
  // un INSERT diretto che scavalca wallet_usa/wallet_regala (le uniche
  // funzioni che oggi validano un tetto, 100000 SECONDI per operazione
  // singola — qui e 60x quello, pensato per un accredito/voucher
  // massivo, non per singolo utente). Ne le tabelle credit_ledger/
  // vouchers hanno un CHECK a livello DB: la difesa oggi e SOLO qui.
  const MAX_MINUTI_ADMIN = 100000;
  const minutiValidi = Number.isFinite(minuti) && minuti > 0 && minuti <= MAX_MINUTI_ADMIN;

  // ── Accredita minuti a un utente (regalo diretto dell'admin) ──
  if (azione === 'accredita') {
    if (!utente || !minutiValidi) {
      return NextResponse.json({ error: 'utente obbligatorio, minuti deve essere fra 0 e ' + MAX_MINUTI_ADMIN }, { status: 400 });
    }
    // b.161 — CONFERMATO: nessuna verifica che 'utente' esistesse
    // davvero. Non c'e una tabella profiles in produzione (vedi
    // MESSAGGIO-COMMIT-b159.txt) e credit_ledger.user_id e TEXT senza
    // FK: un'email sbagliata per un carattere accreditava comunque,
    // senza errore — il credito finiva in un ledger orfano, di fatto
    // perso. L'identita vera degli utenti vive in Redis (users.js),
    // non in Supabase: si verifica li.
    const utenteEsiste = await getUser(String(utente).toLowerCase().trim());
    if (!utenteEsiste) {
      return NextResponse.json({ error: 'utente non trovato' }, { status: 404 });
    }
    const { error } = await db().from('credit_ledger').insert({
      user_id: String(utente).toLowerCase().trim(),
      tipo: 'omaggio',
      secondi: Math.round(minuti * 60),
      dettaglio: { nota: nota || 'omaggio admin', da: 'sesamo' },
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── Rimborso manuale (Stripe rimborsato/contestato, b.162 punto 3) ──
  // b.162 — CONFERMATO (contestazione utente dopo b.161, "Refund/
  // chargeback Stripe non hanno ancora una pipeline wallet"): un
  // pagamento rimborsato o contestato non toccava mai il wallet, i
  // secondi accreditati da quell'acquisto restavano nel saldo.
  //
  // Scelta esplicita dell'utente: nessun webhook Stripe automatico
  // (charge.refunded/charge.dispute.created) — un rimborso resta una
  // decisione umana, applicata a mano da qui. L'ammontare lo decide
  // l'admin caso per caso (stesso principio di 'accredita' qui sopra,
  // simmetrico: li' l'admin decide quanto REGALARE, qui quanto
  // TOGLIERE) — per questo non serve una policy fissa "tutto o solo il
  // residuo": la valuta chi guarda il caso Stripe reale.
  //
  // Il saldo PUO scendere sotto zero (come 'accredita' non controlla
  // un tetto massimo, questo non controlla un pavimento minimo): non
  // e un rischio di sicurezza, un saldo negativo blocca comunque ogni
  // nuovo consumo allo stesso modo di un saldo a zero (wallet_usa e
  // wallet_riserva rifiutano sempre quando saldo < costo, e un costo
  // positivo e sempre maggiore di un saldo negativo).
  if (azione === 'rimborso') {
    if (!utente || !minutiValidi) {
      return NextResponse.json({ error: 'utente obbligatorio, minuti deve essere fra 0 e ' + MAX_MINUTI_ADMIN }, { status: 400 });
    }
    const utenteEsiste = await getUser(String(utente).toLowerCase().trim());
    if (!utenteEsiste) {
      return NextResponse.json({ error: 'utente non trovato' }, { status: 404 });
    }
    const { error } = await db().from('credit_ledger').insert({
      user_id: String(utente).toLowerCase().trim(),
      tipo: 'rimborso',
      secondi: -Math.round(minuti * 60),
      dettaglio: { nota: nota || 'rimborso Stripe (manuale)', da: 'sesamo' },
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── Crea un voucher promozionale ──
  if (azione === 'voucher') {
    // b.161 — CONFERMATO: `!minuti` non respinge un valore NEGATIVO
    // (`!(-50)` e' `false`): un voucher con secondi negativi veniva
    // creato senza errore, e chi lo riscattava (wallet/voucher/route.js)
    // si vedeva TOGLIERE credito invece di riceverlo, in silenzio —
    // wallet_riscatta_voucher non valida il segno di cio che legge
    // dalla tabella. Ora si usa lo stesso controllo di 'accredita'.
    if (!codice || !minutiValidi) {
      return NextResponse.json({ error: 'codice obbligatorio, minuti deve essere fra 0 e ' + MAX_MINUTI_ADMIN }, { status: 400 });
    }
    const { error } = await db().from('vouchers').insert({
      codice: String(codice).toUpperCase().trim(),
      secondi: Math.round(minuti * 60),
      usi_massimi: usi || 100,
      scade_il: scade || null,
      campagna: 'admin',
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── Interruttore/valore di un servizio AI ──
  const { error } = await db().from('ai_config')
    .upsert({ chiave, valore, attivo: attivo !== false, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export const GET = withApiGuard(handleGet, { maxRequests: 30, prefix: 'wallet-admin', skipBodyCheck: true });
export const POST = withApiGuard(handlePost, { maxRequests: 30, prefix: 'wallet-admin' });
