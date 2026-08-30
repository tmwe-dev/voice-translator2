'use client';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import Icon from '../Icon.js';
import { FONT, vibrate } from '../../lib/constants.js';
import AppContext from '../../contexts/AppContext.js';
import { suona } from '../../lib/voce.js';
import {
  frasiCompiute, prossimaDaDire, viaAsiatica, disponibile,
} from '../../lib/interpreteVideo.js';

// ═══════════════════════════════════════════════════════════════
// b.581 — TRADUZIONE VIDEO VISIBILE E SINCRONIZZATA
//
// La traduzione non vive piu' dietro ai tre puntini. Ogni video mostra
// sempre il comando «Traduci IT» (o la lingua dell'utente). I cinque
// secondi di rincorsa servono SOLO a preparare testo e voce: il risultato
// pronto resta in attesa e parte quando l'orologio del video raggiunge
// davvero l'inizio della frase.
// ═══════════════════════════════════════════════════════════════

const ORIGINE_YT = 'https://www.youtube-nocookie.com';
const PASSO_MS = 250;
const MODI = ['spento', 'sottotitoli', 'voce'];
const MODO_KEY = 'bartalk-interprete-video-modo-v1';
const MODO_EVENTO = 'bartalk:interprete-video-modo';
const RITENTA_DOPO_MS = 1800;
const MAX_PREPARATE = 2;
const TOLLERANZA_PARTENZA = 0.08;
const TOLLERANZA_PERSA = 2;

const VERBO_TRADUCI = {
  it: 'Traduci', en: 'Translate', es: 'Traducir', fr: 'Traduire', de: 'Übersetzen', pt: 'Traduzir',
  zh: '翻译', ja: '翻訳', ko: '번역', ar: 'ترجم', hi: 'अनुवाद', ru: 'Перевести', tr: 'Çevir',
  vi: 'Dịch', id: 'Terjemahkan', ms: 'Terjemah', nl: 'Vertaal', pl: 'Przetłumacz', sv: 'Översätt',
  el: 'Μετάφραση', cs: 'Přeložit', ro: 'Tradu', hu: 'Fordítás', fi: 'Käännä', uk: 'Перекласти',
  da: 'Oversæt', nb: 'Oversett', he: 'תרגם', fil: 'Isalin', bg: 'Преведи', hr: 'Prevedi',
  sk: 'Preložiť', ca: 'Tradueix', bn: 'অনুবাদ', ta: 'மொழிபெயர்', sw: 'Tafsiri', af: 'Vertaal', th: 'แปล',
};

function baseLingua(lingua) {
  return String(lingua || '').trim().toLowerCase().split(/[-_]/)[0];
}

export function lingueCoincidono(a, b) {
  const x = baseLingua(a);
  const y = baseLingua(b);
  return !!(x && y && x === y);
}

// Una frase puo' essere preparata cinque secondi prima, ma non puo'
// comparire o parlare cinque secondi prima. Questa e' la seconda porta.
export function statoFrasePreparata(frase, secondiVideo) {
  const ora = Number(secondiVideo);
  const inizio = Number(frase?.inizio);
  const fine = Number(frase?.fine);
  if (!Number.isFinite(ora) || !Number.isFinite(inizio)) return 'invalida';
  if (ora + TOLLERANZA_PARTENZA < inizio) return 'presto';
  if (Number.isFinite(fine) && ora > fine + TOLLERANZA_PERSA) return 'persa';
  return 'ora';
}

function leggiModoSalvato() {
  if (typeof window === 'undefined') return 'spento';
  try {
    const m = window.localStorage.getItem(MODO_KEY);
    return MODI.includes(m) ? m : 'spento';
  } catch {
    return 'spento';
  }
}

