'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FONT, vibrate, LANGS, getLang } from '../../lib/constants.js';
import Icon from '../Icon.js';
import TendinaVetro from './TendinaVetro.js'; // b.535 — la tendina unica dell'app
import { testataChiusa, imparaChiusa } from '../../lib/testateChiuse.js'; // b.535

// ═══════════════════════════════════════════════════════════════
// IL LETTORE — l'articolo si legge qui, ma resta LORO.
//
// b.365, ordine di Luca: «permettimi di aprire e leggere comodamente gli
// articoli in una finestra in BarTalk».
//
// E LA DOMANDA GIUSTA CHE HA FATTO: «l'articolo l'utente deve leggerlo
// per copyright dentro il sito, ma allora perche il video o il reel
// possono vederlo dentro BarTalk?»
//
// Non e un capriccio, e una differenza vera: per il VIDEO l'editore
// FABBRICA APPOSTA un lettore da incorporare, coi suoi annunci e i suoi
// contatori — incorporarlo e accettare un invito. Per il TESTO nessuno
// fabbrica niente del genere: copiarne le parole dentro casa nostra
// sarebbe ripubblicarlo, e quello si chiama con un altro nome.
//
// Ma quello che chiede Luca e legittimo, ed e la terza strada: qui NON
// si copia niente. Si apre LA LORO PAGINA in una finestra dentro
// BarTalk — il loro sito, i loro annunci, le loro statistiche, il loro
// indirizzo scritto in alto. Noi mettiamo la cornice, non il contenuto.
//
// E QUANDO IL SITO SI RIFIUTA. Parecchi giornali vietano di essere
// aperti dentro un'altra pagina, ed e un rifiuto che il browser NON ci
// lascia leggere da fuori: non arriva nessun errore, resta solo bianco.
// L'unico modo onesto e aspettare qualche secondo e, se non e successo
// niente, dirlo e offrire il sito vero. Meglio una frase chiara che un
// rettangolo vuoto per sempre.
// ═══════════════════════════════════════════════════════════════

const ATTESA_PRIMA_DI_ARRENDERSI = 3500;

