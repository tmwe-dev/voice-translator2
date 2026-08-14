'use client';
import { useState, useMemo, useEffect } from 'react';
import { FONT, LANGS, getLang } from '../lib/constants.js';
import { cercaPaesi, indovinaPaese, getPaese } from '../lib/paesi.js';
import { t, mapLang, preloadLang } from '../lib/i18n.js';
import { useApp } from '../contexts/AppContext.js';

// ═══════════════════════════════════════════════════════════════
// SCELTA PAESE — la prima cosa che si vede, prima di tutto (b.136)
//
// Prima di questa schermata il primo passo era WelcomeView, che
// chiedeva la LINGUA in mezzo ad altre due cose (nome e avatar) e la
// usava per due mestieri incompatibili: la lingua parlata E quella
// dell'interfaccia. Con "La tua lingua = English (US)" si vedeva
// l'intestazione "Settings" in inglese sopra "Motore voce" e "Timbro"
// in italiano: mezza applicazione in una lingua e mezza nell'altra.
//
// Qui si sceglie il PAESE, una volta, e da quello discendono tutte e
// tre le cose insieme e coerenti:
//
//   paese -> lingua parlata (prefs.lang)
//         -> lingua dell'interfaccia (prefs.uiLang, via mapLang)
//         -> bandiera del profilo (prefs.country)
//
// Non c'e un "salta". Saltare lascerebbe lo stato indefinito, che e
// esattamente il difetto da cui veniamo: si prosegue scegliendo, e la
// scelta e gia proposta in cima — basta confermarla.
//
// ATTENZIONE: chi arriva da un invito (?room=) NON passa di qui. Vedi
// useInitializeApp.js: per l'invitato la lingua si deduce e si entra
// dritti in chat. E' un lavoro di b.133 e non va rotto.
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// LA RIGA DI UN PAESE (b.140)
//
// Era definita DENTRO SceltaPaeseView: lo stesso errore che in b.133
// faceva perdere una lettera alla volta al campo nome. Ogni battuta
// nella ricerca ricreava la funzione, React la vedeva come un tipo di
// componente nuovo e rimontava tutte le righe da capo — motivo per cui
// nessuna animazione poteva reggere e il passaggio del mouse non
// lasciava traccia. Fuori, la sua identita e stabile.
//
// L'effetto chiesto da Luca: bandiera che cresce del 18% e sotto una
// lastra di vetro sfumata. Il vetro e in `linear-gradient` con due
// stop trasparenti, non un colore pieno: cosi sopra lo sciame animato
// si vede attraverso invece di spegnerlo.
// ═══════════════════════════════════════════════════════════════
function RigaPaese({ p, selezionato, c, lingua, onScegli, onConferma, ritardo }) {
  const [sopra, setSopra] = useState(false);
  const acceso = sopra || selezionato;
  return (
    <button
      onClick={() => onScegli(p)}
      onDoubleClick={() => onConferma(p)}
      onMouseEnter={() => setSopra(true)}
      onMouseLeave={() => setSopra(false)}
      onFocus={() => setSopra(true)}
      onBlur={() => setSopra(false)}
      aria-pressed={selezionato}
      style={{
        // b.143 — LE CARD IN VETRO, SULLO SFONDO GIUSTO.
        //
        // Luca: "riprendi il formato delle cards che avevamo sullo
        // sfondo sbagliato di prima e usale qui".
        //
        // In b.142 avevo buttato via anche le card mentre toglievo lo
        // sfondo slavato: due cose diverse, e ne serviva correggere una
        // sola. Il vetro andava bene, era il fondo che non andava.
        // Ora il vetro torna, sopra il gradiente di casa.
        display: 'flex', alignItems: 'center', gap: 13, width: '100%',
        padding: '12px 14px', marginBottom: 7, textAlign: 'left',
        borderRadius: 16, cursor: 'pointer', fontFamily: FONT,
        background: selezionato
          ? `linear-gradient(120deg, ${c.accent1Bg || 'rgba(38,217,176,0.20)'} 0%, rgba(255,255,255,0.07) 65%, rgba(255,255,255,0.02) 100%)`
          : sopra
            ? 'linear-gradient(120deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.06) 60%, rgba(255,255,255,0.02) 100%)'
            : (c.glassCard || 'rgba(255,255,255,0.035)'),
        border: `1px solid ${selezionato ? (c.accent1Border || 'rgba(38,217,176,0.45)') : sopra ? 'rgba(255,255,255,0.16)' : (c.cardBorder || 'rgba(255,255,255,0.06)')}`,
        // b.143 — NIENTE backdrop-filter QUI.
        //
        // Luca: "stai espandendo l'effetto a tutta la pagina e non solo
        // le cards dei paesi". Aveva ragione, e la causa e questa riga.
        //
        // `backdrop-filter` sfoca cio che sta DIETRO l'elemento. Con
        // novantadue card impilate il browser costruisce novantadue
        // strati di sfocatura sovrapposti, e il risultato non e vetro
        // sulle card: e una nebbia grigia su tutta la finestra.
        //
        // L'effetto vetro non ha bisogno del blur: lo fanno il gradiente
        // chiaro in diagonale e il bordo sottile. Quelli restano, la
        // nebbia se ne va.
        boxShadow: acceso ? '0 10px 28px -14px rgba(0,0,0,0.75)' : 'none',
        transform: sopra ? 'translateX(6px)' : 'translateX(0)',
        animation: `vtRigaEntra 0.5s cubic-bezier(0.22,1,0.36,1) ${Math.min(ritardo, 24) * 0.035}s both`,
        transition: 'background 0.24s, border-color 0.24s, transform 0.24s, box-shadow 0.24s',
        WebkitTapHighlightColor: 'transparent',
      }}>
      {/* Bandiera NUDA: il riquadro col bordo che avevo copiato da Home
          la incassava come fosse un'icona qualsiasi. E l'unica immagine
          della riga, deve stare libera. */}
      <span style={{
        fontSize: 27, lineHeight: 1, flexShrink: 0, display: 'inline-block',
        transform: acceso ? 'scale(1.2) rotate(-4deg)' : 'scale(1) rotate(0deg)',
        filter: acceso ? 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' : 'none',
        transition: 'transform 0.26s cubic-bezier(0.34,1.4,0.64,1), filter 0.26s',
      }}>{p.bandiera}</span>

      {/* Anche il nome cresce, non solo la bandiera: cosi l'ingrandimento
          e di TUTTA la riga e non di un dettaglio. L'origine a sinistra
          perche crescendo dal centro il testo scivolerebbe via. */}
      <span style={{
        flex: 1, minWidth: 0, display: 'block',
        transformOrigin: 'left center',
        transform: acceso ? 'scale(1.05)' : 'scale(1)',
        transition: 'transform 0.26s cubic-bezier(0.34,1.4,0.64,1)',
      }}>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 700,
          color: selezionato ? (c.accent1 || '#26D9B0') : (c.textPrimary || '#fff'),
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {p.nome}
        </span>
        <span style={{ display: 'block', fontSize: 12, color: c.textMuted || 'rgba(255,255,255,0.45)', marginTop: 2 }}>
          {lingua.name}
        </span>
      </span>
      {p.nome !== p.nomeEn && (
        <span style={{ fontSize: 11, color: c.textMuted || 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
          {p.nomeEn}
        </span>
      )}
    </button>
  );
}

export default function SceltaPaeseView({ onFatto }) {
  const { S, prefs, savePrefs, theme } = useApp();
  const c = S?.colors || {};
  const [uscita, setUscita] = useState(false);
  const [ricerca, setRicerca] = useState('');
  const [scelto, setScelto] = useState(null);

  // La proposta in cima: se un paese e gia stato scelto (si entra qui
  // anche dalle impostazioni) e quello, altrimenti si indovina dalla
  // regione della lingua del browser e dal fuso orario.
  //
  // Si calcola UNA VOLTA SOLA: se cambiasse a ogni battuta di tasto la
  // riga in cima ballerebbe sotto le dita mentre si cerca.
  const proposto = useMemo(() => getPaese(prefs.country) || indovinaPaese(), []);
  const attivo = scelto || proposto;

  // QUI NON SI USA L() DEL CONTESTO, ed e voluto. L() legge
  // `prefs.uiLang`, che a questo punto non esiste ancora — e la
  // decisione che stiamo prendendo. La schermata parla invece la lingua
  // del paese EVIDENZIATO: chi tocca la Cina deve vedere il pulsante in
  // cinese prima di confermare, altrimenti non sa cosa sta scegliendo.
  const linguaSchermata = mapLang(attivo?.lingua || prefs.uiLang || 'en');
  const L = (chiave) => t(linguaSchermata, chiave);

  useEffect(() => { preloadLang(linguaSchermata); }, [linguaSchermata]);

  // b.136-bis — L'ITALIA COMPARIVA DUE VOLTE.
  //
  // Provato al primo avvio: il paese proposto stava in cima sotto
  // "Suggerito per te" e POI di nuovo, identico, come prima voce di
  // "Tutti i paesi". Sembrava un errore di caricamento.
  //
  // Quando non si sta cercando, il proposto lo si toglie dall'elenco
  // sotto: e gia in cima, evidenziato. Durante una ricerca invece resta
  // tutto, perche li conta solo cio che si cerca e nascondere un
  // risultato valido sarebbe peggio di ripeterlo.
  const risultati = useMemo(() => {
    const tutti = cercaPaesi(ricerca);
    if (ricerca || !proposto) return tutti;
    return tutti.filter(p => p.codice !== proposto.codice);
  }, [ricerca, proposto]);

  // b.140 — IL PASSAGGIO ALLA PAGINA DOPO.
  //
  // Prima la schermata spariva di colpo. Ora si congeda: sale di un
  // filo e sfuma in 260 ms, poi si cambia vista. Il tempo qui e legato
  // a `vtPaeseEsce` piu sotto — se si cambia uno vanno cambiati tutti e
  // due, altrimenti si vede un lampo di vuoto.
  function conferma(paese) {
    if (!paese) return;
    setUscita(true);
    setTimeout(() => confermaDavvero(paese), 260);
  }

  function confermaDavvero(paese) {
    if (!paese) return;
    const linguaParlata = LANGS.find(l => l.code === paese.lingua) ? paese.lingua : 'en';
    const nuove = {
      ...prefs,
      country: paese.codice,
      lang: linguaParlata,
      uiLang: mapLang(linguaParlata),
    };
    savePrefs(nuove);
    onFatto?.(nuove);
  }

  // b.140 — LO SFONDO OPACO SPEGNEVA LO SCIAME.
  //
  // `page.js` disegna gia SpatialBackdrop e Sciame sotto questa vista
  // (passa da `wrap`, e 'paese' non e fra le schermate senza velo). Ma
  // qui sopra c'era un gradiente PIENO a tutto schermo che li copriva:
  // gli effetti c'erano e non si vedevano.
  //
  // Ora e un velo semitrasparente: da profondita al testo e lascia
  // passare le particelle che si muovono dietro.
  // b.141 — LA STESSA GRAFICA DELLE ALTRE PAGINE.
  //
  // In b.140 avevo reso lo sfondo semitrasparente per far vedere lo
  // sciame: il risultato era un grigio slavato che non somigliava a
  // nessun'altra schermata. HomeView, Impostazioni e tutte le altre
  // usano `S.page` — il gradiente di casa, dal tema. Questa deve
  // sembrare la stessa applicazione, non una pagina a parte.
  //
  // La profondita la danno il velo e le card in vetro, non la
  // trasparenza del fondo.
  // Fondo PIENO, senza trasparenze: il velo lo danno le card, non la
  // pagina. Se il fondo e semitrasparente si vede lo sciame ma tutto il
  // resto sbiadisce, ed e cio che rendeva la schermata grigia.
  const sfondo = S.page.background;


  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: sfondo, color: c.textPrimary || '#fff', fontFamily: FONT,
      display: 'flex', flexDirection: 'column',
      // Entrata all'apertura, uscita alla conferma. I 260 ms qui devono
      // combaciare con il ritardo in `conferma()`: se l'animazione fosse
      // piu lunga si vedrebbe la vista nuova comparire sotto questa.
      animation: uscita ? 'vtPaeseEsce 0.26s ease-in forwards' : 'vtPaeseEntra 0.55s cubic-bezier(0.22,1,0.36,1)',
      paddingTop: 'max(20px, env(safe-area-inset-top))',
    }}>
      <div style={{ padding: '0 20px 12px', width: '100%', maxWidth: 480, margin: '0 auto', boxSizing: 'border-box' }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase',
          color: c.accent1 || '#26D9B0', marginBottom: 10 }}>BARTALK</div>
        <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0, lineHeight: 1.2, letterSpacing: -0.4 }}>
          {L('countryTitle')}
        </h1>
        <div style={{ fontSize: 13, color: c.textMuted || 'rgba(255,255,255,0.5)', marginTop: 7, lineHeight: 1.5 }}>
          {L('countrySubtitle')}
        </div>

        <input
          type="search"
          value={ricerca}
          onChange={(e) => setRicerca(e.target.value)}
          placeholder={L('countrySearch')}
          aria-label={L('countrySearch')}
          style={{
            width: '100%', boxSizing: 'border-box', marginTop: 16,
            padding: '13px 15px', borderRadius: 15, fontFamily: FONT, fontSize: 15,
            background: c.inputBg || 'rgba(255,255,255,0.04)',
            border: `1px solid ${c.inputBorder || 'rgba(255,255,255,0.09)'}`,
            color: c.textPrimary || '#fff', outline: 'none',
          }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        padding: '0 20px', width: '100%', maxWidth: 480, margin: '0 auto', boxSizing: 'border-box' }}>

        {/* La proposta sta in cima solo quando non si sta cercando:
            durante una ricerca l'unica cosa che conta e cio che si cerca. */}
        {!ricerca && proposto && (
          <>
            <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.3em', textTransform: 'uppercase',
              color: c.textMuted || 'rgba(255,255,255,0.4)', padding: '4px 4px 8px' }}>
              {L('countrySuggested')}
            </div>
            <RigaPaese p={proposto} c={c} lingua={getLang(proposto.lingua)}
              selezionato={attivo?.codice === proposto.codice}
              onScegli={setScelto} onConferma={conferma} ritardo={0} />
            <div style={{ height: 10 }} />
          </>
        )}

        <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.3em', textTransform: 'uppercase',
          color: c.textMuted || 'rgba(255,255,255,0.4)', padding: '4px 4px 8px' }}>
          {L('countryAll')}
        </div>

        {risultati.length === 0 && (
          <div style={{ padding: '24px 4px', fontSize: 13, color: c.textMuted || 'rgba(255,255,255,0.4)' }}>
            {L('countryNone')}
          </div>
        )}
        {risultati.map((p, i) => (
          <RigaPaese key={p.codice} p={p} c={c} lingua={getLang(p.lingua)}
            selezionato={attivo?.codice === p.codice}
            onScegli={setScelto} onConferma={conferma} ritardo={i} />
        ))}

        <div style={{ height: 24 }} />
      </div>

      <div style={{
        padding: '12px 20px calc(16px + env(safe-area-inset-bottom))',
        width: '100%', maxWidth: 480, margin: '0 auto', boxSizing: 'border-box',
        borderTop: `1px solid ${c.cardBorder || 'rgba(255,255,255,0.06)'}`,
        background: S.page.background,
      }}>
        <button
          onClick={() => conferma(attivo)}
          disabled={!attivo}
          style={{
            width: '100%', padding: 15, borderRadius: 16,
            cursor: attivo ? 'pointer' : 'default', fontFamily: FONT,
            fontSize: 15.5, fontWeight: 800, color: attivo ? '#fff' : (c.textMuted || 'rgba(255,255,255,0.35)'),
            // b.142 — il vetro inventato in b.140 non c'entrava niente
            // col resto: i tasti principali di questa applicazione sono
            // a gradiente pieno d'accento. Questo e uno di quelli.
            background: attivo
              ? `linear-gradient(145deg, ${c.accent1 || '#26D9B0'}, ${c.accent2 || '#7C6BF5'})`
              : (c.cardBg || 'rgba(255,255,255,0.03)'),
            border: attivo ? 'none' : `1px solid ${c.cardBorder || 'rgba(255,255,255,0.06)'}`,
            boxShadow: attivo ? `0 6px 20px -6px ${c.accent1 || '#26D9B0'}70` : 'none',
            transition: 'background 0.2s, box-shadow 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
            WebkitTapHighlightColor: 'transparent',
          }}>
          {attivo && <span style={{ fontSize: 19, lineHeight: 1 }}>{attivo.bandiera}</span>}
          {L('countryConfirm')}
        </button>
      </div>

      <style>{`
        @keyframes vtPaeseEntra { from { opacity: 0; transform: translateY(12px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes vtPaeseEsce  { to { opacity: 0; transform: translateY(-14px) scale(0.99); } }
        @keyframes vtRigaEntra  { from { opacity: 0; transform: translateY(18px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
    </div>
  );
}
