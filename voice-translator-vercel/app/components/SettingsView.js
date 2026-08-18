'use client';
import { memo, useState } from 'react';
import { LANGS, THEME_LIST, FONT, getLang, APP_VERSION } from '../lib/constants.js';
import { getPaese } from '../lib/paesi.js';
import { LINGUE_INTERFACCIA, mapLang } from '../lib/i18n.js';
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

// b.136 — nome e descrizione erano scritti qui in italiano, e in
// italiano restavano anche con l'applicazione in coreano. Ora la
// tabella tiene le CHIAVI e il testo lo tira fuori L() al momento del
// disegno. 'OpenAI' non ha chiave perche e un nome proprio.
const MOTORI_VOCE = [
  { id: 'auto', nomeKey: 'engineAuto', descKey: 'engineAutoDesc' },
  { id: 'edge', nomeKey: 'engineStandard', descKey: 'engineStandardDesc' },
  { id: 'openai', nome: 'OpenAI', descKey: 'engineOpenaiDesc' },
  { id: 'elevenlabs', nomeKey: 'enginePremiumName', descKey: 'enginePremiumDesc' },
];

// ── Mattoni condivisi ──
//
// b.145 — STAVANO DENTRO IL CORPO DI SettingsView, ed e lo stesso
// errore che in b.133 faceva perdere una lettera alla volta al campo
// nome e in b.140 spegneva le animazioni delle righe dei paesi: una
// funzione ricreata a ogni disegno e per React un TIPO nuovo, quindi
// smonta e rimonta tutto il sottoalbero. Qui bastava aprire un menu a
// tendina perche le ventitre righe rinascessero da capo, transizioni
// comprese. Fuori dal corpo l'identita e stabile; la tavolozza, che
// era l'unica cosa presa dalla chiusura, ora arriva come proprieta.
const Gruppo = ({ c, titolo, children }) => (
  <div style={{ width: '100%', maxWidth: 440, marginBottom: 16 }}>
    <div style={{ fontSize: 9.5, fontWeight: 800, color: c.textMuted, letterSpacing: '0.35em',
      textTransform: 'uppercase', padding: '0 4px 9px', fontFamily: FONT }}>{titolo}</div>
    <div style={{ background: c.cardBg, border: `1px solid ${c.cardBorder}`,
      borderRadius: 18, padding: '2px 14px' }}>{children}</div>
  </div>
);

