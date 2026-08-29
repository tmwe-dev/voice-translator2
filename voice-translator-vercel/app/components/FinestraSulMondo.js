'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FONT, vibrate } from '../lib/constants.js';
import Icon from './Icon.js';
import AnteprimaCoperta from './ui/AnteprimaCoperta.js';
import { bandieraPaese } from '../lib/schedaMondo.js';
import { poliDelViaggiatore } from '../lib/casaEViaggio.js';
import { settingsDaPrefs } from '../lib/mondo/settings.js';
import { profileDaPrefs, topicDichiarati } from '../lib/mondo/profile.js';
import { matchesFollowed, trafficFromEvents } from '../lib/mondo/breaking.js';
import { disableMondoPush, enableMondoPush, pushDisponibile, syncMondoPush } from '../lib/mondo/pushClient.js';

// ═══════════════════════════════════════════════════════════════
// MONDO LIVE (b.580)
//
// Il browser non cerca piu notizie ogni 2/5/10 minuti. Ascolta il bus
// server di Mondo con SSE; il motore centrale scopre, raggruppa e valuta
// gli eventi. Il pianeta conserva il suo volo originale: prima punta il
// luogo, aspetta 1,5 secondi, poi mostra il cartello.
// ═══════════════════════════════════════════════════════════════

const ATTESA_VOLO_MS = 1500;
const DURATA_CARTELLO_MS = 18000;
const KEY_LAST_SEEN = 'vt-mondo-live-last-seen';
const KEY_LAYER = 'vt-mondo-live-layer';

const TESTI = {
  it: { recovering: 'Connessione in ripristino', updated: 'aggiornato', new: 'nuovi', important: 'importanti', followed: 'Seguo', community: 'Community', sources: 'fonti', confirmed: 'confermato', developing: 'in sviluppo', emerging: 'da verificare', since: 'Da quando eri via', none: 'Nessun nuovo evento' },
  en: { recovering: 'Reconnecting', updated: 'updated', new: 'new', important: 'important', followed: 'Following', community: 'Community', sources: 'sources', confirmed: 'confirmed', developing: 'developing', emerging: 'unconfirmed', since: 'Since you were away', none: 'No new events' },
  es: { recovering: 'Reconectando', updated: 'actualizado', new: 'nuevos', important: 'importantes', followed: 'Sigo', community: 'Comunidad', sources: 'fuentes', confirmed: 'confirmado', developing: 'en desarrollo', emerging: 'por verificar', since: 'Desde que te fuiste', none: 'Ningún evento nuevo' },
  fr: { recovering: 'Reconnexion', updated: 'mis à jour', new: 'nouveaux', important: 'importants', followed: 'Suivis', community: 'Communauté', sources: 'sources', confirmed: 'confirmé', developing: 'en cours', emerging: 'à vérifier', since: 'Depuis votre absence', none: 'Aucun nouvel événement' },
  de: { recovering: 'Verbindung wird wiederhergestellt', updated: 'aktualisiert', new: 'neu', important: 'wichtig', followed: 'Folge ich', community: 'Community', sources: 'Quellen', confirmed: 'bestätigt', developing: 'in Entwicklung', emerging: 'zu prüfen', since: 'Seit du weg warst', none: 'Keine neuen Ereignisse' },
  pt: { recovering: 'Reconectando', updated: 'atualizado', new: 'novos', important: 'importantes', followed: 'Seguindo', community: 'Comunidade', sources: 'fontes', confirmed: 'confirmado', developing: 'em desenvolvimento', emerging: 'a verificar', since: 'Desde que você saiu', none: 'Nenhum evento novo' },
};

function diz(lingua) {
  const l = String(lingua || 'en').split('-')[0].toLowerCase();
  return TESTI[l] || TESTI.en;
}

function tempo(e) {
  const n = Number(e?.updatedAt || e?.firstSeenAt);
  if (Number.isFinite(n) && n > 0) return n;
  const d = new Date(e?.publishedAt || 0).getTime();
  return Number.isFinite(d) ? d : 0;
}

function unisciEventi(prima, nuovi) {
  const m = new Map();
  for (const e of [...(Array.isArray(prima) ? prima : []), ...(Array.isArray(nuovi) ? nuovi : [])]) {
    if (!e?.id) continue;
    const old = m.get(e.id);
    if (!old || tempo(e) >= tempo(old)) m.set(e.id, { ...old, ...e });
  }
  return [...m.values()].sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0) || tempo(b) - tempo(a)).slice(0, 140);
}

