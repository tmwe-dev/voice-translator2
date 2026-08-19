'use client';
import { useState, useCallback } from 'react';
import { FONT, LANGS, getLang, vibrate } from '../lib/constants.js';
import Icon from './Icon.js';
import { useApp } from '../contexts/AppContext.js';
import { memDel, memGet, memSet } from '../lib/memoria.js';

// ═══════════════════════════════════════════════════════════════
// PRIMA PROVA — il momento che decide se una persona resta.
//
// Fino a b.95 il primo avvio era: benvenuto, sei dentro, arrangiati.
// L'utente leggeva che l'app traduce, ma non lo SENTIVA. E chi non
// prova nei primi secondi non torna.
//
// Qui una frase nella sua lingua diventa voce in un'altra, con un
// tocco solo. Niente da capire, niente da configurare: si ascolta.
// Poi la scheda sparisce per sempre e non disturba piu.
// ═══════════════════════════════════════════════════════════════

const FATTA = 'vt-prima-prova-fatta';

// Una frase per lingua: naturale, breve, utile davvero in viaggio.
const FRASI = {
  it: 'Buongiorno, mi scusi, dove posso trovare un taxi?',
  en: 'Good morning, excuse me, where can I find a taxi?',
  es: 'Buenos días, disculpe, ¿dónde puedo encontrar un taxi?',
  fr: 'Bonjour, excusez-moi, où puis-je trouver un taxi ?',
  de: 'Guten Morgen, entschuldigen Sie, wo finde ich ein Taxi?',
  pt: 'Bom dia, com licença, onde posso encontrar um táxi?',
  ru: 'Доброе утро, извините, где я могу найти такси?',
  zh: '早上好，请问哪里可以打到出租车？',
  ja: 'おはようございます、すみません、タクシーはどこで拾えますか？',
  ko: '안녕하세요, 실례합니다. 택시는 어디서 탈 수 있나요?',
  ar: 'صباح الخير، عفواً، أين يمكنني أن أجد سيارة أجرة؟',
  hi: 'नमस्ते, माफ़ कीजिए, मुझे टैक्सी कहाँ मिलेगी?',
  th: 'สวัสดีครับ ขอโทษนะครับ หาแท็กซี่ได้ที่ไหนครับ',
  tr: 'Günaydın, affedersiniz, nerede taksi bulabilirim?',
  vi: 'Chào buổi sáng, xin lỗi, tôi có thể tìm taxi ở đâu?',
};

// Le mete piu probabili per un primo assaggio.
const METE = ['en', 'es', 'fr', 'de', 'ja', 'ar'];

export function primaProvaGiaFatta() {
  try { return memGet(FATTA) === '1'; } catch { return true; }
}

// b.266 — si deve poter tornare indietro: chi ha chiuso il blocco (o ha
// premuto "non mostrare piu") lo riapre dalla home, senza svuotare la
// memoria del browser a mano.
export function riapriPrimaProva() {
  try { memDel(FATTA); } catch { /* niente memoria: pazienza */ }
}

