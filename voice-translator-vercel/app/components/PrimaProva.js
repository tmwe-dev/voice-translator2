'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useApp } from '../contexts/AppContext.js';
import { memGet, memDel, memSet } from '../lib/memoria.js';
import { LANGS, getLang, FONT, vibrate } from '../lib/constants.js';
import Icon from './Icon.js';

// ═══════════════════════════════════════════════════════════════
// b.355→b.356 — "PARLA ORA", il traduttore subito.
//
// Collaudi di Luca, in ordine: «l'utente scrive o DETTA nel campo e
// traduce direttamente con voce e testo» · «va rinominato e chiuso
// dietro una icona Parla ora» · «aperto nasconde le altre parti e
// occupa la pagina» · «piu grande il testo» · «i messaggi si
// susseguono, non scompaiono».
//
// - scrivi o detti: appena ti fermi la frase si traduce da sola,
//   entra nel REGISTRO (testone) e viene detta a voce;
// - il campo si svuota da solo: la frase dopo si accoda sotto;
// - il tasto FACCIA A FACCIA gira il registro di 180 gradi: io
//   scrivo, la persona davanti a me legge dal suo lato e ascolta.
// ═══════════════════════════════════════════════════════════════

const FATTA = 'vt-prima-prova-fatta';

export function primaProvaGiaFatta() {
  try { return memGet(FATTA) === '1'; } catch { return true; }
}

export function riapriPrimaProva() {
  try { memDel(FATTA); } catch { /* niente memoria: pazienza */ }
}

// Le mete rapide in cima; tutte le altre scorrono nella stessa fila.
const RAPIDE = ['en-US', 'es', 'fr', 'de', 'zh', 'ja', 'ar', 'ru', 'pt-BR'];

