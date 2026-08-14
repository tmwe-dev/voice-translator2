'use client';
import { useState, useMemo, useEffect } from 'react';
import { FONT, LANGS, getLang } from '../lib/constants.js';
import { cercaPaesi, indovinaPaese, getPaese } from '../lib/paesi.js';
import { t, mapLang, preloadLang } from '../lib/i18n.js';
import { useApp } from '../contexts/AppContext.js';

// ═══════════════════════════════════════════════════════════════
// SCELTA PAESE — la prima cosa che si vede, prima di tutto (b.136)
//
// Prima di questa schermata il primo passo era WelcomeView, che
// chiedeva la LINGUA in mezzo ad altre due cose (nome e avatar) e la
// usava per due mestieri incompatibili: la lingua parlata E quella
// dell'interfaccia. Con "La tua lingua = English (US)" si vedeva
// l'intestazione "Settings" in inglese sopra "Motore voce" e "Timbro"
// in italiano: mezza applicazione in una lingua e mezza nell'altra.
//
// Qui si sceglie il PAESE, una volta, e da quello discendono tutte e
// tre le cose insieme e coerenti:
//
//   paese -> lingua parlata (prefs.lang)
//         -> lingua dell'interfaccia (prefs.uiLang, via mapLang)
//         -> bandiera del profilo (prefs.country)
//
// Non c'e un "salta". Saltare lascerebbe lo stato indefinito, che e
// esattamente il difetto da cui veniamo: si prosegue scegliendo, e la
// scelta e gia proposta in cima — basta confermarla.
//
// ATTENZIONE: chi arriva da un invito (?room=) NON passa di qui. Vedi
// useInitializeApp.js: per l'invitato la lingua si deduce e si entra
// dritti in chat. E' un lavoro di b.133 e non va rotto.
// ═══════════════════════════════════════════════════════════════

