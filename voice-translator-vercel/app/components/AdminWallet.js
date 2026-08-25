'use client';
import { useState } from 'react';
import { formattaDurata } from '../wallet/tariffe.js';
import Icon from './Icon.js';

// ═══════════════════════════════════════════════
// AdminWallet — il monitor economico del wallet.
// Tab dentro /admin. Chiede la ADMIN_PASS e mostra:
//   1. Quanto abbiamo incassato / speso / guadagnato
//   2. I crediti in circolo (la nostra passività)
//   3. Gli interruttori dei servizi AI (ai_config)
//   4. L'uso per singolo utente
//   5. I voucher promozionali (+ creazione)
// ═══════════════════════════════════════════════

const CARD = { background: '#18181b', borderRadius: 12, padding: 20, marginBottom: 16 };
const TH = { padding: 8, textAlign: 'left', color: '#71717a', fontWeight: 500, fontSize: 11, textTransform: 'uppercase' };
const TD = { padding: 8, fontSize: 13, borderBottom: '1px solid #1a1a1e' };
const INPUT = { background: '#09090b', border: '1px solid #27272a', borderRadius: 8, padding: '8px 12px', color: '#e4e4e7', fontSize: 14, fontFamily: 'inherit' };
const BTN = { background: '#f97316', color: '#000', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 };

const fmtEuro = (n) => '€' + Number(n || 0).toFixed(2).replace('.', ',');
const APP_URL = 'https://voice-translator2.vercel.app';

// ── Testi pronti per WhatsApp / email ──
function testoOmaggio(minuti) {
  return `Ciao! Ti ho regalato ${minuti} minuti di conversazione su BarTalk \u{1F381} `
    + `Apri ${APP_URL} ed entra con la tua email: trovi il credito nella batteria in alto.`;
}
function testoVoucher(codice, durata) {
  return `Ecco il tuo voucher BarTalk: ${codice} (vale ${durata}). `
    + `Apri ${APP_URL}, tocca la batteria in alto e inserisci il codice in "Hai un voucher?".`;
}
function linkWhatsApp(testo) { return 'https://wa.me/?text=' + encodeURIComponent(testo); }
function linkMail(a, oggetto, testo) {
  return `mailto:${a || ''}?subject=${encodeURIComponent(oggetto)}&body=${encodeURIComponent(testo)}`;
}
const BTN_MINI = { ...BTN, padding: '5px 10px', fontSize: 12, textDecoration: 'none', display: 'inline-block' };

