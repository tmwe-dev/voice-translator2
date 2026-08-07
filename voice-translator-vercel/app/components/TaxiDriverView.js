'use client';
import Icon from './Icon.js';
import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { FONT, LANGS, getLang, vibrate } from '../lib/constants.js';
import getStyles from '../lib/styles.js';
import { decryptDestination } from '../lib/taxiCrypto.js';
import { PALETTE } from '../lib/palette.js';
import { useApp } from '../contexts/AppContext.js';
import TaxiMap from './TaxiMap.js';

// ═══════════════════════════════════════════════════════════════
// TaxiDriverView — Dedicated page for taxi drivers
//
// After scanning QR, the driver sees:
// 1. Destination in their language (auto-translated)
// 2. Map with route
// 3. Structured details (terminal, entrance, stops, etc.)
// 4. Option to start translated conversation with passenger
// ═══════════════════════════════════════════════════════════════

const DRIVER_LANGS = [
  { code: 'en', flag: '🇺🇸', name: 'English' },
  { code: 'it', flag: '🇮🇹', name: 'Italiano' },
  { code: 'es', flag: '🇪🇸', name: 'Español' },
  { code: 'fr', flag: '🇫🇷', name: 'Français' },
  { code: 'de', flag: '🇩🇪', name: 'Deutsch' },
  { code: 'pt', flag: '🇧🇷', name: 'Português' },
  { code: 'zh', flag: '🇨🇳', name: '中文' },
  { code: 'ja', flag: '🇯🇵', name: '日本語' },
  { code: 'ko', flag: '🇰🇷', name: '한국어' },
  { code: 'ar', flag: '🇸🇦', name: 'العربية' },
  { code: 'hi', flag: '🇮🇳', name: 'हिन्दी' },
  { code: 'ru', flag: '🇷🇺', name: 'Русский' },
  { code: 'tr', flag: '🇹🇷', name: 'Türkçe' },
  { code: 'th', flag: '🇹🇭', name: 'ไทย' },
  { code: 'vi', flag: '🇻🇳', name: 'Tiếng Việt' },
];

