'use client';
import { memo, useState } from 'react';
import { LANGS, THEME_LIST, FONT, getLang, APP_VERSION } from '../lib/constants.js';
import { IconMic, IconGlobe, IconKey, IconMusic, IconUser, IconVolume, IconCreditCard,
  IconShield, IconExport, IconMessageCircle, IconWarning, IconCheck, IconChevronDown,
  IconSparkles, IconSettings } from './Icons.js';
import PageHeader from './ui/PageHeader.js';
import AvatarImg from './AvatarImg.js';
import { useApp } from '../contexts/AppContext.js';

// ═══════════════════════════════════════════════
// SettingsView — riscritta: ogni riga FA qualcosa.
//
// Gruppi in ordine d'uso reale:
//   1 PROFILO      chi sei (nome, avatar)
//   2 VOCE E LINGUA la tua lingua, il motore voce, il timbro
//   3 ASPETTO      i 6 temi
//   4 ACCOUNT      credito, chiavi API
//   5 PRIVACY      crittografia E2E
//   6 STRUMENTI    test voce, voice clone, glossario, esporta
//   7 INFO         guida, problema, versione, esci
//
// Icone: SOLO il set mono a filo sottile (Icons.js). Zero emoji.
// ═══════════════════════════════════════════════

// b.89 — un indirizzo solo. Prima le impostazioni scrivevano a
// support@bartalk.dev e la pagina pubblica a support@voicetranslate.app.
// TODO Luca: metti qui la casella vera, e sara quella ovunque.
const EMAIL_ASSISTENZA = 'support@voicetranslate.app';

const MOTORI_VOCE = [
  { id: 'auto', nome: 'Automatica', desc: 'Sceglie il meglio disponibile' },
  { id: 'edge', nome: 'Standard', desc: 'Veloce, consumo normale' },
  { id: 'openai', nome: 'OpenAI', desc: 'Naturale, richiede chiave propria' },
  { id: 'elevenlabs', nome: 'Premium', desc: 'ElevenLabs — consuma 3×' },
];