export default function PrimaProva({ onChiudi, onIniziaDavvero }) {
  const { L, S, prefs } = useApp();
  const C = S?.colors || {};

  const miaLingua = prefs?.lang || 'it';
  const frase = FRASI[miaLingua] || FRASI.it;
  const primaMeta = METE.find(m => m !== miaLingua) || 'en';

  const [meta, setMeta] = useState(primaMeta);
  const [stato, setStato] = useState('pronto'); // pronto | traduco | fatto | errore
  const [tradotto, setTradotto] = useState('');

  const chiudiPerSempre = useCallback(() => {
    try { memSet(FATTA, '1'); } catch { /* navigazione privata o memoria piena: si prosegue senza salvare */ }
    onChiudi?.();
  }, [onChiudi]);

  const prova = useCallback(async () => {
    vibrate();
    setStato('traduco');
    setTradotto('');
    try {
      const src = getLang(miaLingua), tgt = getLang(meta);
      const r = await fetch('/api/translate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: frase, sourceLang: miaLingua, targetLang: meta,
          sourceLangName: src?.name || miaLingua, targetLangName: tgt?.name || meta,
        }),
      });
      if (!r.ok) { setStato('errore'); return; }
      const d = await r.json();
      if (!d.translated) { setStato('errore'); return; }

      setTradotto(d.translated);
      setStato('fatto');

      // La voce e meta dell'effetto: senza, resta un esercizio di lettura.
      try {
        const voce = await fetch('/api/tts-edge', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: d.translated, langCode: tgt?.speech || meta, gender: 'female' }),
        });
        if (voce.ok) {
          const blob = await voce.blob();
          if (blob.size > 0) {
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.onended = () => URL.revokeObjectURL(url);
            audio.play().catch(() => {});
          }
        }
      } catch { /* la voce e un di piu: il testo c'e gia */ }
    } catch {
      setStato('errore');
    }
  }, [frase, miaLingua, meta]);

  return (
    <div style={{
      width: '100%', maxWidth: 480, margin: '0 auto 14px',
      borderRadius: 18, padding: '16px 16px 14px',
      background: `linear-gradient(150deg, ${C.accent1}14, ${C.accent2}0A)`,
      border: `1px solid ${C.accent1}2E`,
      backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
      fontFamily: FONT,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Icon name="speaker" size={16} color={C.accent1} />
        <span style={{ fontSize: 13, fontWeight: 800, color: C.textPrimary }}>
          {L('hearItWork')}
        </span>
        {/* b.266 — la × chiude SOLO per adesso. Prima era `chiudiPerSempre`:
            un tocco sull'icona piu piccola della schermata e il blocco
            spariva per sempre, senza che niente lo dicesse e senza modo di
            riaverlo. "Non mostrare piu" e la riga esplicita qui sotto. */}
        <button onClick={() => onChiudi?.()} aria-label={L('close')}
          style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
            color: C.textMuted, display: 'flex', padding: 2 }}>
          <Icon name="x" size={14} color={C.textMuted} />
        </button>
      </div>

      <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5, marginBottom: 12 }}>
        {L('demoTenSeconds')}
      </div>

      <div style={{
        padding: '11px 13px', borderRadius: 13, marginBottom: 10,
        background: C.inputBg, border: `1px solid ${C.inputBorder}`,
        fontSize: 14, color: C.textSecondary, lineHeight: 1.45,
      }}>
        {frase}
      </div>

      {/* La meta: bandiere, un tocco */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 12 }}>
        {METE.filter(m => m !== miaLingua).map(codice => {
          const l = getLang(codice);
          const scelta = meta === codice;
          return (
            <button key={codice} onClick={() => { vibrate(10); setMeta(codice); setStato('pronto'); setTradotto(''); }}
              style={{
                flexShrink: 0, padding: '7px 12px', borderRadius: 11, cursor: 'pointer', fontFamily: FONT,
                background: scelta ? `${C.accent1}22` : 'transparent',
                border: `1px solid ${scelta ? `${C.accent1}66` : C.cardBorder}`,
                color: scelta ? C.textPrimary : C.textMuted,
                fontSize: 12.5, fontWeight: scelta ? 800 : 600, whiteSpace: 'nowrap',
              }}>
              {l?.flag} {l?.name || codice}
            </button>
          );
        })}
      </div>

      {stato === 'fatto' && tradotto && (
        <div style={{
          padding: '12px 14px', borderRadius: 13, marginBottom: 12,
          background: `${C.accent1}12`, border: `1px solid ${C.accent1}30`,
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary, lineHeight: 1.4 }}>
            {tradotto}
          </div>
          <div style={{ fontSize: 11, color: C.accent1, marginTop: 6, fontWeight: 700 }}>
            L{'’'}hai anche sentita. Funziona così, ogni volta.
          </div>
        </div>
      )}

      {stato === 'errore' && (
        <div style={{ fontSize: 12, color: C.accent3, marginBottom: 10 }}>
          Non è riuscita, riprova fra un momento.
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={prova} disabled={stato === 'traduco'} style={{
          flex: 1, padding: '12px 16px', borderRadius: 13, border: 'none',
          cursor: stato === 'traduco' ? 'default' : 'pointer', fontFamily: FONT,
          fontSize: 14, fontWeight: 800, color: '#fff',
          background: C.btnGradient || `linear-gradient(90deg, ${C.accent1}, ${C.accent2})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          opacity: stato === 'traduco' ? 0.65 : 1,
        }}>
          <Icon name={stato === 'traduco' ? 'refresh' : stato === 'fatto' ? 'refresh' : 'play'} size={15} color="#fff" />
          {stato === 'traduco' ? L('translatingDots') : stato === 'fatto' ? L('anotherLanguage') : L('listenWord')}
        </button>

        {stato === 'fatto' && (
          <button onClick={() => { vibrate(); chiudiPerSempre(); onIniziaDavvero?.(); }} style={{
            padding: '12px 16px', borderRadius: 13, cursor: 'pointer', fontFamily: FONT,
            background: 'transparent', border: `1px solid ${C.accent1}40`,
            color: C.accent1, fontSize: 13.5, fontWeight: 800, whiteSpace: 'nowrap',
          }}>
            Tocca a te
          </button>
        )}
      </div>
    </div>
  );
}
