'use client';
import { FONT, vibrate } from '../../lib/constants.js';
import Icon from '../Icon.js';
import { useApp } from '../../contexts/AppContext.js';
import { settingsDaPrefs } from '../../lib/mondo/settings.js';

// ═══════════════════════════════════════════════════════════════
// LE PREFERENZE DI MONDO (b.580)
//
// Qui restano soltanto decisioni che appartengono davvero a una persona.
// Ritmo, numero fonti, FAST/DEEP e quando aggiornare sono lavoro del
// motore: non devono essere scaricati sull'utente.
// ═══════════════════════════════════════════════════════════════

const OPZIONI = [
  {
    key: 'contentMix', icon: 'layers', titolo: 'Contenuti',
    values: [
      { value: 'balanced', label: 'Bilanciati' },
      { value: 'moreVideo', label: 'Più video' },
      { value: 'moreArticles', label: 'Più articoli' },
    ],
  },
  {
    key: 'titles', icon: 'swap', titoloKey: 'prefTitlesTitle',
    values: [
      { value: 'translated', labelKey: 'prefTitlesTranslated' },
      { value: 'original', labelKey: 'prefTitlesOriginal' },
    ],
  },
  {
    key: 'breaking', icon: 'zap', titolo: 'Ultim’ora',
    values: [
      { value: 'important', label: 'Solo importanti' },
      { value: 'all', label: 'Tutte' },
      { value: 'off', label: 'Nessuna' },
    ],
  },
  {
    key: 'autoplayVideo', icon: 'play', titoloKey: 'newsAutoplayVideo',
    values: [
      { value: true, label: 'Attivo' },
      { value: false, label: 'Disattivo' },
    ],
  },
  {
    key: 'personalization', icon: 'heart', titolo: 'Personalizzazione',
    values: [
      { value: true, label: 'Attiva' },
      { value: false, label: 'Disattiva' },
    ],
  },
];

function compatibilita(prefs, next) {
  const legacyMix = next.contentMix === 'moreVideo' ? 'video'
    : next.contentMix === 'moreArticles' ? 'articoli' : 'entrambi';
  return {
    ...prefs,
    mondoSettings: next,
    // Ponte temporaneo: i componenti non ancora migrati leggono queste
    // chiavi. Non sono piu mostrate come impostazioni tecniche.
    mondoFeedFiltro: legacyMix,
    mondoTitoli: next.titles === 'original' ? 'originali' : 'tradotti',
    mondoAutoplayVideo: next.autoplayVideo,
    mondoPersonalizza: next.personalization,
    mondoBreaking: next.breaking,
  };
}

export default function PreferenzeMondo({ C }) {
  const { L, prefs, savePrefs } = useApp();
  const settings = settingsDaPrefs(prefs);
  const accento = C?.accent || '#26D9B0';

  const cambia = (opzione) => {
    const values = opzione.values;
    const current = values.findIndex((v) => v.value === settings[opzione.key]);
    const nextValue = values[(Math.max(0, current) + 1) % values.length].value;
    const next = { ...settings, [opzione.key]: nextValue };
    vibrate(6);
    savePrefs(compatibilita(prefs, next));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', fontFamily: FONT }}>
      {OPZIONI.map((o, i) => {
        const attuale = o.values.find((v) => v.value === settings[o.key]) || o.values[0];
        const titolo = o.titoloKey ? L(o.titoloKey) : o.titolo;
        const valore = attuale.labelKey ? L(attuale.labelKey) : attuale.label;
        return (
          <button key={o.key} onClick={() => cambia(o)}
            aria-label={`${titolo}: ${valore}`}
            style={{
              width: '100%', minHeight: 58, padding: '8px 2px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
              background: 'none', border: 'none',
              borderBottom: i < OPZIONI.length - 1 ? `1px solid ${C?.cardBorder || 'rgba(255,255,255,.08)'}` : 'none',
              fontFamily: FONT,
            }}>
            <span style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `${accento}12`, border: `1px solid ${accento}33` }}>
              <Icon name={o.icon} size={17} color={accento} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: C?.textSecondary || '#d9e4f5' }}>{titolo}</span>
              <span style={{ display: 'inline-block', marginTop: 4, padding: '2px 8px', borderRadius: 999,
                background: 'rgba(140,88,48,0.34)', border: '1px solid rgba(206,146,92,0.42)',
                color: C?.textPrimary || '#fff', fontSize: 10.5, fontWeight: 500 }}>{valore}</span>
            </span>
            <Icon name="chevRight" size={15} color={C?.textMuted || 'rgba(255,255,255,.55)'} />
          </button>
        );
      })}
    </div>
  );
}
