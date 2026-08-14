'use client';
import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { FONT, vibrate } from '../lib/constants.js';
import useSheetA11y from '../hooks/useSheetA11y.js';
import { PALETTE } from '../lib/palette.js';
import { useApp } from '../contexts/AppContext.js';

// ═══════════════════════════════════════════════════════════════
// TaxiDestinationPanel — Structured destination form for TaxiTalk
//
// Fields: address search, terminal, entrance, stops, flightNumber,
// hotelName, notes. Geocoding via Nominatim.
// Output: structured destination object with lat/lng + metadata.
// ═══════════════════════════════════════════════════════════════

const FIELD_CONFIG = [
  // b.139 — etichette e segnaposto erano in italiano dentro la tabella, che
  // nasce col modulo. Ora sono chiavi: si traducono quando si disegna il campo.
  { key: 'terminal', icon: '', label: 'destTerminal', placeholder: 'destTerminalPh' },
  { key: 'entrance', icon: '', label: 'destEntrance', placeholder: 'destEntrancePh' },
  { key: 'hotelName', icon: '', label: 'destHotel', placeholder: 'destHotelPh' },
  { key: 'flightNumber', icon: '', label: 'destFlight', placeholder: 'destFlightPh' },
  { key: 'notes', icon: '', label: 'destNotes', placeholder: 'destNotesPh' },
];