export default function InterpreteVideo({ videoId, lingua, attivo, onCambia, C, L, daFondo = 132, onDisponibile }) {
  const ctx = useContext(AppContext);
  const userToken = ctx?.userToken || '';

  const [frasi, setFrasi] = useState([]);
  const [cercati, setCercati] = useState(false);
  const [modo, setModo] = useState(leggiModoSalvato);
  const [aperto, setAperto] = useState(false);
  const [battuta, setBattuta] = useState('');

  const dette = useRef(new Set());
  const preparando = useRef(new Set());
  const pronte = useRef(new Map());
  const riprovaDopo = useRef(new Map());
  const battutaFino = useRef(0);
  const telaio = useRef(null);
  const partenza = useRef(0);
  const secondi = useRef(0);
  const orologioVero = useRef(false);
  const modoRef = useRef(modo);
  const linguaSottotitoli = useRef('');
  modoRef.current = modo;

  const parla = useCallback((k) => (typeof L === 'function' ? L(k) : k), [L]);
  const colori = C || {};
  const accento = colori.accent || '#26D9B0';
  const codiceLingua = String(lingua || 'en').replace('_', '-').toUpperCase();
  const verboTraduci = VERBO_TRADUCI[baseLingua(lingua)] || 'Translate';
  const pronto = !!(cercati && frasi.length);

  // b.581 — il vecchio ospite usava questo callback per mettere
  // «Interprete» dentro i tre puntini. Quella porta e' chiusa: il comando
  // primario e' sempre qui, direttamente sul video.
  useEffect(() => { onDisponibile?.(false); }, [onDisponibile]);

  const svuotaPronte = useCallback(() => {
    for (const x of pronte.current.values()) {
      if (x?.audioUrl) {
        try { URL.revokeObjectURL(x.audioUrl); } catch { /* niente da revocare */ }
      }
    }
    pronte.current.clear();
    preparando.current.clear();
    riprovaDopo.current.clear();
  }, []);

  // La scelta e' una preferenza del lettore, non del singolo video.
  // Tutte le slide gia montate ricevono lo stesso cambio nello stesso
  // istante; quelle future lo leggono da localStorage.
  useEffect(() => {
    const aggiorna = (ev) => {
      const m = ev?.detail?.modo || (() => {
        try { return window.localStorage.getItem(MODO_KEY); } catch { return ''; }
      })();
      if (MODI.includes(m)) setModo(m);
    };
    window.addEventListener(MODO_EVENTO, aggiorna);
    window.addEventListener('storage', aggiorna);
    return () => {
      window.removeEventListener(MODO_EVENTO, aggiorna);
      window.removeEventListener('storage', aggiorna);
    };
  }, []);

  // Cambiando modo si riparte puliti: una preparazione fatta per TESTO
  // non puo' essere riusata come se contenesse gia' la VOCE.
  useEffect(() => {
    dette.current = new Set();
    battutaFino.current = 0;
    setBattuta('');
    svuotaPronte();
  }, [modo, svuotaPronte]);

  // ── I SOTTOTITOLI DEL VIDEO ──
  useEffect(() => {
    let vivo = true;
    setFrasi([]);
    setCercati(false);
    setBattuta('');
    setAperto(false);
    linguaSottotitoli.current = '';
    dette.current = new Set();
    battutaFino.current = 0;
    svuotaPronte();
    telaio.current = null;
    if (!videoId) return undefined;

    (async () => {
      try {
        const p = new URLSearchParams({ id: videoId, lang: lingua || 'en' });
        const r = await fetch(`/api/video/sottotitoli?${p.toString()}`, { signal: AbortSignal.timeout(12000) });
        const d = await r.json().catch(() => null);
        if (!vivo) return;
        if (disponibile(d)) {
          linguaSottotitoli.current = d?.lingua || '';
          setFrasi(frasiCompiute(d.righe));
        }
        setCercati(true);
      } catch (e) {
        if (!vivo) return;
        if (e?.name !== 'AbortError') console.warn('[b.581] sottotitoli:', e?.message || e);
        setCercati(true);
      }
    })();

    return () => {
      vivo = false;
      svuotaPronte();
    };
  }, [videoId, lingua, svuotaPronte]);

  // ── IL PLAYER E IL SUO OROLOGIO ──
  const player = useCallback(() => {
    if (telaio.current?.isConnected) return telaio.current;
    try {
      telaio.current = document.querySelector(`iframe[src*="${videoId}"]`);
    } catch (e) {
      telaio.current = null;
      console.warn('[b.581] player non trovato:', e?.message || e);
    }
    return telaio.current;
  }, [videoId]);

  const comanda = useCallback((func, args = []) => {
    const f = player();
    if (!f?.contentWindow) return;
    try {
      f.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args }), ORIGINE_YT);
    } catch (e) {
      console.warn('[b.581] comando al player:', e?.message || e);
    }
  }, [player]);

  useEffect(() => {
    if (!attivo) return undefined;
    partenza.current = Date.now();
    secondi.current = 0;
    orologioVero.current = false;
    const f = player();
    try {
      f?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 'bartalk-interprete' }), ORIGINE_YT);
    } catch (e) {
      console.warn('[b.581] il player non ascolta:', e?.message || e);
    }

    const ascolta = (ev) => {
      if (ev.origin !== ORIGINE_YT) return;
      let d = null;
      try { d = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data; } catch { return; }
      const t = Number(d?.info?.currentTime);
      if (Number.isFinite(t) && t >= 0) {
        secondi.current = t;
        orologioVero.current = true;
      }
    };
    window.addEventListener('message', ascolta);
    return () => window.removeEventListener('message', ascolta);
  }, [attivo, player]);

  // ── TRADUZIONE: PREPARA, NON MOSTRA ──
  const traduci = useCallback(async (testo) => {
    const sorgente = linguaSottotitoli.current;
    if (lingueCoincidono(sorgente, lingua)) return testo;
    try {
      const sourceLang = sorgente || 'auto';
      const r = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: testo,
          sourceLang,
          targetLang: lingua || 'en',
          sourceLangName: sourceLang,
          targetLangName: lingua || 'en',
          userToken,
        }),
        signal: AbortSignal.timeout(20000),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d || d.validationFailed) return '';
      return d.translated || d.translation || '';
    } catch (e) {
      if (e?.name !== 'AbortError') console.warn('[b.581] /api/translate:', e?.message || e);
      return '';
    }
  }, [lingua, userToken]);

  // In modalita VOCE anche il file audio viene preparato nei cinque
  // secondi di vantaggio. `preparaVoce` non riproduce niente.
  const preparaVoce = useCallback(async (testo) => {
    const rotta = viaAsiatica(lingua) ? '/api/tts' : '/api/tts-elevenlabs';
    try {
      const r = await fetch(rotta, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: testo, langCode: lingua || 'en', userToken }),
        signal: AbortSignal.timeout(20000),
      });
      if (!r.ok) return '';
      const blob = await r.blob();
      return URL.createObjectURL(blob);
    } catch (e) {
      if (e?.name !== 'AbortError') console.warn('[b.581] voce:', e?.message || e);
      return '';
    }
  }, [lingua, userToken]);

  const riproduciVoce = useCallback((indirizzo) => {
    if (!indirizzo) return;
    const a = new Audio(indirizzo);
    suona(a, parla('interpreteTitolo'));
    let chiuso = false;
    const chiudi = () => {
      if (chiuso) return;
      chiuso = true;
      try { URL.revokeObjectURL(indirizzo); } catch { /* URL gia revocato: nessuna risorsa da liberare */ }
    };
    a.onended = chiudi;
    a.onerror = chiudi;
    a.play().catch(chiudi);
  }, [parla]);

  const preparaFrase = useCallback(async (frase) => {
    const chiave = frase?.chiave;
    if (!chiave || preparando.current.has(chiave) || pronte.current.has(chiave) || dette.current.has(chiave)) return;
    const dopo = riprovaDopo.current.get(chiave) || 0;
    if (Date.now() < dopo) return;

    const modoPreparazione = modoRef.current;
    preparando.current.add(chiave);
    try {
      const tradotta = await traduci(frase.testo);
      if (!tradotta) {
        riprovaDopo.current.set(chiave, Date.now() + RITENTA_DOPO_MS);
        return;
      }

      let audioUrl = '';
      if (modoPreparazione === 'voce') audioUrl = await preparaVoce(tradotta);

      // Se mentre lavoravamo l'utente ha cambiato modalita, quel lavoro
      // appartiene al vecchio ordine e non deve uscire sul video.
      if (modoRef.current !== modoPreparazione || modoPreparazione === 'spento') {
        if (audioUrl) {
          try { URL.revokeObjectURL(audioUrl); } catch { /* lavoro scartato: URL audio non piu necessario */ }
        }
        return;
      }
      pronte.current.set(chiave, { frase, tradotta, audioUrl, modoPreparazione });
      riprovaDopo.current.delete(chiave);
    } finally {
      preparando.current.delete(chiave);
    }
  }, [preparaVoce, traduci]);

  // ── IL BATTITO: PRIMA CONSEGNA, POI PREPARA ──
  useEffect(() => {
    if (modo === 'spento' || !attivo || !frasi.length) return undefined;

    const battito = setInterval(() => {
      if (!orologioVero.current) secondi.current = (Date.now() - partenza.current) / 1000;
      const ora = secondi.current;

      // Una battuta resta solo per la durata della frase a cui appartiene.
      if (battutaFino.current && ora > battutaFino.current + TOLLERANZA_PARTENZA) {
        battutaFino.current = 0;
        setBattuta('');
      }

      // CONSEGNA: una frase pronta non esce finche' il suo timestamp non
      // arriva. Questo e' il punto che separa preparazione e sincronismo.
      for (const [chiave, pronta] of pronte.current.entries()) {
        const stato = statoFrasePreparata(pronta.frase, ora);
        if (stato === 'presto') continue;
        if (stato === 'persa' || stato === 'invalida') {
          if (pronta.audioUrl) {
            try { URL.revokeObjectURL(pronta.audioUrl); } catch { /* frase scaduta: URL audio non serve piu */ }
          }
          pronte.current.delete(chiave);
          dette.current.add(chiave);
          continue;
        }

        setBattuta(pronta.tradotta);
        battutaFino.current = Number.isFinite(Number(pronta.frase?.fine))
          ? Number(pronta.frase.fine)
          : ora + 4;
        if (modoRef.current === 'voce' && pronta.audioUrl) {
          const audioUrl = pronta.audioUrl;
          pronta.audioUrl = '';
          riproduciVoce(audioUrl);
        } else if (pronta.audioUrl) {
          try { URL.revokeObjectURL(pronta.audioUrl); } catch { /* modalita testo: URL audio non deve restare allocato */ }
        }
        pronte.current.delete(chiave);
        dette.current.add(chiave);
        break;
      }

      // PREPARAZIONE: si guarda fino a cinque secondi avanti, ma il
      // risultato viene soltanto messo in `pronte`. Non viene mostrato.
      if (preparando.current.size + pronte.current.size >= MAX_PREPARATE) return;
      const escluse = new Set([
        ...dette.current,
        ...preparando.current,
        ...pronte.current.keys(),
      ]);
      const prossima = prossimaDaDire(frasi, ora, escluse);
      if (prossima) preparaFrase(prossima);
    }, PASSO_MS);

    return () => clearInterval(battito);
  }, [modo, attivo, frasi, preparaFrase, riproduciVoce]);

  // Solo la voce tradotta zittisce l'audio originale.
  useEffect(() => {
    if (!attivo) return undefined;
    if (modo === 'voce' && pronto) comanda('mute'); else comanda('unMute');
    return () => comanda('unMute');
  }, [modo, attivo, pronto, comanda]);

  const scegli = useCallback((nuovo) => {
    if (!MODI.includes(nuovo)) return;
    vibrate(8);
    setModo(nuovo);
    setAperto(false);
    try { window.localStorage.setItem(MODO_KEY, nuovo); } catch { /* preferenza solo in memoria */ }
    try { window.dispatchEvent(new CustomEvent(MODO_EVENTO, { detail: { modo: nuovo } })); } catch { /* browser senza CustomEvent: localStorage conserva la scelta */ }
    if (typeof onCambia === 'function') onCambia(nuovo);
  }, [onCambia]);

  const voci = [
    { id: 'spento', titolo: parla('interpreteSpento'), riga: parla('interpreteSpentoDesc') },
    { id: 'sottotitoli', titolo: `${parla('interpreteSottotitoli')} ${codiceLingua}`, riga: parla('interpreteSottotitoliDesc') },
    { id: 'voce', titolo: `${parla('interpreteVoce')} ${codiceLingua}`, riga: parla('interpreteVoceDesc') },
  ];
  const acceso = modo !== 'spento';
  const titoloAcceso = voci.find((v) => v.id === modo)?.titolo;
  const etichettaComando = acceso ? titoloAcceso : `${verboTraduci} ${codiceLingua}`;

  return (
    <>
      {/* b.581 — COMANDO PRIMARIO: sempre fuori dai tre puntini. */}
      <div style={{
        position: 'absolute', left: 12, top: 116, zIndex: 7,
        fontFamily: FONT, display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
      }}>
        <button
          data-testid="traduci-video"
          onClick={() => { if (!pronto) return; vibrate(6); setAperto((v) => !v); }}
          aria-label={`${verboTraduci} ${codiceLingua}`}
          aria-expanded={aperto}
          aria-disabled={!pronto}
          disabled={!pronto}
          title={!cercati ? `${verboTraduci} ${codiceLingua}…` : (!pronto ? `${verboTraduci} ${codiceLingua} — non disponibile` : etichettaComando)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            minHeight: 44, padding: '0 13px', borderRadius: 999,
            background: acceso && pronto ? `${accento}32` : 'rgba(0,0,0,0.52)',
            border: `1px solid ${acceso && pronto ? `${accento}88` : 'rgba(255,255,255,0.22)'}`,
            color: '#fff', fontFamily: FONT, fontSize: 13, fontWeight: 500,
            cursor: pronto ? 'pointer' : 'default',
            opacity: cercati && !pronto ? 0.48 : 1,
            WebkitTapHighlightColor: 'transparent',
          }}>
          <Icon name="wand" size={16} color={acceso && pronto ? accento : '#fff'} />
          <span style={{ color: acceso && pronto ? accento : 'rgba(245,248,255,0.96)' }}>
            {etichettaComando}
          </span>
        </button>

        {aperto && pronto && (
          <div role="radiogroup" aria-label={`${verboTraduci} ${codiceLingua}`} style={{
            marginTop: 8, width: 270, padding: 6, borderRadius: 14,
            background: 'rgba(10,14,22,0.96)',
            border: `1px solid ${colori.cardBorder || 'rgba(255,255,255,0.12)'}`,
            backdropFilter: 'blur(12px)', boxShadow: '0 12px 34px rgba(0,0,0,0.38)',
          }}>
            {voci.map((v) => {
              const scelto = v.id === modo;
              return (
                <button key={v.id} role="radio" aria-checked={scelto}
                  onClick={() => scegli(v.id)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', minHeight: 48,
                    padding: '8px 10px', borderRadius: 10,
                    background: scelto ? `${accento}1F` : 'transparent',
                    border: 'none', cursor: 'pointer', fontFamily: FONT,
                    WebkitTapHighlightColor: 'transparent',
                  }}>
                  <span style={{
                    display: 'block', fontSize: 13.5, fontWeight: 500,
                    color: scelto ? accento : 'rgba(236,243,255,0.98)',
                  }}>{v.titolo}</span>
                  <span style={{
                    display: 'block', fontSize: 11.5, color: 'rgba(186,203,230,0.82)', marginTop: 2,
                  }}>{v.riga}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {acceso && pronto && battuta && (
        <div aria-live="polite" style={{
          position: 'absolute', left: 0, right: 0, zIndex: 5,
          bottom: `calc(${daFondo}px + env(safe-area-inset-bottom))`,
          padding: '0 18px', pointerEvents: 'none', textAlign: 'center',
        }}>
          <span style={{
            display: 'inline-block', padding: '9px 14px', borderRadius: 12,
            background: 'rgba(0,0,0,0.68)', color: '#fff',
            fontFamily: FONT, fontSize: 19, lineHeight: 1.35, fontWeight: 500,
            textShadow: '0 1px 3px rgba(0,0,0,0.6)',
          }}>{battuta}</span>
        </div>
      )}
    </>
  );
}