const SettingsView = memo(function SettingsView({ apiKeyInputs, userAccount, logout, clonedVoiceId }) {
  const { L, S, prefs, setPrefs, savePrefs, setView, theme, setTheme } = useApp();
  const c = S.colors;
  const [apertoLingua, setApertoLingua] = useState(false);
  const [apertoVoce, setApertoVoce] = useState(false);

  const langInfo = getLang(prefs.lang);
  const motore = MOTORI_VOCE.find(m => m.id === (prefs.voiceEngine || 'auto')) || MOTORI_VOCE[0];

  // ── Mattoni condivisi ──
  const Gruppo = ({ titolo, children }) => (
    <div style={{ width: '100%', maxWidth: 440, marginBottom: 16 }}>
      <div style={{ fontSize: 9.5, fontWeight: 800, color: c.textMuted, letterSpacing: '0.35em',
        textTransform: 'uppercase', padding: '0 4px 9px', fontFamily: FONT }}>{titolo}</div>
      <div style={{ background: c.cardBg, border: `1px solid ${c.cardBorder}`,
        borderRadius: 18, padding: '2px 14px' }}>{children}</div>
    </div>
  );

  const Riga = ({ icona, titolo, sotto, valore, onClick, ultima, aperto, children }) => (
    <>
      <button onClick={onClick} disabled={!onClick}
        style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
          padding: '13px 2px', background: 'none', border: 'none', fontFamily: FONT,
          cursor: onClick ? 'pointer' : 'default',
          borderBottom: ultima && !aperto ? 'none' : `1px solid ${c.cardBorder}`,
          transition: 'opacity 0.2s' }}
        onMouseOver={(e) => { if (onClick) e.currentTarget.style.opacity = 0.82; }}
        onMouseOut={(e) => e.currentTarget.style.opacity = 1}>
        <span style={{ width: 34, height: 34, borderRadius: 11, flexShrink: 0, lineHeight: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: c.overlayBg, border: `1px solid ${c.cardBorder}`, color: c.textSecondary }}>
          {icona}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 650, color: c.textPrimary }}>{titolo}</span>
          {sotto && <span style={{ display: 'block', fontSize: 11.5, color: c.textMuted, marginTop: 2 }}>{sotto}</span>}
        </span>
        {valore && <span style={{ fontSize: 12.5, fontWeight: 700, color: c.textSecondary, flexShrink: 0 }}>{valore}</span>}
        {onClick && <span style={{ color: c.textMuted, flexShrink: 0, lineHeight: 0,
          transform: aperto ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}>
          <IconChevronDown size={15} /></span>}
      </button>
      {children}
    </>
  );

  const Scelta = ({ attiva, titolo, sotto, onClick }) => (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%',
      textAlign: 'left', padding: '10px 12px', marginBottom: 5, borderRadius: 12, cursor: 'pointer',
      fontFamily: FONT, background: attiva ? c.accent1Bg : 'transparent',
      border: `1px solid ${attiva ? c.accent1Border : 'transparent'}`, transition: 'all 0.2s' }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700,
          color: attiva ? c.accent1 : c.textPrimary }}>{titolo}</span>
        {sotto && <span style={{ display: 'block', fontSize: 11, color: c.textMuted, marginTop: 1 }}>{sotto}</span>}
      </span>
      {attiva && <span style={{ color: c.accent1, lineHeight: 0 }}><IconCheck size={15} /></span>}
    </button>
  );

  return (
    <div style={S.page}>
      <div style={{ ...S.scrollCenter, gap: 0,
        paddingBottom: 'calc(110px + env(safe-area-inset-bottom))' }}>

        <div style={{ width: '100%', maxWidth: 440 }}>
          <PageHeader title={L('settings')} onBack={() => setView('home')} S={S} />
        </div>

        {/* ═══ 1 · PROFILO ═══ */}
        <div style={{ width: '100%', maxWidth: 440, marginBottom: 18 }}>
          <button onClick={() => setView('account')}
            style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left',
              padding: '14px 16px', borderRadius: 18, cursor: 'pointer', fontFamily: FONT,
              background: c.cardBg, border: `1px solid ${c.cardBorder}` }}>
            <AvatarImg src={prefs.avatar} size={52} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 17, fontWeight: 800, color: c.textPrimary }}>
                {prefs.name || userAccount?.email?.split('@')[0] || 'Ospite'}
              </span>
              <span style={{ display: 'block', fontSize: 11.5, color: c.textMuted, marginTop: 2,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {userAccount?.email || 'Nessun account collegato'}
              </span>
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: c.accent1 }}>Modifica</span>
          </button>
        </div>

        {/* ═══ 2 · VOCE E LINGUA ═══ */}
        <Gruppo titolo="Voce e lingua">
          <Riga icona={<IconGlobe size={17} />} titolo="La tua lingua"
            sotto="Quella in cui parli e leggi le traduzioni"
            valore={`${langInfo.flag} ${langInfo.name}`}
            aperto={apertoLingua}
            onClick={() => { setApertoLingua(!apertoLingua); setApertoVoce(false); }} />
          {apertoLingua && (
            <div style={{ maxHeight: 260, overflowY: 'auto', padding: '4px 0 10px',
              borderBottom: `1px solid ${c.cardBorder}` }}>
              {LANGS.map(l => (
                <Scelta key={l.code} attiva={l.code === prefs.lang}
                  titolo={`${l.flag}  ${l.name}`}
                  onClick={() => { savePrefs({ ...prefs, lang: l.code }); setApertoLingua(false); }} />
              ))}
            </div>
          )}

          <Riga icona={<IconMusic size={17} />} titolo="Motore voce"
            sotto="Come suona la traduzione parlata"
            valore={motore.nome}
            aperto={apertoVoce}
            onClick={() => { setApertoVoce(!apertoVoce); setApertoLingua(false); }} />
          {apertoVoce && (
            <div style={{ padding: '4px 0 10px', borderBottom: `1px solid ${c.cardBorder}` }}>
              {MOTORI_VOCE.map(m => (
                <Scelta key={m.id} attiva={m.id === (prefs.voiceEngine || 'auto')}
                  titolo={m.nome} sotto={m.desc}
                  onClick={() => { savePrefs({ ...prefs, voiceEngine: m.id }); setApertoVoce(false); }} />
              ))}
            </div>
          )}

          <Riga icona={<IconVolume size={17} />} titolo="Timbro"
            sotto="Voce femminile o maschile"
            valore={prefs.voiceGender === 'male' ? 'Maschile' : 'Femminile'}
            onClick={() => savePrefs({ ...prefs, voiceGender: prefs.voiceGender === 'male' ? 'female' : 'male' })} />

          <Riga icona={<IconMic size={17} />} titolo="La tua voce clonata"
            sotto="Parla con il tuo timbro in ogni lingua"
            valore={clonedVoiceId ? 'Attiva' : 'Non configurata'}
            onClick={() => setView('voice-clone')} ultima />
        </Gruppo>

        {/* ═══ 3 · ASPETTO ═══ */}
        <div style={{ width: '100%', maxWidth: 440, marginBottom: 16 }}>
          <div style={{ fontSize: 9.5, fontWeight: 800, color: c.textMuted, letterSpacing: '0.35em',
            textTransform: 'uppercase', padding: '0 4px 9px', fontFamily: FONT }}>Aspetto</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
            background: c.cardBg, border: `1px solid ${c.cardBorder}`, borderRadius: 18, padding: 12 }}>
            {THEME_LIST.map(t => (
              <button key={t.id} onClick={() => setTheme(t.id)} aria-pressed={theme === t.id}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  padding: '12px 4px 9px', borderRadius: 13, cursor: 'pointer', fontFamily: FONT,
                  background: theme === t.id ? c.accent1Bg : 'transparent',
                  border: `1px solid ${theme === t.id ? c.accent1Border : 'transparent'}`,
                  transition: 'all 0.25s' }}>
                <span style={{ width: 30, height: 30, borderRadius: 15,
                  background: t.id === 'dawn' ? 'radial-gradient(circle at 35% 30%, #ffffff, #c9d2e8)'
                    : t.id === 'blubianco' ? 'linear-gradient(135deg, #f4f7fc 50%, #345caa 50%)'
                    : t.id === 'lilla' ? 'radial-gradient(circle at 35% 30%, #c9b8f5, #4d3a85)'
                    : t.id === 'avorio' ? 'radial-gradient(circle at 35% 30%, #f2efe8, #6a6758)'
                    : t.id === 'ember' ? 'radial-gradient(circle at 35% 30%, #ffc44d, #7a4a26)'
                    : 'radial-gradient(circle at 35% 30%, #97b7eb, #23417a)',
                  border: '1px solid rgba(128,128,128,0.28)',
                  boxShadow: theme === t.id ? `0 0 0 3px ${c.accent1Bg}, 0 6px 16px -6px rgba(0,0,0,0.6)` : '0 4px 10px -4px rgba(0,0,0,0.5)',
                  transition: 'all 0.25s' }} />
                <span style={{ fontSize: 10.5, fontWeight: 750,
                  color: theme === t.id ? c.textPrimary : c.textMuted }}>{t.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ═══ 4 · ACCOUNT ═══ */}
        <Gruppo titolo="Account">
          <Riga icona={<IconCreditCard size={17} />} titolo="Credito"
            sotto="Minuti, ricariche e voucher"
            onClick={() => setView('credits')} />
          <Riga icona={<IconKey size={17} />} titolo="Le tue chiavi API"
            sotto="Con le tue chiavi l'uso è illimitato"
            valore={apiKeyInputs?.length ? String(apiKeyInputs.length) : 'Nessuna'}
            onClick={() => setView('apikeys')} />
          <Riga icona={<IconUser size={17} />} titolo="Contatti"
            sotto="Le persone con cui parli spesso"
            onClick={() => setView('contacts')} ultima />
        </Gruppo>

        {/* ═══ 5 · PRIVACY ═══ */}
        <Gruppo titolo="Privacy">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 2px' }}>
            <span style={{ width: 34, height: 34, borderRadius: 11, flexShrink: 0, lineHeight: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: c.overlayBg, border: `1px solid ${c.cardBorder}`, color: c.textSecondary }}>
              <IconShield size={17} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 650, color: c.textPrimary }}>
                Crittografia E2E
              </span>
              <span style={{ display: 'block', fontSize: 11.5, color: c.textMuted, marginTop: 2 }}>
                Nessuno può leggere i messaggi, nemmeno noi
              </span>
            </span>
            <button onClick={() => setPrefs({ ...prefs, e2eEncryption: !prefs.e2eEncryption })}
              aria-pressed={!!prefs.e2eEncryption}
              style={{ ...S.toggle, width: 40, height: 23, flexShrink: 0,
                background: prefs.e2eEncryption ? c.accent1 : c.toggleOff }}>
              <div style={{ ...S.toggleDot, width: 17, height: 17,
                transform: prefs.e2eEncryption ? 'translateX(17px)' : 'translateX(0)' }} />
            </button>
          </div>
        </Gruppo>

        {/* ═══ 6 · STRUMENTI ═══ */}
        <Gruppo titolo="Strumenti">
          <Riga icona={<IconMic size={17} />} titolo="Prova le voci"
            sotto="Ascolta come suonano prima di usarle"
            onClick={() => setView('voicetest')} />
          <Riga icona={<IconSparkles size={17} />} titolo="AI Hub e glossario"
            sotto="Modelli, contesti e parole tue"
            onClick={() => setView('ai')} />
          <Riga icona={<IconExport size={17} />} titolo="Esporta i tuoi dati"
            sotto="Un file con preferenze e conversazioni"
            onClick={() => {
              try {
                // b.89 — la riga prometteva "preferenze E CONVERSAZIONI" ma
                // esportava solo le preferenze. Ora prende tutto quello che
                // l'app tiene sul telefono, chiavi API escluse.
                const suTelefono = {};
                for (let i = 0; i < localStorage.length; i++) {
                  const k = localStorage.key(i);
                  if (!k?.startsWith('vt-')) continue;
                  if (/token|key|chiav/i.test(k)) continue; // mai esportare credenziali
                  try { suTelefono[k] = JSON.parse(localStorage.getItem(k)); }
                  catch { suTelefono[k] = localStorage.getItem(k); }
                }
                const dati = { prefs, datiLocali: suTelefono, esportato: new Date().toISOString(), versione: APP_VERSION };
                const url = URL.createObjectURL(new Blob([JSON.stringify(dati, null, 2)], { type: 'application/json' }));
                const a = document.createElement('a');
                a.href = url; a.download = `bartalk-dati-${Date.now()}.json`; a.click();
                URL.revokeObjectURL(url);
              } catch (e) { console.warn('[Settings] export:', e?.message); }
            }} ultima />
        </Gruppo>

        {/* ═══ 7 · INFO ═══ */}
        <Gruppo titolo="Info">
          <Riga icona={<IconMessageCircle size={17} />} titolo="Guida"
            sotto="Come funziona, domande frequenti"
            onClick={() => setView('help')} />
          <Riga icona={<IconWarning size={17} />} titolo="Segnala un problema"
            sotto="Scrivici: rispondiamo davvero"
            onClick={() => window.open(`mailto:${EMAIL_ASSISTENZA}?subject=Problema BarTalk ${APP_VERSION}`, '_blank')} />
          <Riga icona={<IconSettings size={17} />} titolo="Versione"
            valore={`BarTalk ${APP_VERSION}`} ultima />
        </Gruppo>

        {/* ═══ Azioni finali ═══ */}
        <div style={{ width: '100%', maxWidth: 440, display: 'flex', gap: 10, marginTop: 4 }}>
          <button onClick={() => { savePrefs(prefs); setView('home'); }}
            style={{ ...S.btn, flex: 1 }}>Salva e torna</button>
          <button onClick={() => { logout?.({ clearPrefs: true }); setView('welcome'); }}
            style={{ padding: '13px 20px', borderRadius: 14, cursor: 'pointer', fontFamily: FONT,
              fontSize: 13.5, fontWeight: 700, background: 'transparent',
              border: `1px solid ${c.cardBorder}`, color: c.textMuted }}>Esci</button>
        </div>

      </div>
    </div>
  );
});

export default SettingsView;
