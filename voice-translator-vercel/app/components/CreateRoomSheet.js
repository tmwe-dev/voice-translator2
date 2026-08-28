'use client';
import { memo, useState, useCallback, useEffect } from 'react';
import { FONT, getLang, vibrate } from '../lib/constants.js';
import useSheetA11y from '../hooks/useSheetA11y.js';
import { PALETTE } from '../lib/palette.js';
import { useApp } from '../contexts/AppContext.js';
import { TIPI_STANZA, CAPIENZA, normalizzaCapienza } from '../lib/decisioni.js';

// ═══════════════════════════════════════════════════════════════
// CreateRoomSheet — Create a Community BarTalk room
//
// Room types: public, protected, private, temporary
// Categories: conversation, classroom, interview, conference, freetalk
// Fields: name, description, language, type, category, max participants
// ═══════════════════════════════════════════════════════════════

// b.139 — qui c'erano le etichette scritte in italiano dentro la tabella.
// Una tabella si costruisce UNA volta, al caricamento del modulo, quando la
// lingua dell'utente non e ancora nota: percio ora contiene le CHIAVI, e la
// traduzione avviene al disegno, dove L() c'e ed e aggiornata.
// b.139-bis — gli identificativi non sono piu scritti qui: erano una
// seconda copia di quelli che /api/mondo accetta, e due elenchi separati
// della stessa cosa divergono al primo tipo aggiunto da una parte sola.
// Qui restano solo le etichette, che il server non ha mai avuto.
const ETICHETTE_TIPO = {
  public: { label: 'roomTypePublic', desc: 'roomTypePublicDesc' },
  protected: { label: 'roomTypeProtected', desc: 'roomTypeProtectedDesc' },
  private: { label: 'roomTypePrivate', desc: 'roomTypePrivateDesc' },
  temporary: { label: 'roomTypeTemporary', desc: 'roomTypeTemporaryDesc' },
};
const ROOM_TYPES = TIPI_STANZA.map((id) => ({ id, icon: '', ...ETICHETTE_TIPO[id] }));

const CATEGORIES = [
  { id: 'conversation', icon: '', label: 'catConversation', color: PALETTE.teal },
  { id: 'classroom', icon: '', label: 'Classroom', color: '#10B981' },
  // b.126 — 'interview' e 'conference' TOLTE.
  //
  // Si potevano scegliere qui, la stanza nasceva con quel `mode`, e poi
  // TalkControls non trovava nessun percorso per quella modalita: niente
  // comandi vocali, e nessuna spiegazione. MODES (constants.js) conosce
  // solo conversation, classroom, freetalk e simultaneous.
  //
  // Fra "implementarle davvero" e "toglierle dalla UI" ho scelto la
  // seconda: aggiungerle a MODES facendole comportare come un'altra
  // modalita vorrebbe dire inventare un prodotto per far tacere un
  // difetto. Offrire una scelta che non funziona e peggio che non
  // offrirla — chi la sceglie non capisce cosa ha sbagliato.
  //
  // Se un giorno servono davvero, si aggiungono qui E in MODES E in
  // TalkControls, insieme.
  // 'Classroom' e 'Free Talk' restano cosi: sono nomi propri della modalita,
  // scritti uguali in ogni lingua dell'interfaccia.
  { id: 'freetalk', icon: '', label: 'Free Talk', color: '#EC4899' },
];

const POPULAR_LANGS = ['it', 'en', 'es', 'fr', 'de', 'pt', 'zh', 'ja', 'ko', 'ar'];