const Riga = ({ c, icona, titolo, sotto, valore, onClick, ultima, aperto, children }) => (
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

const Scelta = ({ c, attiva, titolo, sotto, onClick }) => (
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


const SettingsView = memo(function SettingsView({ apiKeyInputs, userAccount, logout, clonedVoiceId }) {
  const { L, S, prefs, setPrefs, savePrefs, setView, theme, setTheme } = useApp();
  const c = S.colors;
  const [apertoLingua, setApertoLingua] = useState(false);
  const [apertoInterfaccia, setApertoInterfaccia] = useState(false);
  const [apertoVoce, setApertoVoce] = useState(false);

  const langInfo = getLang(prefs.lang);
  const paese = getPaese(prefs.country);
  // Le lingue in cui l'interfaccia esiste davvero: 15, non 44. Mostrare
  // le altre sarebbe una promessa non mantenuta — si sceglie il danese
  // e i menu restano in inglese.
  const linguaUI = getLang(prefs.uiLang || mapLang(prefs.lang || 'en'));
  const motore = MOTORI_VOCE.find(m => m.id === (prefs.voiceEngine || 'auto')) || MOTORI_VOCE[0];
  const nomeMotore = (m) => m.nome || L(m.nomeKey);

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
                {prefs.name || userAccount?.email?.split('@')[0] || L('guestName')}
              </span>
              <span style={{ display: 'block', fontSize: 11.5, color: c.textMuted, marginTop: 2,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {userAccount?.email || L('noAccountLinked')}
              </span>
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: c.accent1 }}>{L('settingsEdit')}</span>
          </button>
        </div>

        {/* ═══ 2 · VOCE E LINGUA ═══
            b.136 — QUI C'ERA UNA RIGA SOLA, "La tua lingua", che faceva
            due mestieri incompatibili: era la lingua in cui l'utente
            parla E la lingua dell'interfaccia. Un italiano che parla con
            un americano mette "English (US)" perche vuole essere tradotto
            in inglese, e si ritrovava i menu in inglese — meta, per la
            precisione, perche questa stessa schermata aveva tutti i
            titoli scritti a mano in italiano: si vedeva "Settings" sopra
            "Motore voce" e "Timbro". Ora sono tre righe distinte e ogni
            titolo passa da L(). */}
        <Gruppo c={c} titolo={L('settingsGroupVoiceLang')}>
          <Riga c={c} icona={<IconGlobe size={17} />} titolo={L('countryLabel')}
            sotto={L('countryLabelDesc')}
            valore={paese ? `${paese.bandiera} ${paese.nome}` : '—'}
            onClick={() => setView('paese')} />

          <Riga c={c} icona={<IconGlobe size={17} />} titolo={L('uiLanguage')}
            sotto={L('uiLanguageDesc')}
            valore={`${linguaUI.flag} ${linguaUI.name}`}
            aperto={apertoInterfaccia}
            onClick={() => { setApertoInterfaccia(!apertoInterfaccia); setApertoLingua(false); setApertoVoce(false); }} />
          {apertoInterfaccia && (
            <div style={{ maxHeight: 260, overflowY: 'auto', padding: '4px 0 10px',
              borderBottom: `1px solid ${c.cardBorder}` }}>
              {LINGUE_INTERFACCIA.map(codice => {
                const l = getLang(codice);
                return (
                  <Scelta c={c} key={codice} attiva={codice === (prefs.uiLang || mapLang(prefs.lang || 'en'))}
                    titolo={`${l.flag}  ${l.name}`}
                    onClick={() => { savePrefs({ ...prefs, uiLang: codice }); setApertoInterfaccia(false); }} />
                );
              })}
            </div>
          )}

          <Riga c={c} icona={<IconGlobe size={17} />} titolo={L('spokenLanguage')}
            sotto={L('spokenLanguageDesc')}
            valore={`${langInfo.flag} ${langInfo.name}`}
            aperto={apertoLingua}
            onClick={() => { setApertoLingua(!apertoLingua); setApertoInterfaccia(false); setApertoVoce(false); }} />
          {apertoLingua && (
            <div style={{ maxHeight: 260, overflowY: 'auto', padding: '4px 0 10px',
              borderBottom: `1px solid ${c.cardBorder}` }}>
              {LANGS.map(l => (
                <Scelta c={c} key={l.code} attiva={l.code === prefs.lang}
                  titolo={`${l.flag}  ${l.name}`}
                  onClick={() => { savePrefs({ ...prefs, lang: l.code }); setApertoLingua(false); }} />
              ))}
            </div>
          )}

          <Riga c={c} icona={<IconMusic size={17} />} titolo={L('voiceEngine')}
            sotto={L('voiceEngineDesc')}
            valore={nomeMotore(motore)}
            aperto={apertoVoce}
            onClick={() => { setApertoVoce(!apertoVoce); setApertoLingua(false); }} />
          {apertoVoce && (
            <div style={{ padding: '4px 0 10px', borderBottom: `1px solid ${c.cardBorder}` }}>
              {MOTORI_VOCE.map(m => (
                <Scelta c={c} key={m.id} attiva={m.id === (prefs.voiceEngine || 'auto')}
                  titolo={nomeMotore(m)} sotto={L(m.descKey)}
                  onClick={() => { savePrefs({ ...prefs, voiceEngine: m.id }); setApertoVoce(false); }} />
              ))}
            </div>
          )}

          <Riga c={c} icona={<IconVolume size={17} />} titolo={L('voiceTimbre')}
            sotto={L('voiceTimbreDesc')}
            valore={prefs.voiceGender === 'male' ? L('voiceMale') : L('voiceFemale')}
            onClick={() => savePrefs({ ...prefs, voiceGender: prefs.voiceGender === 'male' ? 'female' : 'male' })} />

          <Riga c={c} icona={<IconMic size={17} />} titolo={L('clonedVoice')}
            sotto={L('clonedVoiceDesc')}
            valore={clonedVoiceId ? L('voiceCloneOn') : L('notConfigured')}
            onClick={() => setView('voice-clone')} ultima />
        </Gruppo>

        {/* ═══ 3 · ASPETTO ═══ */}
        <div style={{ width: '100%', maxWidth: 440, marginBottom: 16 }}>
          <div style={{ fontSize: 9.5, fontWeight: 800, color: c.textMuted, letterSpacing: '0.35em',
            textTransform: 'uppercase', padding: '0 4px 9px', fontFamily: FONT }}>{L('appearance')}</div>
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
        <Gruppo c={c} titolo={L('account')}>
          <Riga c={c} icona={<IconCreditCard size={17} />} titolo={L('creditRow')}
            sotto={L('creditRowDesc')}
            onClick={() => setView('credits')} />
          <Riga c={c} icona={<IconKey size={17} />} titolo={L('yourApiKeys')}
            sotto={L('apiKeysUnlimited')}
            valore={(() => {
              // b.232 — apiKeyInputs è un OGGETTO {openai,anthropic,…}: `.length`
              // era sempre undefined → mostrava sempre "Nessuna". Ora conta le
              // chiavi effettivamente valorizzate.
              const n = apiKeyInputs ? Object.values(apiKeyInputs).filter((v) => v && String(v).trim()).length : 0;
              return n ? String(n) : L('noneWord');
            })()}
            onClick={() => setView('apikeys')} />
          <Riga c={c} icona={<IconUser size={17} />} titolo={L('contactsRow')}
            sotto={L('contactsRowDesc')}
            onClick={() => setView('contacts')} ultima />
        </Gruppo>

        {/* ═══ 5 · PRIVACY ═══ */}
        <Gruppo c={c} titolo={L('settingsGroupPrivacy')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 2px' }}>
            <span style={{ width: 34, height: 34, borderRadius: 11, flexShrink: 0, lineHeight: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: c.overlayBg, border: `1px solid ${c.cardBorder}`, color: c.textSecondary }}>
              <IconShield size={17} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 650, color: c.textPrimary }}>
                {L('e2eTitle')}
              </span>
              <span style={{ display: 'block', fontSize: 11.5, color: c.textMuted, marginTop: 2 }}>
                {L('e2eDesc')}
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
        <Gruppo c={c} titolo={L('settingsGroupTools')}>
          <Riga c={c} icona={<IconMic size={17} />} titolo={L('tryVoices')}
            sotto={L('tryVoicesDesc')}
            onClick={() => setView('voicetest')} />
          <Riga c={c} icona={<IconSparkles size={17} />} titolo={L('aiHub')}
            sotto={L('aiHubDesc')}
            onClick={() => setView('ai')} />
          <Riga c={c} icona={<IconExport size={17} />} titolo={L('exportData')}
            sotto={L('exportDataDesc')}
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
        <Gruppo c={c} titolo={L('settingsGroupInfo')}>
          <Riga c={c} icona={<IconMessageCircle size={17} />} titolo={L('guide')}
            sotto={L('guideDesc')}
            onClick={() => setView('help')} />
          <Riga c={c} icona={<IconWarning size={17} />} titolo={L('reportProblem')}
            sotto={L('reportProblemDesc')}
            onClick={() => window.open(`mailto:${EMAIL_ASSISTENZA}?subject=${encodeURIComponent(`${L('problemMailSubject')} ${APP_VERSION}`)}`, '_blank')} />
          <Riga c={c} icona={<IconSettings size={17} />} titolo={L('versionRow')}
            valore={`BarTalk ${APP_VERSION}`} ultima />
        </Gruppo>

        {/* ═══ Azioni finali ═══ */}
        <div style={{ width: '100%', maxWidth: 440, display: 'flex', gap: 10, marginTop: 4 }}>
          <button onClick={() => { savePrefs(prefs); setView('home'); }}
            style={{ ...S.btn, flex: 1 }}>{L('saveAndBack')}</button>
          <button onClick={() => { logout?.({ clearPrefs: true }); setView('welcome'); }}
            style={{ padding: '13px 20px', borderRadius: 14, cursor: 'pointer', fontFamily: FONT,
              fontSize: 13.5, fontWeight: 700, background: 'transparent',
              border: `1px solid ${c.cardBorder}`, color: c.textMuted }}>{L('exitWord')}</button>
        </div>

      </div>
    </div>
  );
});

export default SettingsView;