export default function FinestraSulMondo({ C, L, lingua, prefs, attiva, paese, onPuntaGlobo, occupato = false }) {
  const settings = useMemo(() => settingsDaPrefs(prefs), [prefs]);
  const profile = useMemo(() => profileDaPrefs(prefs), [prefs]);
  const topics = useMemo(() => topicDichiarati(profile), [profile]);
  const poli = useMemo(() => poliDelViaggiatore(prefs), [prefs]);
  const countries = useMemo(() => [...new Set([poli.casa, poli.qui, paese].filter(Boolean))], [poli.casa, poli.qui, paese]);
  const topicsKey = topics.join('|');
  const countriesKey = countries.join('|');
  const T = diz(lingua);

  const [events, setEvents] = useState([]);
  const [cartello, setCartello] = useState(null);
  const [aperta, setAperta] = useState(null);
  const [status, setStatus] = useState({ state: settings.breaking === 'off' ? 'off' : 'connecting', age: null, when: 0 });
  const [layer, setLayer] = useState(() => {
    if (typeof window === 'undefined') return 'live';
    const v = window.localStorage.getItem(KEY_LAYER);
    return ['live', 'following', 'community'].includes(v) ? v : 'live';
  });
  const [catchup, setCatchup] = useState([]);
  const [catchupOpen, setCatchupOpen] = useState(false);
  const [pushOn, setPushOn] = useState(false);

  const queueRef = useRef([]);
  const shownRef = useRef(new Set());
  const cartelloRef = useRef(null);
  const apertaRef = useRef(null);
  const occupatoRef = useRef(false);
  const voloRef = useRef(null);
  const aspettandoRef = useRef(false);
  const primoBatchRef = useRef(true);

  useEffect(() => { cartelloRef.current = cartello; }, [cartello]);
  useEffect(() => { apertaRef.current = aperta; }, [aperta]);
  useEffect(() => { occupatoRef.current = occupato; }, [occupato]);

  const visibileNelLayer = useCallback((e) => {
    if (e?.important) return true; // emergenze globali sempre visibili
    if (layer === 'community') return false;
    if (layer === 'following') return matchesFollowed(e, profile);
    return true;
  }, [layer, profile]);

  const avanza = useCallback(() => {
    if (voloRef.current) { clearTimeout(voloRef.current); voloRef.current = null; }
    const prossimo = queueRef.current.shift() || null;
    if (!prossimo) {
      aspettandoRef.current = false;
      setCartello(null);
      onPuntaGlobo?.(null);
      return;
    }
    const code = (prossimo.countries || [prossimo.country]).filter(Boolean)[0] || null;
    if (code) {
      aspettandoRef.current = true;
      onPuntaGlobo?.(code);
      voloRef.current = setTimeout(() => {
        aspettandoRef.current = false;
        voloRef.current = null;
        setCartello(prossimo);
      }, ATTESA_VOLO_MS);
    } else setCartello(prossimo);
  }, [onPuntaGlobo]);

  const accoda = useCallback((lista) => {
    const aggiunte = (Array.isArray(lista) ? lista : [])
      .filter(visibileNelLayer)
      .filter((e) => e?.id && !shownRef.current.has(e.id));
    for (const e of aggiunte) shownRef.current.add(e.id);
    queueRef.current = [...queueRef.current, ...aggiunte]
      .sort((a, b) => (Number(b.important) - Number(a.important)) || (Number(b.score) || 0) - (Number(a.score) || 0) || tempo(b) - tempo(a));
    if (!cartelloRef.current && !apertaRef.current && !aspettandoRef.current && !occupatoRef.current) avanza();
  }, [avanza, visibileNelLayer]);

  // Se il layer cambia, la coda viene ricostruita dagli eventi gia noti:
  // nessuna nuova ricerca, cambia soltanto cosa stiamo guardando.
  useEffect(() => {
    if (!attiva) return;
    try { window.localStorage.setItem(KEY_LAYER, layer); }
    catch { /* localStorage puo essere disabilitato: il layer resta valido in memoria */ }
    queueRef.current = [];
    shownRef.current = new Set(cartello ? [cartello.id] : []);
    const candidati = events.filter(visibileNelLayer);
    accoda(candidati);
    // Il rebuild deve avvenire al gesto sul layer, non a ogni evento che
    // arriva: gli eventi nuovi passano gia da accoda() nel listener SSE.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer]);

  // Il globo conserva esattamente il renderer/animazioni esistenti: gli
  // passiamo solo il significato dei puntini da mostrare in quel momento.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const following = events.filter((e) => matchesFollowed(e, profile));
    window.dispatchEvent(new CustomEvent('bartalk:mondo-layer', {
      detail: {
        layer,
        live: trafficFromEvents(events),
        following: trafficFromEvents(following),
      },
    }));
  }, [events, profile, layer]);

  useEffect(() => {
    if (!attiva || settings.breaking === 'off') {
      setStatus({ state: 'off', age: null, when: Date.now() });
      return undefined;
    }

    let source = null;
    let closed = false;
    const oldSeen = (() => {
      try { return Number(window.localStorage.getItem(KEY_LAST_SEEN)) || 0; }
      catch { return 0; }
    })();
    const params = new URLSearchParams({
      since: String(oldSeen),
      lang: String(lingua || 'en'),
      topics: topics.join(','),
      countries: countries.join(','),
      breaking: settings.breaking,
    });

    source = new EventSource(`/api/mondo/live?${params.toString()}`);
    source.addEventListener('heartbeat', (ev) => {
      if (closed) return;
      try {
        const d = JSON.parse(ev.data);
        setStatus({ state: d.status || 'live', age: Number.isFinite(d.age) ? d.age : null, when: d.when || Date.now(), lastIngestAt: d.lastIngestAt || 0 });
      } catch {
        // Un heartbeat monco non modifica lo stato buono precedente.
      }
    });
    source.addEventListener('events', (ev) => {
      if (closed) return;
      try {
        const d = JSON.parse(ev.data);
        const incoming = Array.isArray(d.events) ? d.events : [];
        if (!incoming.length) return;
        setEvents((old) => unisciEventi(old, incoming));
        if (primoBatchRef.current && oldSeen) {
          const persi = incoming.filter((e) => tempo(e) > oldSeen);
          if (persi.length) setCatchup(unisciEventi([], persi));
        }
        primoBatchRef.current = false;
        accoda(incoming);
        try { window.localStorage.setItem(KEY_LAST_SEEN, String(Math.max(Date.now(), Number(d.cursor) || 0))); }
        catch { /* il cursore resta comunque attivo per questa sessione */ }
      } catch {
        // Una riga SSE incompleta viene ignorata; EventSource prosegue.
      }
    });
    source.onerror = () => {
      if (!closed) setStatus((s) => ({ ...s, state: 'recovering', when: Date.now() }));
      // EventSource si riconnette da solo; nessun timer di polling qui.
    };

    return () => {
      closed = true;
      source?.close();
      try { window.localStorage.setItem(KEY_LAST_SEEN, String(Date.now())); }
      catch { /* nessun errore visibile per storage privato/disabilitato */ }
    };
  }, [attiva, settings.breaking, lingua, topicsKey, countriesKey, accoda, topics, countries]);

  // Se il browser aveva gia il permesso, sincronizza senza aprire popup.
  useEffect(() => {
    if (!attiva || settings.breaking === 'off' || !pushDisponibile()) return;
    const preferences = { topics, countries, breaking: settings.breaking, lang: lingua };
    syncMondoPush(preferences).then((r) => setPushOn(!!r.enabled)).catch(() => null);
  }, [attiva, settings.breaking, lingua, topicsKey, countriesKey, topics, countries]);

  const togglePush = async () => {
    vibrate(8);
    const preferences = { topics, countries, breaking: settings.breaking, lang: lingua };
    const r = pushOn ? await disableMondoPush() : await enableMondoPush(preferences);
    setPushOn(!!r.enabled);
  };

  useEffect(() => {
    if (!cartello || aperta) return undefined;
    const timer = setTimeout(avanza, DURATA_CARTELLO_MS);
    return () => clearTimeout(timer);
  }, [cartello, aperta, avanza]);

  useEffect(() => () => { if (voloRef.current) clearTimeout(voloRef.current); }, []);

  if (!attiva) return null;

  const ageSeconds = status.age === null ? null : Math.max(0, Math.round(status.age / 1000));
  const live = status.state === 'live' || status.state === 'refreshing' || status.state === 'connecting';
  const importantiCatchup = catchup.filter((e) => e.important).length;
  const bandiera = cartello ? bandieraPaese((cartello.countries || [cartello.country]).filter(Boolean)[0]) : '';
  const statoEvento = cartello ? (T[cartello.status] || T.emerging) : '';

  return (
    <>
      {/* STATO DEL RADAR: il silenzio non puo piu sembrare un mondo calmo. */}
      <div style={{ position: 'absolute', top: 78, left: 0, right: 0, zIndex: 58, pointerEvents: 'none', display: 'flex', justifyContent: 'center' }}>
        <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 6, maxWidth: '94%', padding: '5px 7px',
          borderRadius: 999, background: 'rgba(6,9,18,0.70)', border: `1px solid ${C.cardBorder}`, fontFamily: FONT,
          boxShadow: '0 8px 24px rgba(0,0,0,.20)' }}>
          <span style={{ width: 7, height: 7, borderRadius: 9, flexShrink: 0, background: live ? '#2EE59D' : '#F59E0B', boxShadow: live ? '0 0 9px #2EE59D' : 'none' }} />
          <span style={{ fontSize: 10.5, fontWeight: 600, color: C.textPrimary, whiteSpace: 'nowrap' }}>
            {live ? 'LIVE' : T.recovering}
            {live && ageSeconds !== null ? ` · ${T.updated} ${ageSeconds}s` : ''}
          </span>

          {catchup.length > 0 && (
            <button onClick={() => setCatchupOpen(true)} style={{ border: 'none', cursor: 'pointer', borderRadius: 999, padding: '4px 7px',
              background: `${C.accent}18`, color: C.accent, fontSize: 10, fontWeight: 600, fontFamily: FONT, whiteSpace: 'nowrap' }}>
              {catchup.length} {T.new}{importantiCatchup ? ` · ${importantiCatchup} ${T.important}` : ''}
            </button>
          )}

          {[
            ['live', 'LIVE'],
            ['following', T.followed],
            ['community', T.community],
          ].map(([id, label]) => (
            <button key={id} onClick={() => { vibrate(6); setLayer(id); }} aria-pressed={layer === id}
              style={{ width: 30, height: 30, borderRadius: 999, padding: 0, border: `1px solid ${layer === id ? C.accent + '66' : C.cardBorder}`,
                background: layer === id ? `${C.accent}18` : 'transparent', cursor: 'pointer', color: layer === id ? C.accent : C.textMuted,
                fontSize: id === 'live' ? 8 : 0, fontWeight: 700, fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title={label} aria-label={label}>
              {id === 'live' ? 'LIVE' : <Icon name={id === 'following' ? 'star' : 'chat'} size={13} color={layer === id ? C.accent : C.textMuted} />}
            </button>
          ))}

          {pushDisponibile() && settings.breaking !== 'off' && (
            <button onClick={togglePush} aria-pressed={pushOn} aria-label="Push Mondo Live" title="Push Mondo Live"
              style={{ width: 30, height: 30, borderRadius: 999, border: `1px solid ${pushOn ? C.accent + '66' : C.cardBorder}`,
                background: pushOn ? `${C.accent}18` : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="bell" size={13} color={pushOn ? C.accent : C.textMuted} />
            </button>
          )}
        </div>
      </div>

      {cartello && !aperta && (
        <div style={{ position: 'absolute', left: 20, right: 20, bottom: 'calc(120px + env(safe-area-inset-bottom))', display: 'flex', justifyContent: 'center', zIndex: 60, pointerEvents: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'auto', width: '100%', maxWidth: 420, padding: '10px 12px',
            background: 'rgba(6,9,18,0.90)', border: `1px solid ${cartello.important ? 'rgba(245,90,70,.55)' : C.cardBorder}`,
            borderRadius: 16, backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', boxShadow: '0 14px 40px rgba(0,0,0,0.45)',
            fontFamily: FONT, animation: 'vtCartelloSale .28s cubic-bezier(0.2,0.8,0.3,1)' }}>
            {cartello.image ? (
              <AnteprimaCoperta src={cartello.image} L={L} contenuto={{ url: cartello.url }} stile={{ width: 46, height: 46, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <span style={{ width: 46, height: 46, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${C.accent}14`, border: `1px solid ${C.cardBorder}` }}>
                <Icon name="doc" size={18} color={C.accent} />
              </span>
            )}
            <button onClick={() => { vibrate(8); setAperta(cartello); }} style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT, padding: 0, minHeight: 44 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: cartello.important ? '#ff806d' : C.accent }}>
                {bandiera && <span aria-hidden="true" style={{ fontSize: 12 }}>{bandiera}</span>}
                {L('breakingWord')} · {cartello.sourceCount || 1} {T.sources} · {statoEvento}
              </span>
              <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: 13.5, fontWeight: 500, lineHeight: 1.3, color: C.textPrimary, marginTop: 2 }}>
                {cartello.title}
              </span>
            </button>
            <button onClick={() => { vibrate(6); avanza(); }} aria-label={L('closeWord')}
              style={{ width: 44, height: 44, flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="x" size={16} color={C.textMuted} />
            </button>
          </div>
        </div>
      )}

      {aperta && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 96, background: C.bg || '#05070f', display: 'flex', flexDirection: 'column', fontFamily: FONT }}>
          <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', flexShrink: 0 }}>
            <button onClick={() => { vibrate(6); setAperta(null); avanza(); }} aria-label={L('closeWord')}
              style={{ width: 44, height: 44, borderRadius: 12, cursor: 'pointer', background: C.card, border: `1px solid ${C.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="back" size={18} color={C.textMuted} />
            </button>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', color: aperta.important ? '#ff806d' : C.accent }}>
              {bandieraPaese((aperta.countries || [aperta.country]).filter(Boolean)[0])} {L('breakingWord')} · {aperta.sourceCount || 1} {T.sources} · {T[aperta.status] || T.emerging}
            </span>
          </header>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px calc(24px + env(safe-area-inset-bottom))', scrollbarWidth: 'none' }}>
            {aperta.image && <AnteprimaCoperta src={aperta.image} L={L} contenuto={{ url: aperta.url }} stile={{ width: '100%', aspectRatio: '16/9', borderRadius: 16, objectFit: 'cover', marginBottom: 14 }} />}
            <h2 style={{ margin: 0, fontSize: 21, fontWeight: 500, lineHeight: 1.3, color: C.textPrimary }}>{aperta.title}</h2>
            {aperta.summary && <p style={{ margin: '10px 0 0', fontSize: 15, lineHeight: 1.6, color: C.textSecondary }}>{aperta.summary}</p>}
            {(aperta.sources || []).slice(0, 6).map((f, i) => f?.url ? (
              <a key={`${f.url}-${i}`} href={f.url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: i === 0 ? 18 : 8, minHeight: 48, borderRadius: 14, padding: '0 14px', textDecoration: 'none',
                  background: i === 0 ? `${C.accent}14` : C.card, border: `1px solid ${i === 0 ? C.accent + '44' : C.cardBorder}`, color: i === 0 ? C.accent : C.textSecondary, fontSize: 13, fontWeight: 500 }}>
                <Icon name="link" size={15} color={i === 0 ? C.accent : C.textMuted} />
                <span style={{ flex: 1 }}>{f.fonte || f.dominio || `Fonte ${i + 1}`}</span>
              </a>
            ) : null)}
          </div>
        </div>
      )}

      {catchupOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 95, background: 'rgba(3,5,10,.76)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: FONT }}
          onClick={() => setCatchupOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 440, maxHeight: '72vh', overflowY: 'auto', background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 18, padding: 14, backdropFilter: 'blur(22px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: C.textPrimary }}>{T.since}</div>
              <button onClick={() => setCatchupOpen(false)} style={{ width: 38, height: 38, border: 'none', background: 'none', cursor: 'pointer' }}><Icon name="x" size={16} color={C.textMuted} /></button>
            </div>
            {!catchup.length && <div style={{ padding: 20, color: C.textMuted, textAlign: 'center', fontSize: 13 }}>{T.none}</div>}
            {catchup.slice(0, 24).map((e) => (
              <button key={e.id} onClick={() => { setCatchupOpen(false); setAperta(e); }} style={{ width: '100%', display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 8px', background: 'none', border: 'none', borderBottom: `1px solid ${C.cardBorder}`, cursor: 'pointer', textAlign: 'left', fontFamily: FONT }}>
                <span style={{ fontSize: 16 }}>{bandieraPaese((e.countries || [e.country]).filter(Boolean)[0])}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 12.5, lineHeight: 1.35, color: C.textPrimary }}>{e.title}</span>
                  <span style={{ display: 'block', marginTop: 3, fontSize: 10.5, color: e.important ? '#ff806d' : C.textMuted }}>{e.sourceCount || 1} {T.sources} · {T[e.status] || T.emerging}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <style>{`@keyframes vtCartelloSale { from { transform: translateY(14px); opacity: 0; } to { transform: none; opacity: 1; } }`}</style>
    </>
  );
}