export default function SceltaPaeseView({ onFatto }) {
  const { S, prefs, savePrefs, theme } = useApp();
  const c = S?.colors || {};
  const [ricerca, setRicerca] = useState('');
  const [scelto, setScelto] = useState(null);

  // La proposta in cima: se un paese e gia stato scelto (si entra qui
  // anche dalle impostazioni) e quello, altrimenti si indovina dalla
  // regione della lingua del browser e dal fuso orario.
  //
  // Si calcola UNA VOLTA SOLA: se cambiasse a ogni battuta di tasto la
  // riga in cima ballerebbe sotto le dita mentre si cerca.
  const proposto = useMemo(() => getPaese(prefs.country) || indovinaPaese(), []);
  const attivo = scelto || proposto;

  // QUI NON SI USA L() DEL CONTESTO, ed e voluto. L() legge
  // `prefs.uiLang`, che a questo punto non esiste ancora — e la
  // decisione che stiamo prendendo. La schermata parla invece la lingua
  // del paese EVIDENZIATO: chi tocca la Cina deve vedere il pulsante in
  // cinese prima di confermare, altrimenti non sa cosa sta scegliendo.
  const linguaSchermata = mapLang(attivo?.lingua || prefs.uiLang || 'en');
  const L = (chiave) => t(linguaSchermata, chiave);

  useEffect(() => { preloadLang(linguaSchermata); }, [linguaSchermata]);

  const risultati = useMemo(() => cercaPaesi(ricerca), [ricerca]);

  function conferma(paese) {
    if (!paese) return;
    const linguaParlata = LANGS.find(l => l.code === paese.lingua) ? paese.lingua : 'en';
    const nuove = {
      ...prefs,
      country: paese.codice,
      lang: linguaParlata,
      uiLang: mapLang(linguaParlata),
    };
    savePrefs(nuove);
    onFatto?.(nuove);
  }

  const isChiaro = theme === 'dawn' || theme === 'blubianco' || theme === 'avorio';
  const sfondo = isChiaro
    ? 'linear-gradient(165deg, #f7f8fc 0%, #eef0f7 50%, #f7f8fc 100%)'
    : 'linear-gradient(165deg, #05070f 0%, #0a0f1f 45%, #101730 100%)';

  const RigaPaese = ({ p, evidenziato }) => {
    const lingua = getLang(p.lingua);
    const selezionato = attivo?.codice === p.codice;
    return (
      <button
        onClick={() => { setScelto(p); }}
        onDoubleClick={() => conferma(p)}
        aria-pressed={selezionato}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
          padding: '11px 13px', marginBottom: 5, borderRadius: 14, cursor: 'pointer',
          fontFamily: FONT,
          background: selezionato ? (c.accent1Bg || 'rgba(38,217,176,0.12)')
            : evidenziato ? (c.overlayBg || 'rgba(255,255,255,0.03)') : 'transparent',
          border: `1px solid ${selezionato ? (c.accent1Border || 'rgba(38,217,176,0.35)') : 'transparent'}`,
          transition: 'background 0.18s, border-color 0.18s',
        }}>
        <span style={{ fontSize: 25, lineHeight: 1, flexShrink: 0 }}>{p.bandiera}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700,
            color: selezionato ? (c.accent1 || '#26D9B0') : (c.textPrimary || '#fff'),
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p.nome}
          </span>
          <span style={{ display: 'block', fontSize: 11, color: c.textMuted || 'rgba(255,255,255,0.45)', marginTop: 1 }}>
            {lingua.name}
          </span>
        </span>
        {p.nome !== p.nomeEn && (
          <span style={{ fontSize: 10.5, color: c.textMuted || 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
            {p.nomeEn}
          </span>
        )}
      </button>
    );
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: sfondo, color: c.textPrimary || '#fff', fontFamily: FONT,
      display: 'flex', flexDirection: 'column',
      paddingTop: 'max(20px, env(safe-area-inset-top))',
    }}>
      <div style={{ padding: '0 20px 12px', width: '100%', maxWidth: 480, margin: '0 auto', boxSizing: 'border-box' }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase',
          color: c.accent1 || '#26D9B0', marginBottom: 10 }}>BARTALK</div>
        <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0, lineHeight: 1.2, letterSpacing: -0.4 }}>
          {L('countryTitle')}
        </h1>
        <div style={{ fontSize: 13, color: c.textMuted || 'rgba(255,255,255,0.5)', marginTop: 7, lineHeight: 1.5 }}>
          {L('countrySubtitle')}
        </div>

        <input
          type="search"
          value={ricerca}
          onChange={(e) => setRicerca(e.target.value)}
          placeholder={L('countrySearch')}
          aria-label={L('countrySearch')}
          style={{
            width: '100%', boxSizing: 'border-box', marginTop: 16,
            padding: '13px 15px', borderRadius: 15, fontFamily: FONT, fontSize: 15,
            background: c.inputBg || 'rgba(255,255,255,0.04)',
            border: `1px solid ${c.inputBorder || 'rgba(255,255,255,0.09)'}`,
            color: c.textPrimary || '#fff', outline: 'none',
          }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        padding: '0 20px', width: '100%', maxWidth: 480, margin: '0 auto', boxSizing: 'border-box' }}>

        {/* La proposta sta in cima solo quando non si sta cercando:
            durante una ricerca l'unica cosa che conta e cio che si cerca. */}
        {!ricerca && proposto && (
          <>
            <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.3em', textTransform: 'uppercase',
              color: c.textMuted || 'rgba(255,255,255,0.4)', padding: '4px 4px 8px' }}>
              {L('countrySuggested')}
            </div>
            <RigaPaese p={proposto} evidenziato />
            <div style={{ height: 10 }} />
          </>
        )}

        <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.3em', textTransform: 'uppercase',
          color: c.textMuted || 'rgba(255,255,255,0.4)', padding: '4px 4px 8px' }}>
          {L('countryAll')}
        </div>

        {risultati.length === 0 && (
          <div style={{ padding: '24px 4px', fontSize: 13, color: c.textMuted || 'rgba(255,255,255,0.4)' }}>
            {L('countryNone')}
          </div>
        )}
        {risultati.map(p => <RigaPaese key={p.codice} p={p} />)}

        <div style={{ height: 24 }} />
      </div>

      <div style={{
        padding: '12px 20px calc(16px + env(safe-area-inset-bottom))',
        width: '100%', maxWidth: 480, margin: '0 auto', boxSizing: 'border-box',
        borderTop: `1px solid ${c.cardBorder || 'rgba(255,255,255,0.06)'}`,
        background: c.headerBg || 'rgba(5,7,15,0.85)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      }}>
        <button
          onClick={() => conferma(attivo)}
          disabled={!attivo}
          style={{
            width: '100%', padding: 15, borderRadius: 16, border: 'none',
            cursor: attivo ? 'pointer' : 'default', fontFamily: FONT,
            fontSize: 15.5, fontWeight: 800, color: attivo ? '#fff' : (c.textMuted || 'rgba(255,255,255,0.35)'),
            background: attivo
              ? `linear-gradient(135deg, ${c.accent1 || '#26D9B0'}, ${c.accent2 || '#7C6BF5'})`
              : (c.overlayBg || 'rgba(255,255,255,0.04)'),
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
            WebkitTapHighlightColor: 'transparent',
          }}>
          {attivo && <span style={{ fontSize: 19, lineHeight: 1 }}>{attivo.bandiera}</span>}
          {L('countryConfirm')}
        </button>
      </div>
    </div>
  );
}
