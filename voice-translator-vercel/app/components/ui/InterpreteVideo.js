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
// L'INTERPRETE DEL VIDEO — il comando (b.551)
//
// Luca, tutto d'un fiato: «possiamo trovare il modo di silenziare
// l'audio e tradurre direttamente con elevenlabs?», «rallentiamo la
// partenza del video di 5 secondi e diamo modo al sistema di elaborare
// frasi compiute? sincronizzando poi l'audio??», «potremmo darla dove
// disponibile no??», «le scelte possibili devono essere chiare senza
// confondere l'utente».
//
// TRE STATI, NON UNO E MEZZO. Un tasto che si accende e si spegne non
// basta, perche' le cose che si possono volere sono tre e sono davvero
// diverse fra loro:
//   · SPENTO — il video e' quello dell'editore, e resta suo;
//   · SOTTOTITOLI — l'audio originale continua, in basso compare la
//     frase tradotta. Si usa col telefono in mano, di notte, in treno;
//   · VOCE — l'audio originale si zittisce e parla l'interprete.
// Ognuno dei tre e' scritto con la sua riga di spiegazione: si sceglie
// leggendo, non provando. E' l'ordine di Luca sulle scelte chiare.
//
// IL TASTO NON C'E' SE NON C'E' NIENTE DA INTERPRETARE. All'apertura si
// chiede alla rotta se questo video ha sottotitoli: se non li ha, questo
// componente non disegna niente. «Dove disponibile» vuol dire anche
// «dove non e' disponibile, non se ne parla».
//
// DOVE FINISCE IL NOSTRO E COMINCIA IL LORO. Non si tocca il video: e'
// l'iframe ufficiale di YouTube, con la sua pubblicita' e i suoi
// contatori. L'unica cosa che gli si chiede e' di abbassare il volume
// (`mute`), che e' esattamente quello che farebbe una persona con le
// dita. Il comando viaggia con postMessage verso youtube-nocookie.com —
// e funziona solo se l'iframe e' stato aperto con `enablejsapi=1`.
//
// L'OROLOGIO. Il player, se glielo si chiede (`listening`), racconta da
// solo dove sta col video: e' quello l'orologio buono. Se non risponde
// (autoplay negato, iframe senza enablejsapi) si conta il tempo da
// quando la slide e' diventata attiva. Meglio un orologio approssimato
// che nessun interprete.
// ═══════════════════════════════════════════════════════════════

const ORIGINE_YT = 'https://www.youtube-nocookie.com';
const PASSO_MS = 250;                 // ogni quarto di secondo si guarda l'ora
const MODI = ['spento', 'sottotitoli', 'voce'];

