'use client';
import { memo, useState, useCallback } from 'react';
import { FONT, LANGS, getLang, vibrate } from '../lib/constants.js';
import useSheetA11y from '../hooks/useSheetA11y.js';

// ═══════════════════════════════════════════════════════════════
// CreateRoomSheet — Create a Community BarTalk room
//
// Room types: public, protected, private, temporary
// Categories: conversation, classroom, interview, conference, freetalk
// Fields: name, description, language, type, category, max participants
// ═══════════════════════════════════════════════════════════════

const ROOM_TYPES = [
  { id: 'public', icon: '🌍', label: 'Pubblico', desc: 'Chiunque può entrare e partecipare' },
  { id: 'protected', icon: '🔒', label: 'Protetto', desc: 'Richiede approvazione per entrare' },
  { id: 'private', icon: '🔐', label: 'Privato', desc: 'Solo su invito diretto' },
  { id: 'temporary', icon: '⏱️', label: 'Temporaneo', desc: 'Si chiude automaticamente dopo 1 ora' },
];

const CATEGORIES = [
  { id: 'conversation', icon: '💬', label: 'Conversazione', color: '#26D9B0' },
  { id: 'classroom', icon: '🏫', label: 'Classroom', color: '#10B981' },
  { id: 'interview', icon: '🎤', label: 'Intervista', color: '#F59E0B' },
  { id: 'conference', icon: '🏛️', label: 'Conferenza', color: '#8B5CF6' },
  { id: 'freetalk', icon: '🎉', label: 'Free Talk', color: '#EC4899' },
];

const POPULAR_LANGS = ['it', 'en', 'es', 'fr', 'de', 'pt', 'zh', 'ja', 'ko', 'ar'];