export default function LettoreArticolo({ url, titolo, fonte, dati, prefs, userToken, faccia = 'articolo', C, L, onIndietro }) {
  const [caricata, setCaricata] = useState(false);
  const [rifiutata, setRifiutata] = useState(false);
  const orologio = useRef(null);
  const telaio = useRef(null);

  // b.516 — Luca dal vivo: «il riassunto non lo voglio [nella card],
  // voglio aprire dentro la pagina l'articolo... genera la sintesi la
  // metti nella pagina dell'articolo e anche il tasto traduci». Stessa
  // "Sintesi di BarTalk" di sempre (b.153, mai il testo integrale — vedi
  // in cima al file): prima viveva nel popup SchedaArgomento, ora vive
  // qui, accanto alla pagina vera. Logica identica a SchedaArgomento.js,
  // non estratta in un hook comune per non rischiare di toccare quella
  // gia in produzione per i video.
  // b.517 — DUE OPZIONI, NON UNA. Luca: «non mi stai facendo leggere
  // l'articolo dentro la applicazione. il riassunto e una delle due
  // opzioni». La pagina vera dell'editore e la sintesi di BarTalk sono
  // due FACCE della stessa lettura, e si sceglie quale guardare: prima
  // la sintesi stava incollata sopra il riquadro e gli rubava spazio
  // sempre, anche a chi voleva solo leggere.
  // b.535 — LA PORTA CHE SAPPIAMO CHIUSA NON SI OFFRE PIU. Ordine di
  // Luca: «di sicuro non vogliamo aprire una maschera che sappiamo e'
  // vuota e ti obbliga a fare altre scelte». Se la testata e' nota per
  // rifiutare la cornice (testateChiuse: elenco seminato + imparato),
  // si atterra DIRITTI sulla sintesi; il mondo in alto a destra resta
  // la porta per l'originale sul sito.
  const [chiusaNota, setChiusaNota] = useState(() => testataChiusa(url));
  const [vista, setVista] = useState(() => (testataChiusa(url) || faccia === 'sintesi') ? 'sintesi' : 'articolo');
  useEffect(() => {
    const chiusa = testataChiusa(url);
    setChiusaNota(chiusa);
    setVista(chiusa || faccia === 'sintesi' ? 'sintesi' : 'articolo');
  }, [faccia, url]);

  const [sintesiAI, setSintesiAI] = useState('');
  const [generando, setGenerando] = useState(false);
  const [serveAccount, setServeAccount] = useState(false);
  const [errSintesi, setErrSintesi] = useState(false);
  // b.529 — LA LINGUA DELLA LETTURA LA SCEGLI TU (Luca: «inserisci al
  // posto del tasto traduci una bandiera e di fianco una freccia per
  // scegliere la lingua... che di default dovrebbe essere quella del
  // profilo»). Governa DUE cose: la lingua della sintesi, e — sulla
  // pagina vera — la versione TRADOTTA della pagina dell'editore
  // (servita da Google Translate: il contenuto resta il LORO, noi non
  // copiamo una riga; scegliendo «Originale» si torna alla pagina nuda).
  const [linguaLettura, setLinguaLettura] = useState(prefs?.lang || prefs?.uiLang || 'en');
  const lingua = linguaLettura;

  useEffect(() => {
    setCaricata(false); setRifiutata(false);
    if (!url) return;
    orologio.current = setTimeout(() => setRifiutata(true), ATTESA_PRIMA_DI_ARRENDERSI);
    return () => clearTimeout(orologio.current);
  }, [url]);

  // ogni articolo nuovo riparte pulito, e chiede subito la cache
  // condivisa: se qualcuno ha gia pagato la sintesi, arriva gratis.
  useEffect(() => {
    setSintesiAI(''); setServeAccount(false); setErrSintesi(false); setGenerando(false);
    if (!dati?.titolo) return undefined;
    let vivo = true;
    (async () => {
      try {
        const r = await fetch('/api/topics/riassunto', { signal: AbortSignal.timeout(60000),
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ titolo: dati.titolo, lang: lingua === 'orig' ? (prefs?.lang || 'en') : lingua }),
        });
        if (r.ok && vivo) {
          const d = await r.json().catch(() => null);
          if (d?.daCache && d.sintesi) setSintesiAI(d.sintesi);
        }
      } catch { /* la cache non risponde: si potra generare a mano */ }
    })();
    return () => { vivo = false; };
  }, [dati, lingua, prefs?.lang]);

  const generaSintesi = useCallback(async () => {
    if (generando || !dati?.titolo) return;
    setGenerando(true); setServeAccount(false); setErrSintesi(false);
    vibrate(10);
    try {
      const r = await fetch('/api/topics/riassunto', { signal: AbortSignal.timeout(60000),
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titolo: dati.titolo, sintesi: dati.sintesi,
          fonti: (dati.fonti || []).map((f) => ({ fonte: f.fonte, titolo: f.titolo })),
          lang: lingua === 'orig' ? (prefs?.lang || 'en') : lingua, userToken,
        }),
      });
      if (r.status === 401) { setServeAccount(true); return; }
      if (!r.ok) { setErrSintesi(true); return; }
      const d = await r.json().catch(() => null);
      if (!d) { setErrSintesi(true); return; }
      if (d.sintesi) setSintesiAI(d.sintesi);
    } catch { setErrSintesi(true); }
    finally { setGenerando(false); }
  }, [dati, generando, lingua, userToken, prefs?.lang]);

  // b.517 — «APRI E TRADUCI» non deve far premere un altro tasto: chi
  // atterra sulla faccia sintesi la trova gia in scrittura. Chi apre
  // l'articolo e passa alla sintesi dopo, idem. Parte UNA volta sola
  // per articolo, e solo se la cache condivisa non l'aveva gia.
  const chiestaRef = useRef(null);
  useEffect(() => {
    if (vista !== 'sintesi' || !dati?.titolo || sintesiAI || generando) return;
    const chiave = `${dati.titolo}|${lingua}`;
    if (chiestaRef.current === chiave) return;
    chiestaRef.current = chiave;
    generaSintesi();
  }, [vista, dati, sintesiAI, generando, generaSintesi, lingua]);

  // b.517 — TRASCINA PER TORNARE INDIETRO. Ordine di Luca: «nel mobile
  // con trascina torna alla pagina precedente». Il riquadro dell'editore
  // e un iframe: si mangia i tocchi, quindi la presa non puo stare
  // "sopra la pagina" in generale. Sta su una striscia stretta sul bordo
  // sinistro — la stessa zona da cui si torna indietro in ogni telefono.
  const presaRef = useRef(null);
  const iniziaPresa = (e) => {
    const t = e.touches?.[0];
    presaRef.current = t ? { x: t.clientX, y: t.clientY } : null;
  };
  const finiscePresa = (e) => {
    const p = presaRef.current;
    presaRef.current = null;
    const t = e.changedTouches?.[0];
    if (!p || !t) return;
    const dx = t.clientX - p.x;
    const dy = Math.abs(t.clientY - p.y);
    // orizzontale vero: almeno 60 di corsa e meno di meta in verticale,
    // altrimenti e uno scorrimento della pagina, non un "indietro".
    if (dx > 60 && dy < dx / 2) { vibrate(8); onIndietro?.(); }
  };

  // b.383 — IL RIQUADRO RESTAVA VUOTO, E NON LO DICEVA.
  //
  // Collaudo di Luca: «si ribalta correttamente ma non mostra alcun
  // contenuto». La causa e sottile: quando un sito vieta di essere
  // aperto dentro un'altra pagina, il browser non da errore — carica una
  // pagina di errore SUA e fa scattare l'evento "caricata". Noi lo
  // prendevamo per buono, spegnevamo l'avviso, e restava un rettangolo
  // bianco per sempre.
  //
  // Il modo per distinguerli e al contrario di come sembra: se riusciamo
  // a GUARDARE dentro il riquadro, vuol dire che NON c'e una pagina di
  // un altro sito — le pagine vere di altri siti sono chiuse a chiave
  // dal browser. Quindi: se si apre, e vuota; se non si apre, e piena.
  // b.535 — il rifiuto appena scoperto diventa memoria (testateChiuse):
  // dalla prossima volta niente porta finta. E QUI, subito, si passa
  // alla sintesi invece di lasciare il lucchetto in mano al lettore.
  useEffect(() => {
    if (!rifiutata) return;
    imparaChiusa(url);
    setChiusaNota(true);
    setVista('sintesi');
  }, [rifiutata, url]);

  const controllaSeVuota = useCallback(() => {
    clearTimeout(orologio.current);
    const f = telaio.current;
    if (!f) return;
    try {
      const doc = f.contentDocument;
      // ci siamo riusciti: e la pagina di errore del browser, non la loro
      const vuota = !doc || !doc.body || doc.body.innerHTML.trim().length < 40;
      if (vuota) { setRifiutata(true); setCaricata(false); return; }
      setCaricata(true);
    } catch {
      // il browser ci ha sbarrato la strada: e proprio il segno che
      // dentro c'e la pagina vera dell'altro sito.
      setCaricata(true); setRifiutata(false);
    }
  }, []);

  const dominio = (() => {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return fonte || ''; }
  })();

  const bordo = `1px solid ${C.cardBorder}`;

  return (
    // b.394 — LA STESSA DIMENTICANZA DEL CAMPO COMMENTO, sull'altra
    // faccia dello stesso foglio. Questo lettore arriva fino al bordo
    // dello schermo, e li c'e la barra di navigazione: fissa, alta 94
    // pixel piu l'area sicura. Gli ultimi 94 pixel dell'articolo
    // stavano sotto di lei. La faccia davanti — l'elenco delle notizie
    // — quello spazio se lo riserva gia; queste due dietro, no.
    // Lo spazio si prende QUI e non sul foglio comune: sul foglio si
    // sommerebbe a quello che la faccia davanti ha gia, e l'elenco
    // delle notizie perderebbe mezzo schermo.
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: C.bg,
      paddingBottom: 'calc(106px + env(safe-area-inset-bottom))', boxSizing: 'border-box' }}>
      {/* LA CORNICE: si vede sempre di chi e la pagina che si sta leggendo. */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
        borderBottom: bordo, flexShrink: 0, background: C.bg,
      }}>
        <button onClick={() => { vibrate(6); onIndietro?.(); }} aria-label={L('backWord')}
          style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0, cursor: 'pointer',
            background: 'rgba(255,255,255,0.05)', border: bordo,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <Icon name="back" size={15} color={C.textPrimary} />
        </button>

        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            display: 'block', fontSize: 13, fontWeight: 600, color: C.textPrimary, fontFamily: FONT,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{titolo || dominio}</span>
          <span style={{ display: 'block', fontSize: 10.5, color: C.textMuted, fontFamily: FONT }}>
            {dominio}
          </span>
        </span>

        <a href={url} target="_blank" rel="noreferrer noopener"
          onClick={() => vibrate(6)} aria-label={L('openOutside')}
          style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0, textDecoration: 'none',
            background: 'rgba(255,255,255,0.05)', border: bordo,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <Icon name="globe" size={15} color={C.accent} />
        </a>
      </div>

      {/* b.517 — LE DUE FACCE. La pagina vera dell'editore e la sintesi
          di BarTalk: si sceglie quale guardare, e si passa dall'una
          all'altra senza chiudere niente. La sintesi non e piu una
          striscia incollata sopra il riquadro (rubava spazio a chi
          voleva solo leggere) ma una vista intera per conto suo. */}
      {dati?.titolo && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'stretch', margin: '10px 16px 0', flexShrink: 0 }}>
        {/* bandiera + freccia: la lingua in cui leggere (default: profilo).
            INIZIO b.535 — via la <select> di sistema (Luca: «il dropdown
            stile windows non rispetta lo stile e il design»): TendinaVetro,
            la tendina unica dell'app. Stesso posto, stessa bandiera,
            pannello di vetro del template. FINE b.535 */}
        <TendinaVetro
          valore={linguaLettura}
          onScegli={(v) => setLinguaLettura(v)}
          targa={L('uiLanguage')}
          C={C}
          soloIcona
          opzioni={[
            // niente emoji in interfaccia (collaudo-manuale): il mondo e' l'icona mono
            { id: 'orig', label: L('linguaOriginale'), icona: <Icon name="globe" size={14} color={C.textPrimary} /> },
            ...LANGS.map((l) => ({ id: l.code, label: l.name, icona: l.flag })),
          ]}
          stile={{ minHeight: 44, height: '100%', padding: '0 12px', borderRadius: 12,
            border: bordo, background: 'rgba(255,255,255,0.05)', color: C.textPrimary,
            fontSize: 15, flexShrink: 0 }}
        />
        <div role="tablist" aria-label={L('readWord')} style={{
          display: 'flex', gap: 4, flex: 1, padding: 4,
          borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: bordo,
        }}>
          {/* b.535 — la testata chiusa non offre la scheda «Apri»: e' la
              porta che sappiamo vuota. Resta la sintesi, e l'originale
              vive nel mondo in alto a destra. */}
          {(chiusaNota
            ? [{ id: 'sintesi', testo: L('schedaSintesi') }]
            : [{ id: 'articolo', testo: L('newsOpen') }, { id: 'sintesi', testo: L('schedaSintesi') }]).map((f) => {
            const acceso = vista === f.id;
            return (
              <button key={f.id} role="tab" aria-selected={acceso}
                onClick={() => { vibrate(6); setVista(f.id); }}
                style={{
                  flex: 1, minHeight: 36, borderRadius: 9, border: 'none', cursor: 'pointer',
                  background: acceso ? C.accent : 'transparent',
                  color: acceso ? '#fff' : C.textSecondary,
                  fontSize: 12, fontWeight: 600, fontFamily: FONT,
                  WebkitTapHighlightColor: 'transparent',
                }}>
                {f.testo}
              </button>
            );
          })}
        </div>
        </div>
      )}

      {/* LA SINTESI, a tutta pagina quando e lei la faccia scelta */}
      {vista === 'sintesi' && dati?.titolo && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px', scrollbarWidth: 'none' }}>
          <div style={{
            padding: '14px 16px', borderRadius: 14,
            background: 'rgba(255,255,255,0.04)', border: bordo,
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: C.accent, marginBottom: 8 }}>
              {L('schedaSintesi')}
            </div>
            {sintesiAI && (
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: C.textPrimary }}>{sintesiAI}</p>
            )}
            {!sintesiAI && generando && (
              <p style={{ margin: 0, fontSize: 13, color: C.textMuted }}>{L('schedaScrivo')}</p>
            )}
            {!sintesiAI && !generando && !serveAccount && !errSintesi && (
              <button onClick={generaSintesi}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, minHeight: 40, padding: '0 14px',
                  borderRadius: 11, cursor: 'pointer', border: 'none',
                  background: `linear-gradient(135deg, ${C.accent}, ${C.purple || C.accent})`,
                  color: '#fff', fontSize: 12.5, fontWeight: 600, fontFamily: FONT,
                }}>
                <Icon name="wand" size={13} color="#fff" />
                {L('schedaGenera')}
              </button>
            )}
            {serveAccount && <p style={{ margin: 0, fontSize: 12.5, color: C.red || '#e0665c' }}>{L('schedaAccedi')}</p>}
            {errSintesi && !serveAccount && <p style={{ margin: 0, fontSize: 12.5, color: C.red || '#e0665c' }}>{L('genericError')}</p>}
          </div>
          {dati?.sintesi && (
            <p style={{
              margin: '12px 4px 0', fontSize: 12.5, lineHeight: 1.6, fontStyle: 'italic',
              color: C.textMuted, borderLeft: `2px solid ${C.cardBorder}`, paddingLeft: 10,
            }}>
              {`\u201C${dati.sintesi}\u201D`}{fonte ? ` \u2014 ${fonte}` : ''}
            </p>
          )}
        </div>
      )}

      {/* b.529 — l'articolo INTERO, tradotto, dentro l'applicazione: la
          pagina dell'editore passata dal traduttore di Google. E' sempre
          la LORO pagina (loro server, loro pubblicita): noi non ne
          copiamo ne testo ne traduzione. [ASSUNTO] alcuni editori
          bloccano anche questa cornice: vale il ripiego gia esistente
          (b.383, «apri fuori»). */}
      {/* LA PAGINA LORO */}
      <div style={{
        flex: 1, minHeight: 0, position: 'relative', background: '#fff',
        display: vista === 'articolo' ? 'block' : 'none',
      }}>
        {/* b.517 — la presa per tornare indietro trascinando: una striscia
            sul bordo sinistro, sopra il riquadro dell'editore (che
            altrimenti si mangerebbe il tocco). */}
        <div onTouchStart={iniziaPresa} onTouchEnd={finiscePresa}
          style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 22, zIndex: 4, touchAction: 'pan-y' }} />
        {url && !chiusaNota && (
          <iframe
            ref={telaio}
            src={linguaLettura === 'orig' ? url : `https://translate.google.com/translate?sl=auto&tl=${encodeURIComponent(String(linguaLettura).split('-')[0])}&u=${encodeURIComponent(url)}`}
            title={titolo || dominio}
            onLoad={controllaSeVuota}
            referrerPolicy="no-referrer-when-downgrade"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }} />
        )}

        {/* Se dopo qualche secondo non e successo niente, si dice invece di
            lasciare un rettangolo bianco che sembra un guasto nostro. */}
        {rifiutata && (
          <div style={{
            position: 'absolute', inset: 0, background: C.bg,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 14, padding: 28, textAlign: 'center',
          }}>
            <Icon name="lock" size={26} color={C.textMuted} />
            <div style={{ fontSize: 13, color: C.textMuted, fontFamily: FONT, lineHeight: 1.55, maxWidth: 300 }}>
              {L('siteBlocksReader')}
            </div>
            <a href={url} target="_blank" rel="noreferrer noopener"
              style={{
                display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none',
                padding: '11px 18px', borderRadius: 13, fontFamily: FONT,
                background: `${C.accent}1E`, border: `1px solid ${C.accent}55`,
                color: C.accent, fontSize: 13, fontWeight: 600,
              }}>
              <Icon name="link" size={14} color={C.accent} />
              {L('openOutside')} · {dominio}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