export default function PrimaProva({ onChiudi }) {
  const { L, S, prefs } = useApp();
  const C = S?.colors || {};

  const miaLingua = prefs?.lang || 'it';
  const [meta, setMeta] = useState(() => (RAPIDE.find((m) => m.split('-')[0] !== (prefs?.lang || 'it').split('-')[0]) || 'en-US'));
  const [testo, setTesto] = useState('');
  // b.356 — i messaggi SI SUSSEGUONO, non scompaiono (collaudo di Luca):
  // ogni frase tradotta resta nel registro, la nuova si accoda sotto.
  const [storia, setStoria] = useState([]);
  const [stato, setStato] = useState('quieto'); // quieto | traduco | parlo | errore
  const [capovolto, setCapovolto] = useState(false); // FACCIA A FACCIA
  const [detto, setDetto] = useState(false);         // microfono acceso
  const recRef = useRef(null);
  const dettoRef = useRef(false); // per decidere la voce senza rilegare gli effetti
  const timerRef = useRef(null);
  const numeroRef = useRef(0);
  const testoRef = useRef(''); // specchio del campo, per decidere senza rincorrere lo stato
  const audioRef = useRef(null);
  const registroRef = useRef(null);

  const mete = [...RAPIDE.map((c) => LANGS.find((l) => l.code === c)).filter(Boolean),
    ...LANGS.filter((l) => !RAPIDE.includes(l.code) && l.code !== miaLingua)];

  // ── LA VOCE (sempre col testo esplicito: cosi non insegue lo stato) ──
  const parla = useCallback(async (daLeggere) => {
    const t = String(daLeggere || '').trim();
    if (!t) return;
    setStato('parlo');
    try {
      const tgt = getLang(meta);
      const lingua = tgt?.speech || meta;
      // b.356 — la traduzione la legge una voce ElevenLabs NATIVA della
      // lingua d'arrivo (collaudo di Luca): la rotta sceglie da se la voce
      // madrelingua per quella lingua. Se ElevenLabs non risponde — credito
      // finito, chiave assente, rete — si ripiega sulla voce di sistema:
      // meglio una voce che nessuna voce.
      let v = null;
      try {
        v = await fetch('/api/tts-elevenlabs', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: t, langCode: lingua }),
        });
      } catch { v = null; /* ElevenLabs irraggiungibile: si prova la voce di sistema */ }
      if (!v || !v.ok) {
        v = await fetch('/api/tts-edge', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: t, langCode: lingua }),
        });
      }
      if (!v.ok) { setStato('quieto'); return; }
      const url = URL.createObjectURL(await v.blob());
      try { audioRef.current?.pause(); } catch { /* la voce precedente era gia ferma: niente da interrompere */ }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { URL.revokeObjectURL(url); setStato('quieto'); };
      audio.onerror = () => setStato('quieto');
      audio.play().catch(() => setStato('quieto'));
    } catch { setStato('quieto'); }
  }, [meta]);

  // ── LA TRADUZIONE: la frase finita entra nel registro, con la voce ──
  const traduci = useCallback(async (daDire) => {
    const t = daDire.trim();
    if (!t) return;
    const mio = ++numeroRef.current;
    setStato('traduco');
    try {
      const r = await fetch('/api/translate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: t, sourceLang: miaLingua, targetLang: meta,
          sourceLangName: getLang(miaLingua)?.name || miaLingua,
          targetLangName: getLang(meta)?.name || meta,
        }),
      });
      const d = await r.json().catch(() => null);
      if (!d?.translated) { if (mio === numeroRef.current) setStato('errore'); return; }
      // Se l'utente sta ANCORA ALLUNGANDO la stessa frase, questa resa e
      // parziale: si butta, arrivera quella piena. Se invece ha gia
      // iniziato la frase dopo, questa resta valida e si accoda comunque:
      // i messaggi si susseguono, non scompaiono (collaudo di Luca).
      const attuale = testoRef.current.trim();
      const staAllungando = attuale !== t && attuale.startsWith(t);
      if (staAllungando) return;
      // in ordine di partenza, anche se le risposte arrivano scomposte
      setStoria((prima) => [...prima, { n: mio, detto: t, resa: d.translated }].sort((a, b) => a.n - b.n));
      if (attuale === t) setTesto('');
      if (mio === numeroRef.current) setStato('quieto');
      try { memSet(FATTA, '1'); } catch { /* niente memoria: pazienza */ }
      // La voce parte da sola — ma NON mentre il microfono e aperto,
      // altrimenti il telefono detta a se stesso la propria traduzione.
      if (!dettoRef.current) parla(d.translated);
    } catch { if (mio === numeroRef.current) setStato('errore'); }
  }, [miaLingua, meta, parla]);

  useEffect(() => { testoRef.current = testo; }, [testo]);

  // Appena smetti di scrivere, la frase parte da sola.
  useEffect(() => {
    clearTimeout(timerRef.current);
    if (!testo.trim()) return;
    timerRef.current = setTimeout(() => traduci(testo), 900);
    return () => clearTimeout(timerRef.current);
  }, [testo, traduci]);

  // l'ultima frase del registro sempre in vista
  useEffect(() => {
    const el = registroRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [storia, stato]);

  // ── LA DETTATURA (trascrizione dal vivo, stessa via di b.352) ──
  const detta = useCallback(() => {
    if (detto) {
      try { recRef.current?.stop(); } catch { /* il riconoscimento era gia fermo: fermarlo due volte non e un guasto */ }
      setDetto(false); dettoRef.current = false;
      return;
    }
    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) return;
    try {
      const rec = new SR();
      rec.lang = miaLingua;
      rec.interimResults = true;
      rec.continuous = true;
      const base = testo ? testo + ' ' : '';
      let definitivo = '';
      rec.onresult = (ev) => {
        let volatile = '';
        for (let k = ev.resultIndex; k < ev.results.length; k++) {
          const r = ev.results[k];
          if (r.isFinal) definitivo += r[0].transcript + ' ';
          else volatile += r[0].transcript;
        }
        setTesto((base + definitivo + volatile).trimStart());
      };
      rec.onend = () => {
        setDetto(false); dettoRef.current = false;
        // il microfono si e chiuso: l'ultima frase parte subito, con la voce
        setTesto((attuale) => { if (attuale.trim()) traduci(attuale); return attuale; });
      };
      rec.onerror = () => { setDetto(false); dettoRef.current = false; };
      recRef.current = rec;
      rec.start();
      setDetto(true); dettoRef.current = true;
      vibrate(8);
    } catch { setDetto(false); dettoRef.current = false; }
  }, [detto, testo, miaLingua, traduci]);

  useEffect(() => () => {
    try { recRef.current?.stop(); } catch { /* il riconoscimento era gia fermo: fermarlo due volte non e un guasto */ }
    try { audioRef.current?.pause(); } catch { /* la voce era gia ferma: fermarla due volte non e un guasto */ }
    clearTimeout(timerRef.current);
  }, []);

  const micDisponibile = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const bordo = `1px solid ${C.cardBorder || 'rgba(255,255,255,0.1)'}`;
  const ultimaResa = storia.length ? storia[storia.length - 1].resa : '';

  // ── I DUE BLOCCHI (si scambiano di posto col capovolgimento) ──
  const bloccoScrittura = (
    <div key="scrivi">
      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        <textarea value={testo} onChange={(e) => setTesto(e.target.value)} rows={capovolto ? 2 : 3}
          placeholder={detto ? 'Ti ascolto: parla…' : 'Scrivi o detta qui: la traduzione parte da sola'}
          style={{ flex: 1, padding: 13, borderRadius: 14, border: detto ? '2px solid #ff5470' : bordo,
            background: 'rgba(255,255,255,0.05)', color: C.textPrimary, fontSize: 16,
            fontFamily: FONT, resize: 'none', outline: 'none', boxSizing: 'border-box' }} />
        {micDisponibile && (
          <button onClick={detta} aria-pressed={detto} aria-label="Detta"
            style={{ width: 52, borderRadius: 14, cursor: 'pointer', flexShrink: 0,
              border: detto ? '2px solid #ff5470' : bordo,
              background: detto ? 'rgba(255,84,112,0.15)' : 'rgba(255,255,255,0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="mic" size={20} color={detto ? '#ff5470' : (C.accent || '#5b8cff')} />
          </button>
        )}
      </div>
      {/* la meta: fila di mete scorrevole */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '8px 0 2px', scrollbarWidth: 'none' }}>
        {mete.map((l) => (
          <button key={l.code} onClick={() => { vibrate(6); setMeta(l.code); }}
            style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
              borderRadius: 999, cursor: 'pointer', fontFamily: FONT, fontSize: 12.5, fontWeight: 700,
              background: meta === l.code ? `${C.accent || '#5b8cff'}22` : 'transparent',
              border: meta === l.code ? `1.5px solid ${C.accent || '#5b8cff'}` : bordo,
              color: meta === l.code ? (C.accent || '#5b8cff') : C.textSecondary }}>
            <span style={{ fontSize: 15 }}>{l.flag}</span>{l.name}
          </button>
        ))}
      </div>
    </div>
  );

  // Il REGISTRO: le frasi si susseguono, l'ultima e un testone.
  const bloccoTradotto = (
    <div key="letto" ref={registroRef} style={{
      flex: 1, minHeight: capovolto ? 200 : 140, overflowY: 'auto',
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 14,
      padding: capovolto ? '18px 14px' : 13, borderRadius: 16, border: bordo,
      background: 'rgba(255,255,255,0.04)',
      // IL RIBALTONE: la persona davanti legge dal suo lato
      transform: capovolto ? 'rotate(180deg)' : 'none',
    }}>
      {storia.length === 0 && stato !== 'traduco' && (
        <span style={{ color: C.textMuted, fontWeight: 500, fontFamily: FONT,
          fontSize: capovolto ? 22 : 14, textAlign: capovolto ? 'center' : 'left' }}>
          {capovolto ? 'La traduzione comparira qui, girata verso chi hai davanti.' : 'Qui la traduzione, testo e voce.'}
        </span>
      )}
      {storia.map((riga, i) => (
        <div key={i} style={{
          // b.356 — «piu grande il testo»: l'ultima frase e un testone,
          // le precedenti restano leggibili ma si fanno da parte.
          fontSize: i === storia.length - 1
            ? (capovolto ? 'clamp(34px, 8vw, 58px)' : 26)
            : (capovolto ? 20 : 15),
          fontWeight: 800, lineHeight: 1.25,
          color: i === storia.length - 1 ? C.textPrimary : C.textMuted,
          textAlign: capovolto ? 'center' : 'left',
          fontFamily: FONT, overflowWrap: 'anywhere',
        }}>
          {riga.resa}
        </div>
      ))}
      {stato === 'traduco' && (
        <div style={{ fontSize: capovolto ? 28 : 18, color: C.textMuted, fontFamily: FONT,
          textAlign: capovolto ? 'center' : 'left' }}>…</div>
      )}
      {stato === 'errore' && <div style={{ color: '#ff5470', fontSize: 12, fontFamily: FONT }}>La traduzione non e arrivata: riprova.</div>}
    </div>
  );

  return (
    <div style={{
      width: '100%', margin: '0 0 14px', boxSizing: 'border-box',
      // la colonna della home e un flexbox: niente compressione, e anzi
      // il pannello CRESCE a occupare la pagina (b.356: aperto, e da solo)
      flex: '1 0 auto',
      display: 'flex', flexDirection: 'column', gap: 10,
      background: C.cardBg || 'rgba(16,24,48,0.6)', border: `1px solid ${C.cardBorder || 'rgba(255,255,255,0.1)'}`,
      borderRadius: 20, padding: 14,
      minHeight: capovolto ? 'min(72vh, 640px)' : 'auto',
    }}>
      {/* testata del palco */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon name="speaker" size={16} color={C.accent || '#5b8cff'} />
        <span style={{ flex: 1, fontSize: 14, fontWeight: 800, color: C.textPrimary, fontFamily: FONT }}>
          {L('speakNowTitle')}
        </span>
        <button onClick={() => { vibrate(6); setCapovolto((v) => !v); }}
          aria-pressed={capovolto}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 999,
            cursor: 'pointer', fontFamily: FONT, fontSize: 12.5, fontWeight: 800,
            background: capovolto ? `${C.accent || '#5b8cff'}22` : 'transparent',
            border: capovolto ? `1.5px solid ${C.accent || '#5b8cff'}` : bordo,
            color: capovolto ? (C.accent || '#5b8cff') : C.textSecondary }}>
          <Icon name="swap" size={14} color={capovolto ? (C.accent || '#5b8cff') : C.textSecondary} />
          Faccia a faccia
        </button>
        <button onClick={() => { try { memSet(FATTA, '1'); } catch { /* la memoria locale non e disponibile: si chiude lo stesso */ } onChiudi?.(); }}
          aria-label={L('close')}
          style={{ background: 'none', border: 'none', color: C.textMuted, fontSize: 17, cursor: 'pointer', padding: 4 }}>✕</button>
      </div>

      {/* i due blocchi: dritti, oppure capovolti (testone su, scrittura giu) */}
      {capovolto ? (<>{bloccoTradotto}{bloccoScrittura}</>) : (<>{bloccoScrittura}{bloccoTradotto}</>)}

      {/* la voce, sempre a portata di mano per farla ripetere */}
      <button onClick={() => parla(ultimaResa)} disabled={!ultimaResa || stato === 'parlo'}
        style={{ width: '100%', padding: 13, borderRadius: 14, border: 'none',
          cursor: ultimaResa ? 'pointer' : 'default', fontFamily: FONT, fontSize: 15, fontWeight: 800,
          background: 'rgba(255,255,255,0.06)',
          color: ultimaResa ? (C.accent || '#5b8cff') : C.textMuted, opacity: stato === 'parlo' ? 0.7 : 1 }}>
        {stato === 'parlo' ? '…' : `▶ ${L('listenWord')}`}
      </button>
    </div>
  );
}
