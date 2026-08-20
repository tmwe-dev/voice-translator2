'use client';
import { memo, useState } from 'react';
import { FONT, LANGS, getLang } from '../lib/constants.js';
import Icon from './Icon.js';

// ═══════════════════════════════════════════════════════════════
// b.311 — LINGUETTA LINGUA/VOCE (Luca: "linguetta a sinistra appoggiata
// al bordo"). Una linguetta sempre presente sul bordo SINISTRO: mostra la
// bandiera della lingua parlata; toccandola scorre fuori un pannello per
// cambiare AL VOLO lingua e voce, senza entrare nelle impostazioni.
// Compare solo sulle schermate calme (non in onboarding ne in chiamata).
// Semplice e con icone grandi (regola anziani/bambini).
// ═══════════════════════════════════════════════════════════════

function LinguettaLingua({ prefs, savePrefs, L, onScegliVoce, accent = '#26D9B0' }) {
  const [aperto, setAperto] = useState(false);
  const [cerca, setCerca] = useState('');

  const tt = (k, f) => { const v = L ? L(k) : k; return v && v !== k ? v : f; };
  const linguaAttuale = getLang(prefs?.lang) || LANGS[0];
  const timbro = prefs?.voiceGender === 'male' ? 'male' : 'female';

  const q = cerca.trim().toLowerCase();
  const lingue = q
    ? LANGS.filter((l) => l.name.toLowerCase().includes(q) || l.code.toLowerCase().includes(q))
    : LANGS;

  const scegliLingua = (code) => {
    if (savePrefs && prefs) savePrefs({ ...prefs, lang: code });
  };
  const cambiaTimbro = (g) => {
    if (savePrefs && prefs) savePrefs({ ...prefs, voiceGender: g });
  };

  const card = 'rgba(12,15,30,0.92)';
  const bordo = '1px solid rgba(255,255,255,0.10)';

  return (
    <>
      {/* La linguetta sul bordo sinistro */}
      {!aperto && (
        <button onClick={() => setAperto(true)} aria-label={tt('linguettaOpen', 'Lingua e voce')}
          style={{
            position: 'fixed', left: 0, top: 'max(96px, calc(env(safe-area-inset-top) + 72px))', zIndex: 60, // b.355 — all'altezza del titolo, non a meta schermo (Luca)
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            padding: '12px 7px 12px 5px', border: 'none', cursor: 'pointer',
            background: card, borderTop: bordo, borderRight: bordo, borderBottom: bordo,
            borderTopRightRadius: 14, borderBottomRightRadius: 14, fontFamily: FONT,
            boxShadow: '2px 2px 14px rgba(0,0,0,0.35)', WebkitTapHighlightColor: 'transparent',
          }}>
          <span style={{ fontSize: 22, lineHeight: 1 }}>{linguaAttuale?.flag || <Icon name="globe" size={20} color={accent} />}</span>
          <span style={{ fontSize: 12, color: accent }}>›</span>
        </button>
      )}

      {/* Pannello a scomparsa */}
      {aperto && (
        <>
          <div onClick={() => setAperto(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.45)' }} />
          <div role="dialog" aria-label={tt('linguettaTitle', 'Lingua e voce')}
            style={{
              position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 71,
              width: 320, maxWidth: '86vw', background: card, borderRight: bordo,
              boxShadow: '4px 0 26px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column',
              fontFamily: FONT, color: '#fff',
            }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: bordo }}>
              <b style={{ fontSize: 15 }}>{tt('linguettaTitle', 'Lingua e voce')}</b>
              <button onClick={() => setAperto(false)} aria-label={tt('close', 'Chiudi')}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
              {/* VOCE — timbro + scegli voce */}
              <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>{tt('voiceTimbre', 'Voce')}</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                {[{ id: 'female', et: `♀ ${tt('female', 'Femminile')}` }, { id: 'male', et: `♂ ${tt('male', 'Maschile')}` }].map((o) => {
                  const on = timbro === o.id;
                  return (
                    <button key={o.id} onClick={() => cambiaTimbro(o.id)} aria-pressed={on}
                      style={{ flex: 1, padding: '10px 8px', borderRadius: 12, cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 700,
                        background: on ? `${accent}22` : 'rgba(255,255,255,0.05)', color: '#fff',
                        border: `2px solid ${on ? accent : 'transparent'}` }}>{o.et}</button>
                  );
                })}
              </div>
              {onScegliVoce && (
                <button onClick={() => { setAperto(false); onScegliVoce(); }}
                  style={{ width: '100%', padding: '11px 12px', borderRadius: 12, cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 700, marginBottom: 18,
                    background: 'transparent', color: accent, border: `1px solid ${accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Icon name="mic" size={15} color={accent} /> {tt('linguettaChooseVoice', 'Scegli e prova le voci')}
                </button>
              )}

              {/* LINGUA PARLATA — con bandiere e ricerca */}
              <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>{tt('spokenLanguage', 'Lingua parlata')}</div>
              <input value={cerca} onChange={(e) => setCerca(e.target.value)} placeholder={tt('search', 'Cerca…')}
                style={{ width: '100%', padding: 10, borderRadius: 10, border: bordo, background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 14, fontFamily: FONT, boxSizing: 'border-box', marginBottom: 8 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {lingue.map((l) => {
                  const on = prefs?.lang === l.code;
                  return (
                    <button key={l.code} onClick={() => scegliLingua(l.code)} aria-pressed={on}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
                        background: on ? `${accent}1f` : 'transparent', color: '#fff',
                        border: `1px solid ${on ? accent + '55' : 'transparent'}` }}>
                      <span style={{ fontSize: 20 }}>{l.flag}</span>
                      <span style={{ fontSize: 14, fontWeight: on ? 700 : 500 }}>{l.name}</span>
                      {on && <span style={{ marginLeft: 'auto', color: accent }}>✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default memo(LinguettaLingua);