function CreateRoomSheet({ open, onClose, onCreate, preimpostato }) {
  const { S, L } = useApp();
  const C = S?.colors || {};
  const accent = C.accent1 || PALETTE.teal;
  const purple = C.accent2 || PALETTE.violet;
  const cardBg = C.glassCard || 'rgba(12,16,30,0.65)';
  const cardBorder = C.cardBorder || 'rgba(255,255,255,0.05)';
  const textPrimary = C.textPrimary || PALETTE.grayLight;
  const textMuted = C.textMuted || 'rgba(242,244,247,0.60)';
  const inputBg = C.inputBg || 'rgba(14,18,32,0.6)';

  // Il nome e OBBLIGATORIO: e la prima e spesso l'unica cosa che una
  // persona legge nell'elenco. Una stanza senza nome non si sceglie.
  const [nome, setNome] = useState('');
  const [roomType, setRoomType] = useState('public');
  const [category, setCategory] = useState('conversation');
  const [lang, setLang] = useState('it');
  const [description, setDescription] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(CAPIENZA.PREDEFINITA);
  const [creating, setCreating] = useState(false);
  // b.111 — stanza a litigio libero. Spenta di default: e una scelta,
  // e le scelte che cambiano le regole non si fanno per distrazione.
  const [hot, setHot] = useState(false);
  // b.113 — Stanza Diretta: niente nuvola, per davvero. Spenta di suo:
  // toglie la traduzione, che e il motivo per cui quasi tutti sono qui.
  const [diretta, setDiretta] = useState(false);
  // b.289 — la scelta dell'host: offre lui (default) o ognuno paga il suo
  const [ognunoPagaIlSuo, setOgnunoPagaIlSuo] = useState(false);
  const sheetRef = useSheetA11y(open, onClose);

  // b.147 — "Parlane": una card News apre questo foglio con nome e
  // descrizione gia scritti. Si applica all'APERTURA, non a ogni
  // disegno: quello che l'utente corregge a mano non va riscritto.
  useEffect(() => {
    if (open && preimpostato?.nome) {
      setNome(preimpostato.nome.slice(0, 60));
      if (preimpostato.descrizione) setDescription(preimpostato.descrizione.slice(0, 200));
    }
  }, [open, preimpostato]);

  const nomePulito = nome.trim();
  const nomeValido = nomePulito.length >= 3;

  const handleCreate = useCallback(async () => {
    if (!nomeValido) return;
    vibrate(20);
    setCreating(true);
    try {
      await onCreate({
        nome: nomePulito,
        roomType,
        category,
        lang,
        description: description.trim(),
        // ── b.126 · la Diretta e SOLO uno-a-uno ──
        //
        // Si poteva creare una stanza pubblica, "Diretta", fino a 20
        // partecipanti. Ma useWebRTC ha un solo `pcRef` e un solo
        // `dcRef`: una connessione, un canale. Il modello reale e
        // 1 telefono <-> 1 telefono, e la UI ne prometteva 1 <-> 19.
        //
        // Il terzo che entrava in una stanza Diretta non riceveva
        // niente e non poteva mandare niente — dentro una stanza che
        // gli prometteva riservatezza. Nessun errore: solo silenzio.
        //
        // Fra "costruire il multiparte" (che vuol dire N connessioni o
        // un relay, e in un relay la promessa "niente passa dai nostri
        // server" cambia significato) e "dichiarare 1:1", la seconda e
        // onesta e si puo fare oggi.
        maxParticipants: normalizzaCapienza(maxParticipants, { diretta }),
        hot,
        diretta,
        ognunoPagaIlSuo,
        mode: category, // maps to existing room modes
      });
      onClose();
    } catch (e) {
      console.warn('[CreateRoom] Failed:', e?.message);
    }
    setCreating(false);
  }, [nomePulito, nomeValido, roomType, category, lang, description, maxParticipants, hot, diretta, ognunoPagaIlSuo, onCreate, onClose]);

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
       role="dialog" aria-modal="true" aria-label={L('createBarTalk')}>

      <div ref={sheetRef} style={{
        background: C.bg || PALETTE.bgDeep, borderRadius: '20px 20px 0 0',
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
            <div style={{ fontSize: 18, fontWeight: 500, color: textPrimary, fontFamily: FONT }}>
              {L('createBarTalk')}
            </div>
            <div style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>
              {L('virtualTable')}
            </div>
          </div>
          <button onClick={onClose} aria-label={L('closeWord')} style={{
            width: 44, height: 44, borderRadius: 12, cursor: 'pointer',
            background: cardBg, border: `1px solid ${cardBorder}`,
            color: textMuted, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px', scrollbarWidth: 'none' }}>

          {/* Nome o argomento — obbligatorio, e la prima cosa che si legge */}
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="stanza-nome" style={{ fontSize: 11, fontWeight: 500, color: textMuted, marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {L('roomNameOrTopic')}
            </label>
            {/* b.324 — audit Mondo D7: il focus iniziale cadeva sulla X e le
                prime lettere digitate si perdevano. Ora si parte dal nome. */}
            <input id="stanza-nome" type="text" value={nome} maxLength={60} autoFocus
              onChange={(e) => setNome(e.target.value)}
              placeholder={L('roomNamePlaceholder')}
              style={{
                ...inputStyle,
                border: `1px solid ${nomeValido || !nome ? cardBorder : `${C.accent3 || '#e5484d'}66`}`,
              }} />
            <div style={{ fontSize: 10, color: textMuted, marginTop: 5, lineHeight: 1.4 }}>
              {nome && !nomeValido
                ? L('roomNameTooShort')
                : L('roomNameHelp')}
            </div>
          </div>

          {/* Room Type */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 500, color: textMuted, marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {L('roomTypeLabel')}
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
                      <span style={{ fontSize: 12, fontWeight: 500, color: sel ? accent : textPrimary }}>{L(rt.label)}</span>
                    </div>
                    <div style={{ fontSize: 10, color: textMuted, lineHeight: 1.4 }}>{L(rt.desc)}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── b.113 · Stanza Diretta ──
              L'elenco di cosa si SPEGNE sta scritto per intero, e non
              in fondo in piccolo. Una promessa di riservatezza che
              nasconde il suo prezzo e una promessa che si ritorce
              contro: qui il prezzo e la traduzione, cioe la ragione per
              cui quasi tutti aprono questo programma. */}
          {/* b.289 — chi paga la traduzione: l'host offre (default) o
              ognuno paga il suo. Interruttore grande, parole semplici. */}
          <div style={{ marginBottom: 12 }}>
            <button
              onClick={() => { setOgnunoPagaIlSuo(v => !v); vibrate(10); }}
              aria-pressed={ognunoPagaIlSuo}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                background: cardBg, border: `1px solid ${cardBorder}`,
                textAlign: 'left', fontFamily: FONT, display: 'flex', gap: 10, alignItems: 'center',
              }}>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: textPrimary, marginBottom: 2 }}>
                  {L('whoPaysTitle')}
                </span>
                <span style={{ display: 'block', fontSize: 11, color: textMuted, lineHeight: 1.5 }}>
                  {ognunoPagaIlSuo ? L('whoPaysEach') : L('whoPaysHost')}
                </span>
              </span>
              <span aria-hidden="true" style={{
                width: 34, height: 20, borderRadius: 10, flexShrink: 0,
                background: ognunoPagaIlSuo ? '#F59E0B' : '#26D9B0', position: 'relative', transition: 'background .18s',
              }}>
                <span style={{
                  position: 'absolute', top: 2, left: ognunoPagaIlSuo ? 16 : 2, width: 16, height: 16,
                  borderRadius: '50%', background: '#fff', transition: 'left .18s',
                }} />
              </span>
            </button>
          </div>

          <div style={{ marginBottom: 16 }}>
            <button
              onClick={() => {
                const nuovo = !diretta;
                setDiretta(nuovo);
                // b.126 — accendendo la Diretta la stanza diventa 1:1.
                // Va detto MENTRE si sceglie, non scoperto dopo.
                if (nuovo && maxParticipants > CAPIENZA.DIRETTA) setMaxParticipants(CAPIENZA.DIRETTA);
                vibrate(10);
              }}
              aria-pressed={diretta}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                background: diretta ? 'rgba(38,217,176,0.10)' : cardBg,
                border: `1px solid ${diretta ? 'rgba(38,217,176,0.35)' : cardBorder}`,
                textAlign: 'left', fontFamily: FONT, display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
              <span aria-hidden="true" style={{
                fontSize: 13, fontWeight: 500, lineHeight: '18px', width: 18, textAlign: 'center',
                color: diretta ? '#26D9B0' : textMuted,
              }}>{diretta ? '✓' : '·'}</span>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: diretta ? '#26D9B0' : textPrimary, marginBottom: 2 }}>
                  {L('directRoomTitle')}
                </span>
                <span style={{ display: 'block', fontSize: 10, color: textMuted, lineHeight: 1.5 }}>
                  {diretta
                    ? L('directRoomOnDesc')
                    : L('directRoomOffDesc')}
                </span>
              </span>
              <span aria-hidden="true" style={{
                width: 34, height: 20, borderRadius: 10, flexShrink: 0, marginTop: 2,
                background: diretta ? '#26D9B0' : cardBorder, position: 'relative', transition: 'background .18s',
              }}>
                <span style={{
                  position: 'absolute', top: 2, left: diretta ? 16 : 2, width: 16, height: 16,
                  borderRadius: '50%', background: '#fff', transition: 'left .18s',
                }} />
              </span>
            </button>

            {diretta && (
              <div style={{
                marginTop: 8, padding: '10px 12px', borderRadius: 10,
                background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
                fontSize: 10, color: textMuted, lineHeight: 1.6,
              }}>
                <span style={{ display: 'block', fontWeight: 500, color: '#F59E0B', marginBottom: 4 }}>
                  {L('directRoomCostTitle')}
                </span>
                {L('directRoomCostBody')}
                <span style={{ display: 'block', marginTop: 5 }}>
                  {L('directRoomCostBody2')}
                </span>
              </div>
            )}
          </div>

          {/* ── b.111 · Litigio libero ── */}
          <div style={{ marginBottom: 16 }}>
            <button
              onClick={() => { setHot(!hot); vibrate(10); }}
              aria-pressed={hot}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                background: hot ? 'rgba(255,90,60,0.10)' : cardBg,
                border: `1px solid ${hot ? 'rgba(255,90,60,0.35)' : cardBorder}`,
                textAlign: 'left', fontFamily: FONT, display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
              {/* Nessuna emoji: un segno tipografico, come ovunque nell'app. */}
              <span aria-hidden="true" style={{
                fontSize: 13, fontWeight: 500, lineHeight: '18px', width: 18, textAlign: 'center',
                color: hot ? '#FF7A5C' : textMuted,
              }}>{hot ? '!' : '·'}</span>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: hot ? '#FF7A5C' : textPrimary, marginBottom: 2 }}>
                  {L('freeFightTitle')}
                </span>
                <span style={{ display: 'block', fontSize: 10, color: textMuted, lineHeight: 1.5 }}>
                  {hot
                    ? L('freeFightOnDesc')
                    : L('freeFightOffDesc')}
                </span>
              </span>
              <span aria-hidden="true" style={{
                width: 34, height: 20, borderRadius: 10, flexShrink: 0, marginTop: 2,
                background: hot ? '#FF7A5C' : cardBorder, position: 'relative', transition: 'background .18s',
              }}>
                <span style={{
                  position: 'absolute', top: 2, left: hot ? 16 : 2, width: 16, height: 16,
                  borderRadius: '50%', background: '#fff', transition: 'left .18s',
                }} />
              </span>
            </button>
          </div>

          {/* Category */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 500, color: textMuted, marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {L('categoryLabel')}
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
                    <span style={{ fontSize: 11, fontWeight: 500, color: sel ? cat.color : textPrimary }}>{L(cat.label)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Language */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 500, color: textMuted, marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {L('mainLanguage')}
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
                    <span style={{ fontSize: 10, fontWeight: sel ? 600 : 500, color: sel ? accent : textPrimary }}>
                      {info?.name || code}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 500, color: textMuted, marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {L('descriptionOptional')}
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={L('roomDescPlaceholder')}
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
            <label style={{ fontSize: 11, fontWeight: 500, color: textMuted, marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {L('maxParticipants')}
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[5, 10, 20, 50].map(n => {
                const sel = maxParticipants === n;
                return (
                  <button key={n} disabled={diretta && n > CAPIENZA.DIRETTA}
                    title={diretta && n > CAPIENZA.DIRETTA ? L('directIsOneToOne') : undefined}
                    onClick={() => { if (diretta && n > CAPIENZA.DIRETTA) return; setMaxParticipants(n); vibrate(10); }} style={{
                    opacity: diretta && n > CAPIENZA.DIRETTA ? 0.35 : 1,
                    padding: '8px 16px', borderRadius: 10, cursor: 'pointer',
                    background: sel ? `${purple}15` : 'transparent',
                    border: `1px solid ${sel ? `${purple}30` : cardBorder}`,
                    color: sel ? purple : textPrimary,
                    fontSize: 13, fontWeight: sel ? 600 : 500, fontFamily: FONT,
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
          <button onClick={handleCreate} disabled={creating || !nomeValido} style={{
            width: '100%', padding: '14px', borderRadius: 14,
            cursor: creating || !nomeValido ? 'default' : 'pointer',
            background: `linear-gradient(135deg, ${accent}, ${purple})`,
            border: 'none', color: '#fff',
            fontSize: 15, fontWeight: 500, fontFamily: FONT,
            boxShadow: `0 4px 20px ${accent}35`,
            opacity: creating || !nomeValido ? 0.45 : 1,
          }}>
            {creating ? L('creatingDots') : !nomeValido ? L('giveRoomAName') : L('createBarTalk')}
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
