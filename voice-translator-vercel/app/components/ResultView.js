'use client';
import { memo, useState, useCallback } from 'react';
import { getLang, FONT } from '../lib/constants.js';
import AvatarImg from './AvatarImg.js';

/**
 * ResultView — P4 Schermata 3: Translation Result
 *
 * Shows the result of a translation with:
 * - Original text and translation side by side
 * - Confidence score indicator
 * - Action buttons: copy, share, save, TTS, Taxi Mode
 * - AI suggestions for alternative translations
 * - Quick actions: edit, retry, send to contact
 */
const ResultView = memo(function ResultView({
  L, S, theme,
  originalText = '',
  translatedText = '',
  sourceLang = 'it',
  targetLang = 'en',
  confidence = null,
  alternativeTranslations = [],
  onCopy, onShare, onSave, onPlayTTS, onTaxiMode,
  onRetry, onEdit, onSendToContact,
  onBack, contacts = [],
  prefs = {},
}) {
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSendPicker, setShowSendPicker] = useState(false);

  const srcLang = getLang(sourceLang);
  const tgtLang = getLang(targetLang);

  const handleCopy = useCallback(() => {
    if (onCopy) onCopy(translatedText);
    else navigator.clipboard?.writeText(translatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [translatedText, onCopy]);

  const confidenceColor = confidence >= 90 ? S.colors.statusOk
    : confidence >= 70 ? S.colors.statusWarning
    : confidence >= 0 ? S.colors.statusError
    : S.colors.textMuted;

  return (
    <div style={{
      ...S.page, padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16,
      minHeight: '100vh', boxSizing: 'border-box',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
        <button onClick={onBack}
          style={{
            background: S.colors.overlayBg, border: `1px solid ${S.colors.overlayBorder}`,
            borderRadius: 12, padding: '8px 12px', cursor: 'pointer',
            color: S.colors.textPrimary, fontSize: 16, display: 'flex', alignItems: 'center',
          }}>
          ←
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ color: S.colors.textPrimary, fontSize: 18, fontWeight: 700, margin: 0 }}>
            Risultato Traduzione
          </h2>
          <div style={{ color: S.colors.textMuted, fontSize: 12, marginTop: 2 }}>
            {srcLang.flag} {srcLang.name} → {tgtLang.flag} {tgtLang.name}
          </div>
        </div>
        {confidence !== null && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '6px 12px', borderRadius: 12,
            background: `${confidenceColor}15`, border: `1px solid ${confidenceColor}30`,
          }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: confidenceColor }}>{confidence}%</span>
            <span style={{ fontSize: 9, color: S.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              confidence
            </span>
          </div>
        )}
      </div>

      {/* Original Text Card */}
      <div style={{
        padding: 16, borderRadius: 16,
        background: S.colors.cardBg, border: `1px solid ${S.colors.cardBorder}`,
        boxShadow: S.colors.cardShadow,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 20 }}>{srcLang.flag}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: S.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Originale
          </span>
        </div>
        <p style={{
          color: S.colors.textPrimary, fontSize: 16, lineHeight: 1.6, margin: 0,
          fontFamily: FONT,
        }}>
          {originalText || 'Nessun testo originale'}
        </p>
      </div>

      {/* Translation Card */}
      <div style={{
        padding: 16, borderRadius: 16,
        background: S.colors.accent1Bg, border: `1px solid ${S.colors.accent1Border}`,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Gradient accent bar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: S.colors.accentGradient,
        }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 4 }}>
          <span style={{ fontSize: 20 }}>{tgtLang.flag}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: S.colors.accent1, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Traduzione
          </span>
        </div>
        <p style={{
          color: S.colors.textPrimary, fontSize: 18, lineHeight: 1.6, margin: 0,
          fontWeight: 600, fontFamily: FONT,
        }}>
          {translatedText || 'Traduzione in corso...'}
        </p>
      </div>

      {/* Action Buttons */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10,
      }}>
        {[
          { icon: copied ? '✓' : '📋', label: copied ? 'Copiato!' : 'Copia', action: handleCopy, active: copied },
          { icon: '🔊', label: 'Ascolta', action: onPlayTTS },
          { icon: '🚕', label: 'Taxi', action: onTaxiMode },
          { icon: '💾', label: 'Salva', action: onSave },
        ].map((btn, i) => (
          <button key={i} onClick={btn.action}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              padding: '12px 8px', borderRadius: 14, cursor: 'pointer',
              background: btn.active ? S.colors.accent4Bg : S.colors.overlayBg,
              border: `1px solid ${btn.active ? S.colors.accent4Border : S.colors.overlayBorder}`,
              color: S.colors.textPrimary, transition: 'all 0.2s',
            }}>
            <span style={{ fontSize: 22 }}>{btn.icon}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: S.colors.textSecondary }}>{btn.label}</span>
          </button>
        ))}
      </div>

      {/* Secondary Actions */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onRetry}
          style={{
            flex: 1, padding: '12px 16px', borderRadius: 14, cursor: 'pointer',
            background: S.colors.overlayBg, border: `1px solid ${S.colors.overlayBorder}`,
            color: S.colors.textPrimary, fontSize: 13, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
          🔄 Riprova
        </button>
        <button onClick={onEdit}
          style={{
            flex: 1, padding: '12px 16px', borderRadius: 14, cursor: 'pointer',
            background: S.colors.overlayBg, border: `1px solid ${S.colors.overlayBorder}`,
            color: S.colors.textPrimary, fontSize: 13, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
          ✏️ Modifica
        </button>
        <button onClick={() => setShowSendPicker(!showSendPicker)}
          style={{
            flex: 1, padding: '12px 16px', borderRadius: 14, cursor: 'pointer',
            background: S.colors.accent2Bg, border: `1px solid ${S.colors.accent2Border}`,
            color: S.colors.accent2, fontSize: 13, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
          📤 Invia
        </button>
      </div>

      {/* Send to Contact Picker */}
      {showSendPicker && contacts.length > 0 && (
        <div style={{
          padding: 12, borderRadius: 16,
          background: S.colors.cardBg, border: `1px solid ${S.colors.cardBorder}`,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: S.colors.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Invia a contatto
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {contacts.slice(0, 5).map((c, i) => (
              <button key={i} onClick={() => { if (onSendToContact) onSendToContact(c); setShowSendPicker(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  borderRadius: 12, background: S.colors.overlayBg, border: 'none',
                  cursor: 'pointer', color: S.colors.textPrimary, fontSize: 13,
                }}>
                <AvatarImg src={c.avatar} size={32} />
                <span style={{ fontWeight: 600 }}>{c.name}</span>
                <span style={{ marginLeft: 'auto', fontSize: 16 }}>{getLang(c.lang || 'en').flag}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* AI Alternatives */}
      {alternativeTranslations.length > 0 && (
        <div style={{
          padding: 14, borderRadius: 16,
          background: S.colors.cardBg, border: `1px solid ${S.colors.cardBorder}`,
        }}>
          <button onClick={() => setShowAlternatives(!showAlternatives)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              background: 'none', border: 'none', cursor: 'pointer',
              color: S.colors.textPrimary, fontSize: 13, fontWeight: 600, padding: 0,
            }}>
            <span>✨ Traduzioni alternative AI</span>
            <span style={{ marginLeft: 'auto', color: S.colors.textMuted, fontSize: 16, transition: 'transform 0.2s',
              transform: showAlternatives ? 'rotate(180deg)' : 'rotate(0)' }}>▾</span>
          </button>
          {showAlternatives && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {alternativeTranslations.map((alt, i) => (
                <div key={i} style={{
                  padding: '10px 12px', borderRadius: 12,
                  background: S.colors.overlayBg, border: `1px solid ${S.colors.overlayBorder}`,
                  fontSize: 14, color: S.colors.textSecondary, lineHeight: 1.5,
                  cursor: 'pointer',
                }} onClick={() => { if (onCopy) onCopy(alt); else navigator.clipboard?.writeText(alt); }}>
                  {alt}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default ResultView;