export default function InterpreteVideo({ videoId, lingua, attivo, onCambia, C, L, daFondo = 132 }) {
  // b.551 — il gettone serve alle rotte a pagamento (traduzione e voce).
  // Si legge dal contesto SENZA useApp(), che lancia se il contesto non
  // c'e': questo e' un componente di `ui/`, deve poter vivere anche
  // montato da solo in una prova o in un'anteprima.
  const ctx = useContext(AppContext);
  const userToken = ctx?.userToken || '';

  const [frasi, setFrasi] = useState([]);
  const [cercati, setCercati] = useState(false);   // la domanda e' stata fatta
  const [modo, setModo] = useState('spento');
  const [aperto, setAperto] = useState(false);
  const [battuta, setBattuta] = useState('');      // la frase tradotta, adesso

  const dette = useRef(new Set());
  const occupato = useRef(false);                  // una frase per volta
  const telaio = useRef(null);
  const partenza = useRef(0);
  const secondi = useRef(0);
  const orologioVero = useRef(false);              // il player risponde?
  const modoRef = useRef('spento');
  modoRef.current = modo;

  // le parole vengono da fuori (il pacchetto della lingua): se il
  // dizionario non c'e', si mostra la chiave invece di rompersi
  const parla = useCallback((k) => (typeof L === 'function' ? L(k) : k), [L]);
  const colori = C || {};
  const accento = colori.accent || '#26D9B0';

  // ── I SOTTOTITOLI DI QUESTO VIDEO ──
  // Si chiedono una volta per video: la rotta ha memoria di sette giorni,
  // quindi il costo vero lo paga solo il primo che guarda.
  useEffect(() => {
    let vivo = true;
    setFrasi([]); setCercati(false); setBattuta('');
    setModo('spento'); setAperto(false);
    dette.current = new Set();
    if (!videoId) return undefined;
    (async () => {
      try {
        const p = new URLSearchParams({ id: videoId, lang: lingua || 'en' });
        const r = await fetch(`/api/video/sottotitoli?${p.toString()}`, { signal: AbortSignal.timeout(12000) });
        const d = await r.json().catch(() => null);
        if (!vivo) return;
        // `disponibile` e' la stessa regola della logica pura: qui non si
        // riscrive «ci sono righe?», si chiede a chi lo sa gia'
        if (disponibile(d)) setFrasi(frasiCompiute(d.righe));
        setCercati(true);
      } catch (e) {
        if (!vivo) return;
        if (e?.name !== 'AbortError') console.warn('[b.551] sottotitoli:', e?.message || e);
        setCercati(true);
      }
    })();
    return () => { vivo = false; };
  }, [videoId, lingua]);

  // ── IL PLAYER ──
  // Non lo possediamo: lo disegna il feed. Lo si ritrova per indirizzo
  // (l'id di YouTube e' fatto solo di lettere, cifre, trattino e
  // trattino basso: nel selettore non puo' nascondersi niente).
  const player = useCallback(() => {
    if (telaio.current?.isConnected) return telaio.current;
    try {
      telaio.current = document.querySelector(`iframe[src*="${videoId}"]`);
    } catch (e) {
      telaio.current = null;
      console.warn('[b.551] player non trovato:', e?.message || e);
    }
    return telaio.current;
  }, [videoId]);

  const comanda = useCallback((func, args = []) => {
    const f = player();
    if (!f?.contentWindow) return;
    try {
      f.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args }), ORIGINE_YT);
    } catch (e) {
      console.warn('[b.551] comando al player:', e?.message || e);
    }
  }, [player]);

  // ── L'OROLOGIO ──
  useEffect(() => {
    if (!attivo) return undefined;
    partenza.current = Date.now();
    secondi.current = 0;
    orologioVero.current = false;
    const f = player();
    try {
      f?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 'bartalk-interprete' }), ORIGINE_YT);
    } catch (e) {
      console.warn('[b.551] il player non ascolta:', e?.message || e);
    }
    const ascolta = (ev) => {
      if (ev.origin !== ORIGINE_YT) return;   // parla solo chi sappiamo chi e'
      let d = null;
      try { d = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data; } catch { return; }
      const t = Number(d?.info?.currentTime);
      if (Number.isFinite(t) && t >= 0) { secondi.current = t; orologioVero.current = true; }
    };
    window.addEventListener('message', ascolta);
    return () => window.removeEventListener('message', ascolta);
  }, [attivo, player]);

  // ── LA VOCE ──
  // Ordine permanente di Luca sull'uso differenziato Asia/mondo: per
  // cinese, giapponese, coreano, thai e vietnamita la voce la fa
  // DashScope/CosyVoice (rotta /api/tts, che instrada da se'); per tutto
  // il resto ElevenLabs. La decisione sta in `viaAsiatica`, in un posto
  // solo, e qui si ubbidisce.
  const diLo = useCallback(async (testo) => {
    const asia = viaAsiatica(lingua);
    const rotta = asia ? '/api/tts' : '/api/tts-elevenlabs';
    try {
      const r = await fetch(rotta, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: testo, langCode: lingua || 'en', userToken }),
        signal: AbortSignal.timeout(20000),
      });
      if (!r.ok) return;   // niente voce: restano i sottotitoli tradotti
      const blob = await r.blob();
      const indirizzo = URL.createObjectURL(blob);
      await new Promise((risolvi) => {
        const a = new Audio(indirizzo);
        // b.405 — chi parla si registra al telecomando: cosi lo Stop
        // dell'app puo' zittire anche l'interprete, e l'interprete non
        // si mette a parlare sopra a un'altra voce.
        suona(a, parla('interpreteTitolo'));
        let fatto = false;
        const chiudi = () => { if (fatto) return; fatto = true; URL.revokeObjectURL(indirizzo); risolvi(); };
        a.onended = chiudi;
        a.onerror = chiudi;
        a.play().catch(() => chiudi());
      });
    } catch (e) {
      if (e?.name !== 'AbortError') console.warn('[b.551] voce:', e?.message || e);
    }
  }, [lingua, userToken, parla]);

  const traduci = useCallback(async (testo) => {
    try {
      const r = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: testo, sourceLang: 'auto', targetLang: lingua || 'en',
          sourceLangName: 'auto', targetLangName: lingua || 'en', userToken,
        }),
        signal: AbortSignal.timeout(20000),
      });
      const d = await r.json().catch(() => null);
      // non si spaccia l'originale per traduzione: se la risposta non e'
      // buona si sta zitti, che e' meglio che dire una cosa non tradotta
      if (!r.ok || !d || d.validationFailed) return '';
      return d.translated || d.translation || '';
    } catch (e) {
      if (e?.name !== 'AbortError') console.warn('[b.551] /api/translate:', e?.message || e);
      return '';
    }
  }, [lingua, userToken]);

  const interpreta = useCallback(async (frase) => {
    occupato.current = true;
    try {
      const tradotta = await traduci(frase.testo);
      if (!tradotta) return;
      setBattuta(tradotta);
      if (modoRef.current === 'voce') await diLo(tradotta);
    } finally {
      occupato.current = false;
    }
  }, [traduci, diLo]);

  // ── IL BATTITO ──
  // Ogni quarto di secondo: dove siamo, e c'e' una frase da preparare?
  // La rincorsa di cinque secondi la applica `prossimaDaDire`: qui non
  // si ricalcola niente, si ubbidisce.
  useEffect(() => {
    if (modo === 'spento' || !attivo || !frasi.length) return undefined;
    const battito = setInterval(() => {
      if (!orologioVero.current) secondi.current = (Date.now() - partenza.current) / 1000;
      if (occupato.current) return;
      const f = prossimaDaDire(frasi, secondi.current, dette.current);
      if (!f) return;
      dette.current.add(f.chiave);   // segnata PRIMA: nessuna frase due volte
      interpreta(f);
    }, PASSO_MS);
    return () => clearInterval(battito);
  }, [modo, attivo, frasi, interpreta]);

  // ── IL SILENZIO ──
  // Si zittisce il video solo in modo «voce»: negli altri due l'audio
  // originale e' quello che la persona vuole sentire. Uscendo si
  // restituisce sempre il volume: non si lascia un video muto a chi
  // arriva dopo di noi.
  useEffect(() => {
    if (!attivo) return undefined;
    if (modo === 'voce') comanda('mute'); else comanda('unMute');
    return () => comanda('unMute');
  }, [modo, attivo, comanda]);

  // Cambiando modo si riparte puliti: la frase sullo schermo e' di
  // prima, e le frasi gia' dette in «sottotitoli» vanno ridette se ora
  // si vuole la voce.
  const scegli = useCallback((nuovo) => {
    if (!MODI.includes(nuovo)) return;
    vibrate(8);
    dette.current = new Set();
    setBattuta('');
    setModo(nuovo);
    setAperto(false);
    if (typeof onCambia === 'function') onCambia(nuovo);
  }, [onCambia]);

  // «dove disponibile»: senza frasi non esiste nessun tasto.
  if (!cercati || !frasi.length) return null;

  const voci = [
    { id: 'spento', titolo: parla('interpreteSpento'), riga: parla('interpreteSpentoDesc') },
    { id: 'sottotitoli', titolo: parla('interpreteSottotitoli'), riga: parla('interpreteSottotitoliDesc') },
    { id: 'voce', titolo: parla('interpreteVoce'), riga: parla('interpreteVoceDesc') },
  ];
  const acceso = modo !== 'spento';

  return (
    <>
      {/* b.552 — sceso di venti punti: sopra, da b.552, c'e' la riga
          dedicata all'origine (bandiera, chi lo racconta, quando). Due
          cose nello stesso punto sono la stessa sovrapposizione che Luca
          ha fotografato in basso, solo in cima. */}
      <div style={{ position: 'absolute', left: 12, top: 116, zIndex: 6, fontFamily: FONT }}>
        <button
          onClick={() => { vibrate(6); setAperto((v) => !v); }}
          aria-label={parla('interpreteTitolo')}
          aria-expanded={aperto}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            minHeight: 44, padding: '0 12px', borderRadius: 999,
            background: acceso ? `${accento}26` : 'rgba(0,0,0,0.42)',
            border: `1px solid ${acceso ? `${accento}66` : 'rgba(255,255,255,0.16)'}`,
            color: '#fff', fontFamily: FONT, fontSize: 12.5, fontWeight: 500,
            cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
          }}>
          {/* b.551 — l'icona mono di Icon.js, non un'emoji: nell'interfaccia
              le emoji sono vietate (collaudo-manuale), e il microfono e'
              gia disegnato nel nostro archivio. */}
          <Icon name="mic" size={15} color="#fff" />
          <span style={{ color: acceso ? accento : 'rgba(236,243,255,0.92)' }}>
            {acceso ? voci.find((v) => v.id === modo)?.titolo : parla('interpreteTitolo')}
          </span>
        </button>

        {aperto && (
          <div role="radiogroup" aria-label={parla('interpreteTitolo')} style={{
            marginTop: 8, width: 250, padding: 6, borderRadius: 14,
            background: 'rgba(10,14,22,0.94)',
            border: `1px solid ${colori.cardBorder || 'rgba(255,255,255,0.12)'}`,
            backdropFilter: 'blur(10px)',
          }}>
            {voci.map((v) => {
              const scelto = v.id === modo;
              return (
                <button key={v.id} role="radio" aria-checked={scelto}
                  onClick={() => scegli(v.id)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    minHeight: 44, padding: '8px 10px', borderRadius: 10,
                    background: scelto ? `${accento}1F` : 'transparent',
                    border: 'none', cursor: 'pointer', fontFamily: FONT,
                    WebkitTapHighlightColor: 'transparent',
                  }}>
                  <span style={{
                    display: 'block', fontSize: 13, fontWeight: 500,
                    color: scelto ? accento : 'rgba(236,243,255,0.96)',
                  }}>
                    {v.titolo}
                  </span>
                  {/* la riga che spiega: si sceglie leggendo, non provando */}
                  <span style={{ display: 'block', fontSize: 11.5, color: 'rgba(186,203,230,0.82)', marginTop: 2 }}>
                    {v.riga}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* LA FRASE TRADOTTA — grande, in basso, sopra un fondo scuro:
          si legge anche su un'inquadratura chiara. Sta sopra la barra
          dei comandi di YouTube senza coprirla (b.538) e non prende
          tocchi: e' pittura, non un bersaglio. */}
      {acceso && battuta && (
        <div aria-live="polite" style={{
          // b.552 — l'altezza da terra la decide CHI OSPITA, non questo
          // pezzo: il feed sa quanto e' alto il suo piede (barra di
          // YouTube + titolo) e lo dice. Prima era un 132 scritto a mano
          // qui dentro, e quando il titolo andava a due righe i
          // sottotitoli ci finivano sopra — il difetto che Luca ha
          // fotografato.
          position: 'absolute', left: 0, right: 0, zIndex: 5,
          bottom: `calc(${daFondo}px + env(safe-area-inset-bottom))`,
          padding: '0 18px', pointerEvents: 'none', textAlign: 'center',
        }}>
          <span style={{
            display: 'inline-block', padding: '9px 14px', borderRadius: 12,
            background: 'rgba(0,0,0,0.62)', color: '#fff',
            fontFamily: FONT, fontSize: 19, lineHeight: 1.35, fontWeight: 500,
            textShadow: '0 1px 3px rgba(0,0,0,0.6)',
          }}>
            {battuta}
          </span>
        </div>
      )}
    </>
  );
}