function TaxiDestinationPanel({ onDestinationReady, onClose, targetLang, S }) {
  // b.138 — errori di ricerca ed etichette erano in italiano fisso.
  const { L } = useApp();
  const C = S?.colors || {};
  const accent = C.accent1 || PALETTE.teal;
  const purple = C.accent2 || PALETTE.violet;
  const cardBg = C.glassCard || 'rgba(12,16,30,0.65)';
  const cardBorder = C.cardBorder || 'rgba(255,255,255,0.05)';
  const textPrimary = C.textPrimary || PALETTE.grayLight;
  const textMuted = C.textMuted || 'rgba(242,244,247,0.60)';
  const inputBg = C.inputBg || 'rgba(14,18,32,0.6)';

  // ── State ──
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [details, setDetails] = useState({
    terminal: '', entrance: '', hotelName: '', flightNumber: '', notes: '',
  });
  const [stops, setStops] = useState([]);
  const [newStop, setNewStop] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const searchTimerRef = useRef(null);
  const sheetRef = useSheetA11y(true, onClose);

  // ── Debounced search ──
  const doSearch = useCallback(async (q) => {
    if (!q || q.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true); setSearchError('');
    try {
      const encoded = encodeURIComponent(q.trim());
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=5&addressdetails=1`,
        { headers: { 'Accept-Language': targetLang || 'en' } }
      );
      if (!res.ok) throw new Error('Geocoding failed');
      const data = await res.json();
      if (data.length === 0) setSearchError(L('noResultFound'));
      setSearchResults(data.map(p => ({
        lat: parseFloat(p.lat), lon: parseFloat(p.lon),
        displayName: p.display_name, type: p.type || '',
        address: p.address || {},
      })));
    } catch { setSearchError(L('searchError')); }
    setSearching(false);
  }, [targetLang, L]);

  const handleQueryChange = useCallback((val) => {
    setQuery(val);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => doSearch(val), 500);
  }, [doSearch]);

  useEffect(() => () => clearTimeout(searchTimerRef.current), []);

  // ── Select place ──
  const selectPlace = useCallback((place) => {
    vibrate(15);
    setSelectedPlace(place);
    setSearchResults([]);
    setQuery(place.displayName.split(',').slice(0, 3).join(','));
  }, []);

  // ── Add stop ──
  const addStop = useCallback(() => {
    if (!newStop.trim()) return;
    setStops(prev => [...prev, newStop.trim()]);
    setNewStop('');
  }, [newStop]);

  const removeStop = useCallback((idx) => {
    setStops(prev => prev.filter((_, i) => i !== idx));
  }, []);

  // ── Confirm destination ──
  const handleConfirm = useCallback(() => {
    if (!selectedPlace) return;
    vibrate(20);
    const destination = {
      destinationName: query,
      originalAddress: selectedPlace.displayName,
      normalizedAddress: selectedPlace.displayName.split(',').slice(0, 3).join(', '),
      lat: selectedPlace.lat,
      lng: selectedPlace.lon,
      terminal: details.terminal || null,
      entrance: details.entrance || null,
      stops: stops.length > 0 ? stops : null,
      flightNumber: details.flightNumber || null,
      hotelName: details.hotelName || null,
      notes: details.notes || null,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours
    };
    onDestinationReady(destination);
  }, [selectedPlace, query, details, stops, onDestinationReady]);

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 10,
    background: inputBg, border: `1px solid ${cardBorder}`,
    color: textPrimary, fontSize: 13, fontFamily: FONT,
    outline: 'none',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 70,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
       role="dialog" aria-modal="true" aria-label={L('taxiDestination')}>

      <div ref={sheetRef} style={{
        background: C.bg || PALETTE.bgDeep, borderRadius: '20px 20px 0 0',
        maxHeight: '85dvh', display: 'flex', flexDirection: 'column',
        animation: 'tdpSlideUp 0.3s ease-out',
      }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 6px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
        </div>

        {/* Header */}
        <div style={{ padding: '0 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: textPrimary, fontFamily: FONT }}>
              Dove vai?
            </div>
            <div style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>
              Inserisci la destinazione per il tassista
            </div>
          </div>
          <button onClick={onClose} aria-label={L('closeWord')} style={{
            width: 36, height: 36, borderRadius: 10, cursor: 'pointer',
            background: cardBg, border: `1px solid ${cardBorder}`,
            color: textMuted, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px', scrollbarWidth: 'none' }}>

          {/* Address search */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: textMuted, marginBottom: 4, display: 'block' }}>
              Indirizzo destinazione
            </label>
            <div style={{ position: 'relative' }}>
              <input type="text" value={query} onChange={e => handleQueryChange(e.target.value)}
                placeholder={L('searchAddress')}
                style={{ ...inputStyle, paddingRight: 36 }}
              />
              {searching && (
                <div style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  width: 16, height: 16, borderRadius: '50%',
                  border: `2px solid ${accent}30`, borderTopColor: accent,
                  animation: 'tdpSpin 0.6s linear infinite',
                }} />
              )}
            </div>

            {/* Search results */}
            {searchResults.length > 0 && (
              <div style={{
                marginTop: 6, borderRadius: 12, overflow: 'hidden',
                border: `1px solid ${cardBorder}`, background: cardBg,
              }}>
                {searchResults.map((r, i) => (
                  <button key={i} onClick={() => selectPlace(r)} style={{
                    width: '100%', padding: '10px 14px', cursor: 'pointer',
                    background: 'none', border: 'none', borderBottom: i < searchResults.length - 1 ? `1px solid ${cardBorder}` : 'none',
                    color: textPrimary, fontSize: 12, fontFamily: FONT,
                    textAlign: 'left', lineHeight: 1.4,
                  }}>
                    <div style={{ fontWeight: 600 }}>{r.displayName.split(',').slice(0, 2).join(',')}</div>
                    <div style={{ fontSize: 10, color: textMuted, marginTop: 2 }}>
                      {r.displayName.split(',').slice(2, 5).join(',')}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {searchError && (
              <div style={{ fontSize: 11, color: PALETTE.coral, marginTop: 4, padding: '0 4px' }}>
                {searchError}
              </div>
            )}
          </div>

          {/* Selected place confirmation */}
          {selectedPlace && (
            <div style={{
              padding: '12px 14px', borderRadius: 14, marginBottom: 12,
              background: `${accent}08`, border: `1px solid ${accent}20`,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 20 }}></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>
                  {selectedPlace.displayName.split(',').slice(0, 2).join(',')}
                </div>
                <div style={{ fontSize: 10, color: textMuted, marginTop: 1 }}>
                  {selectedPlace.lat.toFixed(5)}, {selectedPlace.lon.toFixed(5)}
                </div>
              </div>
              <button onClick={() => { setSelectedPlace(null); setQuery(''); }} style={{
                background: 'none', border: 'none', color: textMuted, cursor: 'pointer', fontSize: 14,
              }}>✕</button>
            </div>
          )}

          {/* Toggle details */}
          <button onClick={() => setShowDetails(!showDetails)} style={{
            width: '100%', padding: '10px 14px', borderRadius: 12, cursor: 'pointer',
            background: cardBg, border: `1px solid ${cardBorder}`,
            color: textPrimary, fontSize: 12, fontWeight: 600, fontFamily: FONT,
            textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: showDetails ? 12 : 0,
          }}>
            <span>{L('extraDetails')}</span>
            <span style={{ fontSize: 10, transition: 'transform 0.2s', transform: showDetails ? 'rotate(180deg)' : 'none' }}>▼</span>
          </button>

          {/* Detail fields */}
          {showDetails && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {FIELD_CONFIG.map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: textMuted, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>{f.icon}</span> {L(f.label)}
                  </label>
                  <input type="text" value={details[f.key]} onChange={e => setDetails(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={L(f.placeholder)} style={inputStyle}
                  />
                </div>
              ))}

              {/* Stops */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: textMuted, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span></span> Fermate intermedie
                </label>
                {stops.map((stop, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4,
                    padding: '6px 10px', borderRadius: 8,
                    background: `${purple}10`, border: `1px solid ${purple}20`,
                  }}>
                    <span style={{ fontSize: 10, color: purple, fontWeight: 700 }}>{i + 1}</span>
                    <span style={{ flex: 1, fontSize: 12, color: textPrimary }}>{stop}</span>
                    <button onClick={() => removeStop(i)} style={{
                      background: 'none', border: 'none', color: textMuted, cursor: 'pointer', fontSize: 12,
                    }}>✕</button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 6 }}>
                  <input type="text" value={newStop} onChange={e => setNewStop(e.target.value)}
                    placeholder={L('addStop')}
                    style={{ ...inputStyle, flex: 1 }}
                    onKeyDown={e => { if (e.key === 'Enter') addStop(); }}
                  />
                  <button onClick={addStop} disabled={!newStop.trim()} style={{
                    padding: '8px 14px', borderRadius: 10, cursor: newStop.trim() ? 'pointer' : 'not-allowed',
                    background: newStop.trim() ? `${purple}20` : 'transparent',
                    border: `1px solid ${newStop.trim() ? `${purple}30` : cardBorder}`,
                    color: newStop.trim() ? purple : textMuted,
                    fontSize: 12, fontWeight: 700, fontFamily: FONT,
                  }}>+</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Confirm button */}
        <div style={{ padding: '12px 20px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <button onClick={handleConfirm} disabled={!selectedPlace} style={{
            width: '100%', padding: '14px', borderRadius: 14, cursor: selectedPlace ? 'pointer' : 'not-allowed',
            background: selectedPlace
              ? `linear-gradient(135deg, ${accent}, ${purple})`
              : 'rgba(255,255,255,0.06)',
            border: 'none', color: selectedPlace ? '#fff' : textMuted,
            fontSize: 15, fontWeight: 700, fontFamily: FONT,
            boxShadow: selectedPlace ? `0 4px 20px ${accent}35` : 'none',
          }}>
            {selectedPlace ? L('generateDestQR') : L('selectDestination')}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes tdpSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes tdpSpin { to { transform: translateY(-50%) rotate(360deg); } }
      `}</style>
    </div>
  );
}

export default memo(TaxiDestinationPanel);
