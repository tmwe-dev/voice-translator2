import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ═══ MONITOR ADMIN — protetto da ADMIN_PASS ═══
// GET  ?pass=... → economics (oggi/mese/totali) + config servizi
// POST { pass, chiave, valore, attivo } → cambia un interruttore AI

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } });
}
function autorizzato(pass) {
  return process.env.ADMIN_PASS && pass === process.env.ADMIN_PASS;
}

export async function GET(req) {
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

export async function POST(req) {
  const { pass, azione, chiave, valore, attivo, codice, minuti, usi, scade } = await req.json();
  if (!autorizzato(pass)) return NextResponse.json({ error: 'no' }, { status: 401 });

  // ── Crea un voucher promozionale ──
  if (azione === 'voucher') {
    if (!codice || !minuti) return NextResponse.json({ error: 'codice e minuti obbligatori' }, { status: 400 });
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
