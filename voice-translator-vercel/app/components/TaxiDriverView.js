'use client';
import Icon from './Icon.js';
import { memo, useState, useEffect, useCallback } from 'react';
import { FONT, getLang, vibrate } from '../lib/constants.js';
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

// b.145 — QUESTA SCHERMATA LA LEGGE UN ESTRANEO.
//
// E' il tassista, che non ha installato niente e apre un link: se non
// parla italiano non ha nessun modo di capire cosa gli si sta chiedendo.
// Restavano in italiano fisso la scelta della lingua (scritta meta in
// inglese e meta in italiano, "Select your language / Seleziona la tua
// lingua": due lingue su quarantaquattro), l'etichetta della
// destinazione, le fermate, i due bottoni di conferma, il navigatore e
// "Parla con passeggero" — cioe tutto quello che si tocca. Anche km e
// min sono chiavi: in russo, cinese e thailandese si scrivono diversi.
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
  // b.363 — la traduzione e stata respinta: quello che si legge e la lingua
  // di partenza, e il tassista ha diritto di saperlo.
  const [traduzioneRespinta, setTraduzioneRespinta] = useState(false);
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
          setError(L('taxiMissingKey'));
          setLoading(false);
          return;
        }

        const res = await fetch(`/api/taxi/destination?id=${destId}`, { signal: AbortSignal.timeout(10000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */ });
        if (!res.ok) {
          if (res.status === 404) setError(L('taxiDestExpired'));
          else setError(L('loadingError'));
          setLoading(false); return;
        }
        // b.363 — prima la busta cifrata si leggeva senza protezione: una
        // risposta rotta finiva nel ramo "non riesco a decifrare", e al
        // tassista si dichiarava un guasto completamente diverso da quello vero.
        const busta = await res.json().catch(() => null);
        if (!busta?.ciphertext) { setError(L('loadingError')); setLoading(false); return; }
        const { ciphertext } = busta;

        // Decrypt client-side — the server never saw the cleartext
        const dest = await decryptDestination(ciphertext, decryptionKey);
        setDestination(dest);

        // Try to detect driver's language from browser
        const browserLang = navigator.language?.split('-')[0] || 'en';
        const matched = DRIVER_LANGS.find(l => l.code === browserLang);
        if (matched) setDriverLang(matched.code);
      } catch (e) {
        // b.363 — prima questo guasto non lasciava traccia da nessuna parte: nel
        // registro non compariva nulla, e il motivo vero (rete caduta, attesa
        // scaduta, credito finito, server rotto) restava irrecuperabile.
        if (e?.name !== 'AbortError') console.warn('[b.363] /api/taxi/destination:', e?.message || e);
        if (e?.message?.includes('decrypt') || e?.name === 'OperationError') {
          setError(L('cannotDecryptDest'));
        } else {
          setError(L('networkError'));
        }
      }
      setLoading(false);
    }
    load();
  }, [destId, decryptionKey, L]);

  // ── Translate when driver selects language ──
  useEffect(() => {
    if (!destination || !driverLang || showLangPicker) return;
    let cancelled = false;

    async function translate() {
      setTranslating(true);
      setTraduzioneRespinta(false);
      try {
        // Translate address
        const addrRes = await fetch('/api/translate', { signal: AbortSignal.timeout(30000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: destination.normalizedAddress,
            sourceLang: 'auto', targetLang: driverLang,
            sourceLangName: 'auto', targetLangName: getLang(driverLang)?.name || driverLang,
          }),
        });
        if (addrRes.ok && !cancelled) {
          // b.363 — traduzione respinta = risposta buona col testo di
          // PARTENZA. Qui il ripiego era gia l'originale, quindi lo schermo
          // non cambiava: ma il tassista non aveva modo di sapere che stava
          // leggendo un indirizzo NON tradotto. Ora si distingue.
          // b.363 — prima la lettura non era protetta: con una risposta rotta
          // l'indirizzo restava "in traduzione" senza mai arrivare a un esito.
          const d = await addrRes.json().catch(() => null);
          setTranslatedAddress(d?.validationFailed || !d ? destination.normalizedAddress : (d.translated || destination.normalizedAddress));
          if (!d || d.validationFailed) setTraduzioneRespinta(true);
        }

        // Translate notes if present
        if (destination.notes) {
          const notesRes = await fetch('/api/translate', { signal: AbortSignal.timeout(30000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: destination.notes,
              sourceLang: 'auto', targetLang: driverLang,
              sourceLangName: 'auto', targetLangName: getLang(driverLang)?.name || driverLang,
            }),
          });
          if (notesRes.ok && !cancelled) {
            // b.363 — stessa cosa per le note: risposta rotta significa che si
            // tiene l'originale e lo si DICHIARA, invece di tacere.
            const dn = await notesRes.json().catch(() => null);
            setTranslatedNotes(dn?.validationFailed || !dn ? destination.notes : (dn.translated || destination.notes));
            if (!dn || dn.validationFailed) setTraduzioneRespinta(true);
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
          const res = await fetch(url, { signal: AbortSignal.timeout(10000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */ });
          if (res.ok) {
            // b.363 — prima la lettura non era protetta e il percorso spariva
            // in silenzio: il tassista restava senza indicazioni e senza motivo.
            const data = await res.json().catch(() => null);
            if (!data) console.warn('[b.363] percorso OSRM: risposta illeggibile');
            if (data?.routes?.[0]) {
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
          {/* b.482 — qui c'era una casella d'icona VUOTA: si chiedeva un
              disegno («car») che in Icon.js non esiste, e non compariva
              niente. Il mappamondo dice cosa fa la schermata: parlarsi
              fra lingue diverse. */}
          <div style={{ marginBottom: 16 }}><Icon name="globe" size={40} color={(_S?.colors?.textMuted) || 'rgba(255,255,255,0.35)'} /></div>
          <div style={{ fontSize: 14, color: C.textMuted }}>{L('loadingDestination')}</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: C.bg, fontFamily: FONT }}>
        <div style={{ textAlign: 'center', padding: 24 }}>
          {/* b.482 — qui c'era una casella d'icona VUOTA: si chiedeva un
              disegno («car») che in Icon.js non esiste, e non compariva
              niente. Il mappamondo dice cosa fa la schermata: parlarsi
              fra lingue diverse. */}
          <div style={{ marginBottom: 16 }}><Icon name="globe" size={40} color={(_S?.colors?.textMuted) || 'rgba(255,255,255,0.35)'} /></div>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.textPrimary, marginBottom: 8 }}>{error}</div>
          <button onClick={() => setView('home')} style={{
            padding: '10px 24px', minHeight: 44, borderRadius: 12, cursor: 'pointer',
            background: `${C.accent}15`, border: `1px solid ${C.accent}25`,
            color: C.accent, fontSize: 13, fontWeight: 600, fontFamily: FONT,
          }}>{L('backHome')}</button>
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
          {/* b.482 — qui c'era una casella d'icona VUOTA: si chiedeva un
              disegno («car») che in Icon.js non esiste, e non compariva
              niente. Il mappamondo dice cosa fa la schermata: parlarsi
              fra lingue diverse. */}
          <div style={{ marginBottom: 16 }}><Icon name="globe" size={40} color={(_S?.colors?.textMuted) || 'rgba(255,255,255,0.35)'} /></div>
          <div style={{ fontSize: 22, fontWeight: 600, color: C.textPrimary, marginBottom: 6, textAlign: 'center' }}>
            TaxiTalk
          </div>
          <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 24, textAlign: 'center' }}>
            {L('selectYourLanguage')}
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
            width: '100%', maxWidth: 360,
          }}>
            {DRIVER_LANGS.map(lang => (
              <button key={lang.code} onClick={() => { setDriverLang(lang.code); setShowLangPicker(false); vibrate(15); }}
                style={{
                  padding: '12px 8px', minHeight: 44, borderRadius: 14, cursor: 'pointer',
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
      {/* b.482 — TESTATA: rientro laterale a venti come nel template. */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 20px', flexShrink: 0,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: C.textPrimary, display: 'flex', alignItems: 'center', gap: 8 }}>
            TaxiTalk
            <span style={{
              fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
              background: `${C.accent}12`, color: C.accent,
            }}>
              {driverLangInfo?.flag} {driverLangInfo?.name}
            </span>
          </div>
        </div>
      </header>

      {/* b.503 — tavola 32: «la lingua si sceglie IN CIMA E SUBITO» —
          chi apre questa pagina non e dei nostri e non ha impostazioni.
          Pillole scorrevoli, selezione a un tocco: via il bottone che
          apriva un altro schermo (la scelta iniziale resta per il primo
          arrivo). */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', flexShrink: 0,
        padding: '0 20px 10px', scrollbarWidth: 'none' }}>
        {DRIVER_LANGS.map(lang => (
          <button key={lang.code}
            onClick={() => { setDriverLang(lang.code); vibrate(10); }}
            aria-pressed={driverLang === lang.code}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
              padding: '8px 14px', minHeight: 44, borderRadius: 999, cursor: 'pointer',
              background: driverLang === lang.code ? `${C.accent}18` : C.card,
              border: `1.5px solid ${driverLang === lang.code ? C.accent : C.cardBorder}`,
              color: driverLang === lang.code ? C.accent : C.textPrimary,
              fontSize: 13, fontWeight: 600, fontFamily: FONT,
              WebkitTapHighlightColor: 'transparent' }}>
            <span style={{ fontSize: 17 }}>{lang.flag}</span> {lang.name}
          </button>
        ))}
      </div>

      {/* Content */}
      {/* b.482 — il corpo della pagina rientra di venti come la testata. */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 16px', scrollbarWidth: 'none' }}>

        {/* Destination card — big, prominent */}
        <div style={{
          padding: '20px 20px', borderRadius: 20, marginBottom: 12,
          background: `linear-gradient(145deg, ${C.accent}08, ${C.purple}05)`,
          border: `1.5px solid ${C.accent}25`,
        }}>
          {translating ? (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ fontSize: 13, color: C.textMuted }}>{L('translationInProgress')}</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.accent, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                {L('destinationWord')}
              </div>
              {/* b.503 — tavola 32: la destinazione e ENORME — si legge
                  con lo sguardo, non si studia. */}
              <div style={{
                fontSize: 28, fontWeight: 600, color: C.textPrimary, lineHeight: 1.28, marginBottom: 8,
              }}>
                {translatedAddress || destination.normalizedAddress}
              </div>

              {/* b.363 — se la traduzione e stata respinta, quello che si
                  legge sopra e nella lingua del passeggero: si dice. */}
              {traduzioneRespinta && (
                <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>
                  {L('translationRetryLater')}
                </div>
              )}

              {/* Structured details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {destination.terminal && (
                  <div style={{ fontSize: 14, color: C.textPrimary, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span></span> <strong style={{ fontWeight: 600 }}>{destination.terminal}</strong>
                  </div>
                )}
                {destination.hotelName && (
                  <div style={{ fontSize: 14, color: C.textPrimary, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span></span> <strong style={{ fontWeight: 600 }}>{destination.hotelName}</strong>
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
                    {L('intermediateStops')}
                  </div>
                  {destination.stops.map((stop, i) => (
                    <div key={i} style={{
                      padding: '6px 10px', borderRadius: 8, marginBottom: 3,
                      background: `${C.purple}08`, border: `1px solid ${C.purple}15`,
                      fontSize: 12, color: C.textPrimary,
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: C.purple }}>{i + 1}</span>
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
              <div style={{ fontSize: 24, fontWeight: 600, color: C.accent }}>{routeInfo.distKm}</div>
              <div style={{ fontSize: 10, color: C.textMuted }}>{L('unitKm')}</div>
            </div>
            <div style={{
              flex: 1, padding: '14px', borderRadius: 14, textAlign: 'center',
              background: C.card, border: `1px solid ${C.cardBorder}`,
            }}>
              <div style={{ fontSize: 24, fontWeight: 600, color: C.purple }}>{routeInfo.durationMin}</div>
              <div style={{ fontSize: 10, color: C.textMuted }}>{L('unitMin')}</div>
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
            padding: '14px 20px', borderRadius: 14, marginBottom: 12,
            background: `${C.accent}10`, border: `1px solid ${C.accent}25`,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.accent }}>
              ✓ {L('destConfirmed')}
            </div>
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div style={{
        padding: '12px 20px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        display: 'flex', gap: 10,
      }}>
        {!confirmed ? (
          <button onClick={handleConfirm} style={{
            flex: 1, padding: '14px', minHeight: 44, borderRadius: 14, cursor: 'pointer',
            background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
            border: 'none', color: '#fff', fontSize: 15, fontWeight: 600, fontFamily: FONT,
            boxShadow: `0 4px 20px ${C.accent}35`,
          }}>
            ✓ {L('confirmDestination')}
          </button>
        ) : (
          <>
            <button onClick={openInMaps} style={{
              flex: 1, padding: '14px', minHeight: 44, borderRadius: 14, cursor: 'pointer',
              background: `${C.accent}12`, border: `1px solid ${C.accent}25`,
              color: C.accent, fontSize: 13, fontWeight: 600, fontFamily: FONT,
            }}>
              {L('openNavigator')}
            </button>
            <button onClick={() => setView('speaker')} style={{
              flex: 1, padding: '14px', minHeight: 44, borderRadius: 14, cursor: 'pointer',
              background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
              border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: FONT,
              boxShadow: `0 4px 20px ${C.accent}35`,
            }}>
              {L('talkToPassenger')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default memo(TaxiDriverView);