function CreateRoomSheet({ open, onClose, onCreate, S }) {
  const C = S?.colors || {};
  const accent = C.accent1 || '#26D9B0';
  const purple = C.accent2 || '#8B6AFF';
  const cardBg = C.glassCard || 'rgba(12,16,30,0.65)';
  const cardBorder = C.cardBorder || 'rgba(255,255,255,0.05)';
  const textPrimary = C.textPrimary || '#F2F4F7';
  const textMuted = C.textMuted || 'rgba(242,244,247,0.60)';
  const inputBg = C.inputBg || 'rgba(14,18,32,0.6)';

  const [roomType, setRoomType] = useState('public');
  const [category, setCategory] = useState('conversation');
  const [lang, setLang] = useState('it');
  const [description, setDescription] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(20);
  const [creating, setCreating] = useState(false);
  const sheetRef = useSheetA11y(open, onClose);

  const handleCreate = useCallback(async () => {
    vibrate(20);
    setCreating(true);
    try {
      await onCreate({
        roomType,
        category,
        lang,
        description: description.trim(),
        maxParticipants,
        mode: category, // maps to existing room modes
      });
      onClose();
    } catch (e) {
      console.warn('[CreateRoom] Failed:', e?.message);
    }
    setCreating(false);
  }, [roomType, category, lang, description, maxParticipants, onCreate, onClose]);

  if (!open) return null;

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 10,
    background: inputBg, border: `1px solid ${cardBorder}`,
    color: textPrimary, fontSize: 13, fontFamily: FONT, outline: 'none',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 70,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
       role="dialog" aria-modal="true" aria-label="Crea un BarTalk">

      <div ref={sheetRef} style={{
        background: C.bg || '#060810', borderRadius: '20px 20px 0 0',
        maxHeight: '90dvh', display: 'flex', flexDirection: 'column',
        animation: 'crsSlideUp 0.3s ease-out',
      }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 6px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
        </div>

        {/* Header */}
        <div style={{ padding: '0 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: textPrimary, fontFamily: FONT }}>
              🌍 Crea un BarTalk
            </div>
            <div style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>
              Un tavolo virtuale internazionale
            </div>
          </div>
          <button onClick={onClose} aria-label="Chiudi" style={{
            width: 36, height: 36, borderRadius: 10, cursor: 'pointer',
            background: cardBg, border: `1px solid ${cardBorder}`,
            color: textMuted, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px', scrollbarWidth: 'none' }}>

          {/* Room Type */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: textMuted, marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Tipo di stanza
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {ROOM_TYPES.map(rt => {
                const sel = roomType === rt.id;
                return (
                  <button key={rt.id} onClick={() => { setRoomType(rt.id); vibrate(10); }} style={{
                    padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
                    background: sel ? `${accent}10` : cardBg,
                    border: `1px solid ${sel ? `${accent}30` : cardBorder}`,
                    textAlign: 'left', fontFamily: FONT,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 16 }}>{rt.icon}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: sel ? accent : textPrimary }}>{rt.label}</span>
                    </div>
                    <div style={{ fontSize: 10, color: textMuted, lineHeight: 1.4 }}>{rt.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: textMuted, marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Categoria
            </label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {CATEGORIES.map(cat => {
                const sel = category === cat.id;
                return (
                  <button key={cat.id} onClick={() => { setCategory(cat.id); vibrate(10); }} style={{
                    padding: '7px 14px', borderRadius: 10, cursor: 'pointer',
                    background: sel ? `${cat.color}15` : 'transparent',
                    border: `1px solid ${sel ? `${cat.color}30` : cardBorder}`,
                    display: 'flex', alignItems: 'center', gap: 5, fontFamily: FONT,
                  }}>
                    <span style={{ fontSize: 14 }}>{cat.icon}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: sel ? cat.color : textPrimary }}>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Language */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: textMuted, marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Lingua principale
            </label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {POPULAR_LANGS.map(code => {
                const info = getLang(code);
                const sel = lang === code;
                return (
                  <button key={code} onClick={() => { setLang(code); vibrate(10); }} style={{
                    padding: '6px 12px', borderRadius: 10, cursor: 'pointer',
                    background: sel ? `${accent}12` : 'transparent',
                    border: `1px solid ${sel ? `${accent}25` : cardBorder}`,
                    display: 'flex', alignItems: 'center', gap: 4, fontFamily: FONT,
                  }}>
                    <span style={{ fontSize: 16 }}>{info?.flag}</span>
                    <span style={{ fontSize: 10, fontWeight: sel ? 700 : 500, color: sel ? accent : textPrimary }}>
                      {info?.name || code}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: textMuted, marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Descrizione (opzionale)
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Di cosa si parlerà in questa stanza?"
              rows={2}
              maxLength={200}
              style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }}
            />
            <div style={{ fontSize: 9, color: textMuted, textAlign: 'right', marginTop: 2 }}>
              {description.length}/200
            </div>
          </div>

          {/* Max participants */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: textMuted, marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Partecipanti max
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[5, 10, 20, 50].map(n => {
                const sel = maxParticipants === n;
                return (
                  <button key={n} onClick={() => { setMaxParticipants(n); vibrate(10); }} style={{
                    padding: '8px 16px', borderRadius: 10, cursor: 'pointer',
                    background: sel ? `${purple}15` : 'transparent',
                    border: `1px solid ${sel ? `${purple}30` : cardBorder}`,
                    color: sel ? purple : textPrimary,
                    fontSize: 13, fontWeight: sel ? 700 : 500, fontFamily: FONT,
                  }}>
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Create button */}
        <div style={{ padding: '12px 20px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <button onClick={handleCreate} disabled={creating} style={{
            width: '100%', padding: '14px', borderRadius: 14, cursor: creating ? 'default' : 'pointer',
            background: `linear-gradient(135deg, ${accent}, ${purple})`,
            border: 'none', color: '#fff',
            fontSize: 15, fontWeight: 700, fontFamily: FONT,
            boxShadow: `0 4px 20px ${accent}35`,
            opacity: creating ? 0.7 : 1,
          }}>
            {creating ? 'Creazione...' : '🌍 Crea BarTalk'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes crsSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
  );
}

export default memo(CreateRoomSheet);