export default function AdminWallet() {
  const [pass, setPass] = useState('');
  const [dati, setDati] = useState(null);
  const [caricamento, setCaricamento] = useState(false);
  const [esito, setEsito] = useState('');
  // Form nuovo voucher
  const [vCodice, setVCodice] = useState('');
  const [vMinuti, setVMinuti] = useState(60);
  const [vUsi, setVUsi] = useState(100);
  // Form regalo diretto
  const [rUtente, setRUtente] = useState('');
  const [rMinuti, setRMinuti] = useState(30);
  const [regalato, setRegalato] = useState(null); // { utente, minuti } → mostra i tasti invio

  async function carica(passUsata = pass) {
    setCaricamento(true); setEsito('');
    try {
      const r = await fetch('/api/wallet/admin', { signal: AbortSignal.timeout(10000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */, headers: { 'x-admin-pass': passUsata } });
      if (r.status === 401) { setEsito('Password errata'); setDati(null); return; }
      // b.363 — prima la risposta si leggeva senza protezione: bastava un
      // JSON malformato e si finiva nel catch generico, cosi' l'operatore
      // leggeva "Errore di rete" anche quando la rete funzionava benissimo.
      const d = await r.json().catch(() => null);
      if (!d) { setEsito('Il server ha risposto in modo illeggibile'); return; }
      setDati(d);
    } catch (e) {
      // b.363 — prima questo guasto non lasciava traccia da nessuna parte: nel
      // registro non compariva nulla, e il motivo vero (rete caduta, attesa
      // scaduta, credito finito, server rotto) restava irrecuperabile.
      if (e?.name !== 'AbortError') console.warn('[b.363] /api/wallet/admin:', e?.message || e);
      setEsito('Errore di rete'); }
    finally { setCaricamento(false); }
  }

  async function comanda(corpo) {
    const r = await fetch('/api/wallet/admin', { signal: AbortSignal.timeout(10000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */,
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pass, ...corpo }),
    });
    // b.363 — prima ne' la chiamata ne' la lettura erano protette: se la rete
    // cadeva o la risposta non era JSON, l'errore restava appeso e il
    // pulsante sembrava semplicemente non aver fatto nulla.
    const d = await r.json().catch(() => null);
    if (!d) { console.error('[b.363] wallet/admin: risposta illeggibile'); setEsito('Errore di rete'); return false; }
    if (d.ok) carica(); else setEsito(d.error || 'Errore');
    return d.ok;
  }

  // ── Login con la ADMIN_PASS ──
  if (!dati) {
    return (
      <div style={{ ...CARD, maxWidth: 420 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}><Icon name="credit" size={15} /> Monitor Wallet</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="password" value={pass} onChange={e => setPass(e.target.value)}
            placeholder="ADMIN_PASS" onKeyDown={e => e.key === 'Enter' && carica()}
            style={{ ...INPUT, flex: 1 }} />
          <button onClick={() => carica()} disabled={caricamento} style={BTN}>
            {caricamento ? '...' : 'Entra'}
          </button>
        </div>
        {esito && <div style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>{esito}</div>}
      </div>
    );
  }

  return (
    <>
      {/* ── 1. I numeri che contano ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Incassato', value: fmtEuro(dati.incassato_euro), color: '#22c55e' },
          { label: 'Costi provider', value: fmtEuro(dati.costi_provider_euro), color: '#ef4444' },
          { label: 'Utile', value: fmtEuro(dati.utile_euro), color: '#f59e0b' },
          { label: 'Crediti in circolo', value: formattaDurata(dati.crediti_inutilizzati_secondi), color: '#3b82f6' },
          { label: 'Consumato (sempre)', value: formattaDurata(dati.consumato_secondi), color: '#06b6d4' },
        ].map(k => (
          <div key={k.label} style={{ background: '#18181b', borderRadius: 12, padding: 16, borderLeft: `3px solid ${k.color}` }}>
            <div style={{ fontSize: 12, color: '#71717a', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* ── 2. Andamento per giorno ── */}
      <div style={CARD}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}><Icon name="history" size={15} /> Ultimi giorni</h3>
        {(dati.per_giorno || []).length === 0
          ? <div style={{ color: '#71717a', fontSize: 14 }}>Nessun movimento ancora</div>
          : <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={TH}>Giorno</th><th style={TH}>Incassato</th>
                <th style={TH}>Consumato</th><th style={TH}>Costi provider</th><th style={TH}>Utenti attivi</th>
              </tr></thead>
              <tbody>{dati.per_giorno.map(g => (
                <tr key={g.giorno}>
                  <td style={TD}>{String(g.giorno).slice(0, 10)}</td>
                  <td style={{ ...TD, color: '#22c55e' }}>{fmtEuro(g.euro_incassati)}</td>
                  <td style={TD}>{formattaDurata(g.secondi_consumati)}</td>
                  <td style={{ ...TD, color: '#ef4444' }}>{fmtEuro(g.euro_costi_provider)}</td>
                  <td style={TD}>{g.utenti_attivi}</td>
                </tr>
              ))}</tbody>
            </table>}
      </div>

      {/* ── 3. Interruttori servizi AI ── */}
      <div style={CARD}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}><Icon name="settings" size={15} /> Servizi AI</h3>
        {(dati.servizi || []).map(s => (
          <div key={s.chiave} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid #1a1a1e' }}>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{s.chiave}</span>
            <span style={{ fontSize: 13, color: '#a1a1aa' }}>{s.valore}</span>
            <button onClick={() => comanda({ chiave: s.chiave, valore: s.valore, attivo: !s.attivo })}
              aria-label={`${s.attivo ? 'Spegni' : 'Accendi'} ${s.chiave}`}
              style={{ ...BTN, background: s.attivo ? '#22c55e' : '#27272a', color: s.attivo ? '#000' : '#71717a', minWidth: 72 }}>
              {s.attivo ? 'ON' : 'OFF'}
            </button>
          </div>
        ))}
      </div>

      {/* ── 4. Regala credito a un utente + invio WhatsApp/mail ── */}
      <div style={CARD}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}><Icon name="gift" size={15} /> Regala credito</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={rUtente} onChange={e => { setRUtente(e.target.value); setRegalato(null); }}
            placeholder="email utente" style={{ ...INPUT, width: 240 }} />
          <input type="number" value={rMinuti} onChange={e => setRMinuti(+e.target.value)}
            placeholder="Minuti" style={{ ...INPUT, width: 90 }} title="Minuti regalati" />
          <button disabled={!rUtente || !rMinuti}
            onClick={async () => {
              if (await comanda({ azione: 'accredita', utente: rUtente, minuti: rMinuti })) {
                setRegalato({ utente: rUtente, minuti: rMinuti });
              }
            }} style={BTN}>Accredita</button>
        </div>
        {regalato && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
            <span style={{ color: '#22c55e', fontSize: 13, fontWeight: 600 }}>
              Fatto: +{regalato.minuti} min a {regalato.utente}. Avvisalo:
            </span>
            <a href={linkWhatsApp(testoOmaggio(regalato.minuti))} target="_blank" rel="noreferrer"
              style={{ ...BTN_MINI, background: '#25d366' }}>WhatsApp</a>
            <a href={linkMail(regalato.utente, 'Un regalo su BarTalk', testoOmaggio(regalato.minuti))}
              style={{ ...BTN_MINI, background: '#3b82f6', color: '#fff' }}>Email</a>
          </div>
        )}
      </div>

      {/* ── 5. Uso per utente ── */}
      <div style={CARD}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}><Icon name="users" size={15} /> Per utente</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={TH}>Utente</th><th style={TH}>Saldo</th><th style={TH}>Consumato</th>
              <th style={TH}>Speso</th><th style={TH}>Costi provider</th><th style={TH}>Ultima attività</th><th style={TH}></th>
            </tr></thead>
            <tbody>{(dati.utenti || []).map(u => (
              <tr key={u.user_id}>
                <td style={TD}>{u.user_id}</td>
                <td style={TD}>{formattaDurata(u.saldo_secondi)}</td>
                <td style={TD}>{formattaDurata(u.consumati_secondi)}</td>
                <td style={{ ...TD, color: '#22c55e' }}>{fmtEuro(u.euro_spesi)}</td>
                <td style={{ ...TD, color: '#ef4444' }}>{fmtEuro(u.euro_costi_provider)}</td>
                <td style={{ ...TD, color: '#71717a', fontSize: 12 }}>{String(u.ultima_attivita || '').slice(0, 16).replace('T', ' ')}</td>
                <td style={TD}>
                  <button onClick={() => { setRUtente(u.user_id); setRegalato(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    title="Prepara un regalo per questo utente" style={{ ...BTN_MINI, background: '#27272a', color: '#e4e4e7' }}>
                    <Icon name="gift" size={15} /> Regala
                  </button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>

      {/* ── 5. Voucher promozionali ── */}
      <div style={CARD}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}><Icon name="gift" size={15} /> Voucher</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <input value={vCodice} onChange={e => setVCodice(e.target.value.toUpperCase())} placeholder="CODICE" style={{ ...INPUT, width: 150 }} />
          <input type="number" value={vMinuti} onChange={e => setVMinuti(+e.target.value)} placeholder="Minuti" style={{ ...INPUT, width: 90 }} title="Minuti regalati" />
          <input type="number" value={vUsi} onChange={e => setVUsi(+e.target.value)} placeholder="Usi max" style={{ ...INPUT, width: 90 }} title="Quante persone possono usarlo" />
          <button onClick={async () => { if (await comanda({ azione: 'voucher', codice: vCodice, minuti: vMinuti, usi: vUsi })) setVCodice(''); }}
            disabled={!vCodice || !vMinuti} style={BTN}>Crea</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={TH}>Codice</th><th style={TH}>Regala</th><th style={TH}>Usi</th><th style={TH}>Scade</th><th style={TH}>Campagna</th><th style={TH}>Invia</th>
          </tr></thead>
          <tbody>{(dati.voucher || []).map(v => (
            <tr key={v.codice}>
              <td style={{ ...TD, fontWeight: 600 }}>{v.codice}</td>
              <td style={TD}>{formattaDurata(v.secondi)}</td>
              <td style={TD}>{v.usi_fatti} / {v.usi_massimi}</td>
              <td style={{ ...TD, color: '#71717a' }}>{v.scade_il ? String(v.scade_il).slice(0, 10) : 'mai'}</td>
              <td style={{ ...TD, color: '#a1a1aa' }}>{v.campagna}</td>
              <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                <a href={linkWhatsApp(testoVoucher(v.codice, formattaDurata(v.secondi)))} target="_blank" rel="noreferrer"
                  style={{ ...BTN_MINI, background: '#25d366', marginRight: 6 }}>WhatsApp</a>
                <a href={linkMail('', 'Il tuo voucher BarTalk', testoVoucher(v.codice, formattaDurata(v.secondi)))}
                  style={{ ...BTN_MINI, background: '#3b82f6', color: '#fff' }}>Email</a>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      {esito && <div style={{ color: '#ef4444', fontSize: 13 }}>{esito}</div>}
    </>
  );
}