function TaxiDriverView({ destId, decryptionKey }) {
  const { L, setView, theme } = useApp();
  const _S = getStyles(theme);
  const col = _S.colors || {};
  const C = {
    // Fondo dal TEMA: prima era fisso e il tema chiaro restava nero.
    bg: col.bg || PALETTE.bgDeep,
    textPrimary: col.textPrimary || PALETTE.grayLight,
    textMuted: col.textMuted || 'rgba(242,244,247,0.60)',
    card: col.glassCard || 'rgba(12,16,30,0.65)',
    cardBorder: col.cardBorder || 'rgba(255,255,255,0.05)',
    accent: col.accent1 || PALETTE.teal,
    purple: col.accent2 || PALETTE.violet,
  };

  const [destination, setDestination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [driverLang, setDriverLang] = useState(null);
  const [showLangPicker, setShowLangPicker] = useState(true);
  const [translatedAddress, setTranslatedAddress] = useState('');
  const [translatedNotes, setTranslatedNotes] = useState('');
  const [translating, setTranslating] = useState(false);
  const [routeInfo, setRouteInfo] = useState(null);
  const [userPos, setUserPos] = useState(null);
  const [confirmed, setConfirmed] = useState(false);

  // ── Fetch + decrypt destination ──
  useEffect(() => {
    if (!destId) return;
    async function load() {
      try {
        // Check for decryption key — without it, we cannot read the destination
        if (!decryptionKey) {
          setError('Chiave di decifratura mancante. Scansiona di nuovo il QR completo.');
          setLoading(false);
          return;
        }

        const res = await fetch(`/api/taxi/destination?id=${destId}`);
        if (!res.ok) {
          if (res.status === 404) setError('Destinazione scaduta, già letta o non trovata');
          else setError('Errore nel caricamento');
          setLoading(false); return;
        }
        const { ciphertext } = await res.json();

        // Decrypt client-side — the server never saw the cleartext
        const dest = await decryptDestination(ciphertext, decryptionKey);
        setDestination(dest);

        // Try to detect driver's language from browser
        const browserLang = navigator.language?.split('-')[0] || 'en';
        const matched = DRIVER_LANGS.find(l => l.code === browserLang);
        if (matched) setDriverLang(matched.code);
      } catch (e) {
        if (e?.message?.includes('decrypt') || e?.name === 'OperationError') {
          setError('Impossibile decifrare la destinazione. Il link potrebbe essere incompleto.');
        } else {
          setError('Errore di rete');
        }
      }
      setLoading(false);
    }
    load();
  }, [destId, decryptionKey]);

  // ── Translate when driver selects language ──
  useEffect(() => {
    if (!destination || !driverLang || showLangPicker) return;
    let cancelled = false;

    async function translate() {
      setTranslating(true);
      try {
        // Translate address
        const addrRes = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: destination.normalizedAddress,
            sourceLang: 'auto', targetLang: driverLang,
            sourceLangName: 'auto', targetLangName: getLang(driverLang)?.name || driverLang,
          }),
        });
        if (addrRes.ok && !cancelled) {
          const { translated } = await addrRes.json();
          setTranslatedAddress(translated || destination.normalizedAddress);
        }

        // Translate notes if present
        if (destination.notes) {
          const notesRes = await fetch('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: destination.notes,
              sourceLang: 'auto', targetLang: driverLang,
              sourceLangName: 'auto', targetLangName: getLang(driverLang)?.name || driverLang,
            }),
          });
          if (notesRes.ok && !cancelled) {
            const { translated } = await notesRes.json();
            setTranslatedNotes(translated || destination.notes);
          }
        }
      } catch (e) {
        console.warn('[TaxiDriver] Translation failed:', e?.message);
        if (!cancelled) setTranslatedAddress(destination.normalizedAddress);
      }
      if (!cancelled) setTranslating(false);
    }
    translate();
    return () => { cancelled = true; };
  }, [destination, driverLang, showLangPicker]);

  // ── Get GPS and route ──
  useEffect(() => {
    if (!destination || showLangPicker) return;
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const pos = { lat: position.coords.latitude, lon: position.coords.longitude };
        setUserPos(pos);

        try {
          const url = `https://router.project-osrm.org/route/v1/driving/${pos.lon},${pos.lat};${destination.lng},${destination.lat}?overview=full&steps=true`;
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            if (data.routes?.[0]) {
              const route = data.routes[0];
              setRouteInfo({
                distKm: (route.distance / 1000).toFixed(1),
                durationMin: Math.round(route.duration / 60),
                steps: route.legs?.flatMap(leg =>
                  leg.steps?.map(s => ({
                    instruction: s.maneuver?.instruction || '',
                    modifier: s.maneuver?.modifier || '',
                    distance: (s.distance / 1000).toFixed(2),
                  })) || []
                ) || [],
              });
            }
          }
        } catch { /* destinazione illeggibile o gia scaduta: la schermata resta in attesa */ }
      },
      () => {}, { timeout: 10000 }
    );
  }, [destination, showLangPicker]);

  const handleConfirm = useCallback(() => {
    vibrate(20);
    setConfirmed(true);
  }, []);

  const openInMaps = useCallback(() => {
    if (!destination) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}`;
    window.open(url, '_blank');
  }, [destination]);

  // ── Loading/Error states ──
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: C.bg, fontFamily: FONT }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: 16 }}><Icon name="car" size={40} color={(_S?.colors?.textMuted) || 'rgba(255,255,255,0.35)'} /></div>
          <div style={{ fontSize: 14, color: C.textMuted }}>Caricamento destinazione...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: C.bg, fontFamily: FONT }}>
        <div style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ marginBottom: 16 }}><Icon name="car" size={40} color={(_S?.colors?.textMuted) || 'rgba(255,255,255,0.35)'} /></div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary, marginBottom: 8 }}>{error}</div>
          <button onClick={() => setView('home')} style={{
            padding: '10px 24px', borderRadius: 12, cursor: 'pointer',
            background: `${C.accent}15`, border: `1px solid ${C.accent}25`,
            color: C.accent, fontSize: 13, fontWeight: 600, fontFamily: FONT,
          }}>Torna alla home</button>
        </div>
      </div>
    );
  }

  // ── Language picker ──
  if (showLangPicker) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', height: '100dvh',
        background: C.bg, fontFamily: FONT,
      }}>
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{ marginBottom: 16 }}><Icon name="car" size={40} color={(_S?.colors?.textMuted) || 'rgba(255,255,255,0.35)'} /></div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.textPrimary, marginBottom: 6, textAlign: 'center' }}>
            TaxiTalk
          </div>
          <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 24, textAlign: 'center' }}>
            Select your language / Seleziona la tua lingua
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
            width: '100%', maxWidth: 360,
          }}>
            {DRIVER_LANGS.map(lang => (
              <button key={lang.code} onClick={() => { setDriverLang(lang.code); setShowLangPicker(false); vibrate(15); }}
                style={{
                  padding: '12px 8px', borderRadius: 14, cursor: 'pointer',
                  background: driverLang === lang.code ? `${C.accent}18` : C.card,
                  border: `1px solid ${driverLang === lang.code ? `${C.accent}35` : C.cardBorder}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  fontFamily: FONT,
                }}>
                <span style={{ fontSize: 24 }}>{lang.flag}</span>
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  color: driverLang === lang.code ? C.accent : C.textPrimary,
                }}>{lang.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Main driver view ──
  const driverLangInfo = DRIVER_LANGS.find(l => l.code === driverLang);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100dvh',
      background: C.bg, fontFamily: FONT,
    }}>
      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 16px', flexShrink: 0,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.textPrimary, display: 'flex', alignItems: 'center', gap: 8 }}>
            TaxiTalk
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
              background: `${C.accent}12`, color: C.accent,
            }}>
              {driverLangInfo?.flag} {driverLangInfo?.name}
            </span>
          </div>
        </div>
        <button onClick={() => setShowLangPicker(true)} style={{
          padding: '6px 12px', borderRadius: 10, cursor: 'pointer',
          background: C.card, border: `1px solid ${C.cardBorder}`,
          color: C.textMuted, fontSize: 10, fontWeight: 600, fontFamily: FONT,
        }}>
          Lingua
        </button>
      </header>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px', scrollbarWidth: 'none' }}>

        {/* Destination card — big, prominent */}
        <div style={{
          padding: '20px 18px', borderRadius: 20, marginBottom: 12,
          background: `linear-gradient(145deg, ${C.accent}08, ${C.purple}05)`,
          border: `1.5px solid ${C.accent}25`,
        }}>
          {translating ? (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ fontSize: 13, color: C.textMuted }}>Traduzione in corso...</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.accent, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                Destinazione
              </div>
              <div style={{
                fontSize: 22, fontWeight: 800, color: C.textPrimary, lineHeight: 1.3, marginBottom: 8,
              }}>
                {translatedAddress || destination.normalizedAddress}
              </div>

              {/* Structured details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {destination.terminal && (
                  <div style={{ fontSize: 14, color: C.textPrimary, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span></span> <strong>{destination.terminal}</strong>
                  </div>
                )}
                {destination.hotelName && (
                  <div style={{ fontSize: 14, color: C.textPrimary, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span></span> <strong>{destination.hotelName}</strong>
                  </div>
                )}
                {destination.entrance && (
                  <div style={{ fontSize: 13, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span></span> {destination.entrance}
                  </div>
                )}
                {destination.flightNumber && (
                  <div style={{ fontSize: 13, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span></span> {destination.flightNumber}
                  </div>
                )}
              </div>

              {/* Stops */}
              {destination.stops?.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.accent, marginBottom: 4 }}>
                    Fermate intermedie
                  </div>
                  {destination.stops.map((stop, i) => (
                    <div key={i} style={{
                      padding: '6px 10px', borderRadius: 8, marginBottom: 3,
                      background: `${C.purple}08`, border: `1px solid ${C.purple}15`,
                      fontSize: 12, color: C.textPrimary,
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: C.purple }}>{i + 1}</span>
                      {stop}
                    </div>
                  ))}
                </div>
              )}

              {/* Notes */}
              {(translatedNotes || destination.notes) && (
                <div style={{
                  marginTop: 10, padding: '10px 12px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.03)',
                  fontSize: 13, color: C.textMuted, fontStyle: 'italic', lineHeight: 1.5,
                }}>
                  {translatedNotes || destination.notes}
                </div>
              )}
            </>
          )}
        </div>

        {/* Route info */}
        {routeInfo && (
          <div style={{
            display: 'flex', gap: 10, marginBottom: 12,
          }}>
            <div style={{
              flex: 1, padding: '14px', borderRadius: 14, textAlign: 'center',
              background: C.card, border: `1px solid ${C.cardBorder}`,
            }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: C.accent }}>{routeInfo.distKm}</div>
              <div style={{ fontSize: 10, color: C.textMuted }}>km</div>
            </div>
            <div style={{
              flex: 1, padding: '14px', borderRadius: 14, textAlign: 'center',
              background: C.card, border: `1px solid ${C.cardBorder}`,
            }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: C.purple }}>{routeInfo.durationMin}</div>
              <div style={{ fontSize: 10, color: C.textMuted }}>min</div>
            </div>
          </div>
        )}

        {/* Mappa vettoriale MapLibre: tema scuro/chiaro, pinch, doppio tap, bottoni zoom */}
        {destination && (
          <div style={{ marginBottom: 12 }}>
            <TaxiMap lat={destination.lat} lng={destination.lng} altezza={340} />
          </div>
        )}

        {/* Confirmed state */}
        {confirmed && (
          <div style={{
            padding: '14px 16px', borderRadius: 14, marginBottom: 12,
            background: `${C.accent}10`, border: `1px solid ${C.accent}25`,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.accent }}>
              ✓ Destinazione confermata
            </div>
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div style={{
        padding: '12px 16px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        display: 'flex', gap: 10,
      }}>
        {!confirmed ? (
          <button onClick={handleConfirm} style={{
            flex: 1, padding: '14px', borderRadius: 14, cursor: 'pointer',
            background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
            border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: FONT,
            boxShadow: `0 4px 20px ${C.accent}35`,
          }}>
            ✓ Confermo destinazione
          </button>
        ) : (
          <>
            <button onClick={openInMaps} style={{
              flex: 1, padding: '14px', borderRadius: 14, cursor: 'pointer',
              background: `${C.accent}12`, border: `1px solid ${C.accent}25`,
              color: C.accent, fontSize: 13, fontWeight: 700, fontFamily: FONT,
            }}>
              Navigatore
            </button>
            <button onClick={() => setView('speaker')} style={{
              flex: 1, padding: '14px', borderRadius: 14, cursor: 'pointer',
              background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
              border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: FONT,
              boxShadow: `0 4px 20px ${C.accent}35`,
            }}>
              Parla con passeggero
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default memo(TaxiDriverView);
