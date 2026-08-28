'use client';
import TendinaVetro from '../ui/TendinaVetro.js'; // b.535 — la tendina unica dell'app
import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { useApp } from '../../contexts/AppContext.js';
import { FONT, LANGS, vibrate, clayCard } from '../../lib/constants.js';
import Icon from '../Icon.js';
import { COMPAGNI_PREDEFINITI, compagnoVuoto, voceDaGenere, avatarDaGenere, VOCI_ELENCO, AVATAR_SCELTE, MODELLI, LIBERTA, LIBERTA_ETICHETTE } from '../../lib/compagni/catalogo.js';
import { PROFILI, PROFILI_ELENCO, SUPERFICI_PROFILO, profiloPerSuperficie } from '../../lib/compagni/profili.js';
import { salvaMio, cancellaMio, dimenticaMio, parlaTurno, generaAgente, generaAvatar } from '../../lib/compagni/cliente.js';
import { salvaImmagine, elencoImmagini } from '../../lib/compagni/galleria.js';
import { componiPersonalita } from '../../lib/compagni/genera.js';
import { compatibilitaVoceLingua } from '../../lib/vociLingue.js';
import { conRipiego } from '../../lib/ripiego.js';
import Ascolta from '../Ascolta.js';  // b.404 — una sola grafica per ascoltare

// b.212 — le barre "stile ElevenLabs": l'utente regola il carattere a vista.
const BARRE = [
  { k: 'tono', nome: 'Tono', a: 'Formale', b: 'Informale' },
  { k: 'calore', nome: 'Calore', a: 'Distaccato', b: 'Caloroso' },
  { k: 'sintesi', nome: 'Sintesi', a: 'Conciso', b: 'Prolisso' },
  { k: 'umorismo', nome: 'Umorismo', a: 'Serio', b: 'Spiritoso' },
  { k: 'assertivita', nome: 'Assertività', a: 'Cauto', b: 'Deciso' },
  { k: 'creativita', nome: 'Libertà creativa', a: 'Preciso', b: 'Creativo' },
];
const BARRE_NEUTRE = { tono: 50, calore: 60, sintesi: 40, umorismo: 40, assertivita: 55, creativita: 50 };
// b.221 — tetto lato client alle rigenerazioni immagine per sessione di form
// (il tetto vero sul costo è il wallet: 402 quando il credito finisce).
const MAX_GEN_IMG = 6;

// ═══════════════════════════════════════════════════════════════
// GestioneCompagni — la sezione dedicata per CREARE e GESTIRE i tuoi
// Compagni: nome, ruolo, personalità, avatar, VOCE (con anteprima),
// LINGUA, modello, libertà. Facile: una lista + un form. Salvataggio via
// /api/compagni/mie (persistenza nostra). (Luca)
//
// b.482 — QUESTA SCHEDA PASSA ALLO STANDARD DEL TEMPLATE, e cambia solo
// cio che si vede: rientri laterali a venti, ogni cosa che si tocca alta
// almeno quarantaquattro (i tre tasti dell'immagine erano quarantadue, e
// sotto quella misura il dito sbaglia mira), niente emoji ne simboli usati
// come icone, niente grassetto oltre il seicento, e i colori presi dalla
// tavolozza del tema — che questo file dichiarava gia in cima e poi
// ignorava in una dozzina di punti. Le parole vengono dai pacchetti
// lingua: restano scritte a mano solo le tre di «dimentica», che nei
// pacchetti non ci sono ancora.
// ═══════════════════════════════════════════════════════════════

// b.533 — il modulo per una sezione nuova della KB personale.
function SezioneNuova({ L, accent, suAccento, input, muto, onAggiungi }) {
  const [tipo, setTipo] = useState('regole');
  const [titolo, setTitolo] = useState('');
  const [testo, setTesto] = useState('');
  const [tag, setTag] = useState('');
  return (
    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {/* b.535 — TendinaVetro al posto della select di sistema. */}
        <TendinaVetro valore={tipo} onScegli={setTipo} targa={L('kbSectionsTitle')}
          opzioni={['regole', 'argomento', 'contesto'].map(t => ({ id: t, label: L('kbTipo_' + t) }))}
          stile={{ ...input, flex: '0 0 130px' }} />
        <input value={titolo} onChange={(e) => setTitolo(e.target.value)} placeholder={L('kbTitlePh')} style={{ ...input, flex: 1 }} />
      </div>
      {tipo === 'argomento' && (
        <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder={L('kbTagsPh')} style={input} />
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={testo} onChange={(e) => setTesto(e.target.value)} placeholder={L('kbTextPh')} style={{ ...input, flex: 1 }} />
        <button onClick={() => {
            if (!testo.trim()) return;
            onAggiungi({ tipo, titolo: titolo.trim(), testo: testo.trim(), tag: tag.split(',').map(x => x.trim()).filter(Boolean), priorita: 5, attiva: true });
            setTitolo(''); setTesto(''); setTag('');
          }}
          style={{ padding: '0 14px', minHeight: 44, borderRadius: 10, border: 'none', background: accent, color: suAccento, fontWeight: 500, cursor: 'pointer', fontFamily: FONT }}>
          +
        </button>
      </div>
      <div style={{ fontSize: 10.5, color: muto }}>{L('kbHint')}</div>
    </div>
  );
}

function GestioneCompagni({ miei, onCambiato, L, C = {}, lingua, userToken, testoP, muto, accent, card, bordo }) {
  // I colori vengono dai token del tema: scritti a mano restavano quelli del
  // tema scuro anche sul chiaro, dove l'errore e il fondo sono altri due colori.
  // b.533 — le sezioni KB vivono nelle preferenze: qui serve il contesto.
  const { prefs, savePrefs } = useApp();
  const rosso = C.statusError;   // avvisi ed errori
  const suAccento = C.bg;        // il testo sopra una superficie in accento
  // b.482 — anche il riquadro dell'avviso prende fondo e bordo dai token:
  // erano lo stesso rosso, scritto a mano in due trasparenze diverse.
  const rossoFondo = C.accent3Bg;
  const rossoBordo = C.accent3Border;
  const [bozza, setBozza] = useState(null); // null = lista; oggetto = form aperto
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState('');
  const [barre, setBarre] = useState(BARRE_NEUTRE); // carattere a barre (aiuto di creazione)
  const [descAg, setDescAg] = useState('');         // "Crea da un personaggio"
  const [generando, setGenerando] = useState(false);
  // b.221 — generazione immagine avatar (gpt-image-1)
  const [genImg, setGenImg] = useState(false);
  const [errImg, setErrImg] = useState('');
  const [nGenImg, setNGenImg] = useState(0);
  // b.223 — upload della propria immagine + galleria su dispositivo (IndexedDB)
  const [galleria, setGalleria] = useState([]);
  const fileRef = useRef(null);
  const autoAvatarRef = useRef(null); // b.227 — agente+immagine insieme

  // b.214 — L() restituisce la CHIAVE quando manca la traduzione, quindi
  // `L(k) || fallback` non ripiegava mai. tt() ripiega davvero.
  const tt = conRipiego(L); // b.362 — unica definizione, in lib/ripiego.js

  const nuovo = () => { setErrore(''); setBarre(BARRE_NEUTRE); setBozza(compagnoVuoto()); };
  // b.317 — audit D6: in modifica le barre ripartivano NEUTRE, e toccarne una
  // ricomponeva la personalita azzerando le altre cinque. Ora si ripartono
  // dalle barre salvate del Compagno.
  const modifica = (c) => { setErrore(''); setBarre(c.barre && typeof c.barre === 'object' ? { ...BARRE_NEUTRE, ...c.barre } : BARRE_NEUTRE); setBozza({ ...c }); };
  const daBase = (c) => { setErrore(''); setBarre(BARRE_NEUTRE); setBozza({ ...c, id: '', nome: `${c.nome} (mio)`, predefinito: false }); };

  // ── Costruzione automatica del Compagno (stile RadioChat) ──
  // b.215 — la GENERAZIONE non richiede account: gira sul wallet come Podcast
  // e le altre sezioni Life (l'API /genera risponde 200 anche da ospite).
  // Prima un `if(!userToken) return` bloccava tutto in silenzio (l'errore non
  // era nemmeno reso nella lista): pulsante morto. Il gate resta solo sul
  // SALVATAGGIO (/mie), che richiede l'email di sessione.
  const crea = useCallback(async (sorpresa) => {
    setGenerando(true); setErrore('');
    try {
      const a = await generaAgente({ descrizione: descAg, sorpresa, lingua, userToken });
      const nb = { ...BARRE_NEUTRE, ...(a.barre || {}) };
      setBarre(nb);
      setBozza({
        ...compagnoVuoto(),
        nome: a.nome || descAg.trim() || '',
        ruolo: a.ruolo || '',
        personalita: componiPersonalita(a.personalita || '', nb),
        liberta: a.liberta || 'balanced',
        // b.217 — la voce segue il genere generato (prima restava Adam per tutti).
        voce: voceDaGenere(a.genere),
        // b.220 — anche l'avatar (template) segue il genere.
        avatar: avatarDaGenere(a.genere),
        // b.221 — il genere resta sulla bozza: serve al prompt dell'immagine.
        genere: a.genere || 'neutral',
      });
      setErrImg(''); setNGenImg(0);
      setDescAg('');
      // b.227 — agente E immagine insieme: subito dopo aver costruito l'agente,
      // genera anche la sua immagine (una volta). Un effetto la lancia quando la
      // bozza è pronta, così non dipende dallo stato non ancora committato.
      autoAvatarRef.current = { nome: a.nome || descAg.trim(), ruolo: a.ruolo || '', genere: a.genere || 'neutral' };
    } catch (e) {
      setErrore(e.creditoEsaurito ? L('lifeNoCredit') : (e.status === 401 ? L('lifeLoginNeeded') : L('lifeError')));
    } finally { setGenerando(false); }
  }, [descAg, lingua, userToken, L]);

  // Trascinando una barra ricompongo la riga di stile dentro la personalità.
  const cambiaBarra = (k) => (e) => {
    const nb = { ...barre, [k]: Number(e.target.value) };
    setBarre(nb);
    setBozza((b) => b ? { ...b, personalita: componiPersonalita(b.personalita, nb) } : b);
  };

  const campo = (v) => (e) => setBozza((b) => ({ ...b, [v]: e.target.value }));

  // b.305 — RIMPICCIOLISCE l'avatar prima di salvarlo. IL BUG: l'immagine
  // generata (1024px) come data URL supera 1 MB, ma il salvataggio ha un
  // tetto di 256 KB sul corpo della richiesta (apiGuard): la POST veniva
  // RIFIUTATA e il Compagno non si salvava, con errore generico. Ora si
  // riduce a una miniatura 256px JPEG (~15-30 KB): entra nel limite e si
  // vede benissimo come avatar tondo.
  const rimpicciolisci = useCallback((dataUrl, lato = 256) => new Promise((res) => {
    if (!dataUrl || !dataUrl.startsWith('data:') || dataUrl.length < 180000) return res(dataUrl);
    try {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = lato; c.height = lato;
        const ctx = c.getContext('2d');
        // ritaglio quadrato centrato
        const m = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, lato, lato);
        res(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => res(dataUrl);
      img.src = dataUrl;
    } catch { res(dataUrl); }
  }), []);

  const salva = useCallback(async () => {
    if (!userToken) { setErrore(L('lifeLoginNeeded')); return; }
    if (!bozza?.nome?.trim()) { setErrore(L('lifeNeedName')); return; }
    setSalvando(true); setErrore('');
    try {
      // b.305 — rete di sicurezza: se l'avatar e ancora un data URL pesante
      // (es. caricato da fuori), lo si rimpicciolisce prima di spedire.
      // b.317 — audit D5/D6: si salvano anche le BARRE (dal cursore) e il
      // genere: prima si perdevano al salvataggio.
      let daSalvare = { ...bozza, barre };
      if (bozza.avatar && bozza.avatar.startsWith('data:') && bozza.avatar.length > 180000) {
        daSalvare = { ...daSalvare, avatar: await rimpicciolisci(bozza.avatar) };
        setBozza(daSalvare);
      }
      await salvaMio(daSalvare, userToken);
      setBozza(null);
      if (onCambiato) await onCambiato();
    } catch (e) {
      setErrore(e.status === 401 ? L('lifeLoginNeeded') : L('lifeError'));
    } finally { setSalvando(false); }
  }, [bozza, barre, userToken, onCambiato, L]);

  const elimina = useCallback(async (id) => {
    if (!userToken) return;
    try { await cancellaMio(id, userToken); if (onCambiato) await onCambiato(); } catch { /* rete assente: la lista si aggiorna al prossimo caricamento */ }
  }, [userToken, onCambiato]);

  // b.411 · P1.17 — «DIMENTICA», il diritto che c'era e non si poteva
  // esercitare. `dimentica()` viveva in memoria.js da sempre e il piano
  // promette una memoria cancellabile, ma nessuna schermata la chiamava:
  // cercato in tutto il progetto, zero chiamanti. Una promessa di privacy
  // senza un modo di esercitarla e una frase, non una promessa.
  //
  // Vale ANCHE per i Compagni del catalogo: quelli non si possono
  // cancellare, ma possono avere ricordi tuoi. Prima non c'era proprio
  // modo di liberarsene.
  const [dimenticato, setDimenticato] = useState('');
  // b.498 — tavola 24: «la memoria e un interruttore visibile su ogni
  // Compagno». Il toggle sulla card salva subito (stesso salvaMio del
  // modulo) e ricarica la lista; se il salvataggio fallisce, l'errore
  // si vede — niente interruttori che mentono.
  const toggleMemoria = useCallback(async (c) => {
    vibrate(6);
    try {
      await salvaMio({ ...c, memoria: !c.memoria }, userToken);
      onCambiato?.();
    } catch {
      setErrore(L('genericError'));
    }
  }, [userToken, onCambiato, L]);
  const dimentica = useCallback(async (id) => {
    if (!userToken) return;
    try {
      await dimenticaMio(id, userToken);
      setDimenticato(id);
      // la conferma sparisce da sola: e un'informazione, non un allarme
      setTimeout(() => setDimenticato((x) => (x === id ? '' : x)), 2500);
    } catch { setErrore(L('lifeError')); }
  }, [userToken, L]);

  // b.219 — l'anteprima voce diceva sempre la frase generica ("Ciao, sono il
  // tuo Compagno"). Ora, se il Compagno ha un nome, la voce PRONUNCIA nome e
  // ruolo: così si sente la voce legata a QUEL personaggio (es. la voce
  // femminile che dice "Marilyn Monroe. Icona del cinema..."). Nome e ruolo
  // sono già nella lingua dell'app; se mancano, si torna alla frase generica.
  const provaVoce = useCallback((voceId) => {
    const nome = (bozza?.nome || '').trim();
    const ruolo = (bozza?.ruolo || '').trim();
    const campione = nome ? `${nome}.${ruolo ? ' ' + ruolo + '.' : ''}` : L('lifeVoiceSample');
    // b.317 — audit D4: l'anteprima provava la voce nella lingua dell'APP,
    // non in quella scelta per il Compagno: creavi "Yuki, maestra di
    // giapponese" e la sentivi in italiano. Ora prova la combinazione vera.
    // b.405 — l'anteprima si sovrapponeva a un podcast o a una lezione in
    // corso perche nasceva fuori dal registro. Ora entra come tutte le altre:
    // la voce precedente tace da sola, e Interrompi prende anche questa.
    parlaTurno({ voceId, testo: campione, lingua: bozza?.lingua || lingua, userToken, chi: nome || L('lifeVoiceSample') });
  }, [bozza, lingua, userToken, L]);

  // b.223 — carica la galleria locale (IndexedDB) quando si apre un form.
  const apertoForm = !!bozza;
  useEffect(() => {
    if (!apertoForm) return;
    let vivo = true;
    elencoImmagini(12).then((l) => { if (vivo) setGalleria(l); });
    return () => { vivo = false; };
  }, [apertoForm]);


  // Converte un URL (template /avatars/N.png o remoto) in data URL, per usarlo
  // come RIFERIMENTO nella rigenerazione (tap-to-restyle).
  const urlToDataUrl = useCallback(async (url) => {
    if (!url) return null;
    if (url.startsWith('data:')) return url;
    try {
      const blob = await fetch(url, { signal: AbortSignal.timeout(30000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */ }).then((r) => r.blob());
      return await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(null); fr.readAsDataURL(blob); });
    } catch (e) {
      // b.363 — prima questo guasto non lasciava traccia da nessuna parte: nel
      // registro non compariva nulla, e il motivo vero (rete caduta, attesa
      // scaduta, credito finito, server rotto) restava irrecuperabile.
      if (e?.name !== 'AbortError') console.warn('[b.363] urlToDataUrl:', e?.message || e);
      return null; }
  }, []);

  // b.221/b.223 — core di generazione immagine (gpt-image-1). Prende i campi
  // ESPLICITI (così può girare anche subito dopo la creazione, quando la bozza
  // non è ancora committata). Se `riferimento` è un data URL, il volto arriva da
  // lì (tap-to-restyle). Costo dal wallet; ogni immagine finisce nella galleria.
  const eseguiGeneraAvatar = useCallback(async ({ nome = '', ruolo = '', genere = 'neutral' }, riferimento = null) => {
    if (genImg || nGenImg >= MAX_GEN_IMG) return;
    setGenImg(true); setErrImg('');
    try {
      const rif = riferimento ? await urlToDataUrl(riferimento) : null;
      const dataUrl = await generaAvatar({ nome, ruolo, genere, riferimentoDataUrl: rif, userToken });
      if (dataUrl) {
        const leggero = await rimpicciolisci(dataUrl);
        setBozza((b) => b ? { ...b, avatar: leggero } : b);
        setNGenImg((n) => n + 1);
        salvaImmagine(leggero, { nome }).then(() => elencoImmagini(12)).then(setGalleria).catch(() => {});
      } else setErrImg(L('lifeAvatarErr'));
    } catch (e) {
      setErrImg(e.creditoEsaurito ? L('lifeNoCredit')
        : e.status === 401 ? L('lifeLoginNeeded')
        : e.status === 422 ? L('lifeAvatarRifiuto')
        : L('lifeAvatarErr'));
    } finally { setGenImg(false); }
  }, [genImg, nGenImg, urlToDataUrl, userToken, L]);

  // Il pulsante nel form usa i campi della bozza.
  const creaAvatar = useCallback((riferimento = null) => {
    return eseguiGeneraAvatar({ nome: (bozza?.nome || '').trim(), ruolo: (bozza?.ruolo || '').trim(), genere: bozza?.genere || 'neutral' }, riferimento);
  }, [bozza, eseguiGeneraAvatar]);

  // b.227 — agente+immagine INSIEME: quando la creazione ha appena costruito
  // la bozza, genera anche l'immagine (una volta). L'effetto legge il ref e lo
  // azzera subito, così non riparte a ogni render.
  useEffect(() => {
    const req = autoAvatarRef.current;
    if (bozza && req) { autoAvatarRef.current = null; eseguiGeneraAvatar(req); }
  }, [bozza, eseguiGeneraAvatar]);

  // b.223 — carica una tua immagine come avatar (resta sul dispositivo).
  const caricaImmagine = useCallback((e) => {
    const file = e.target?.files?.[0];
    if (e.target) e.target.value = '';
    if (!file) return;
    if (!/^image\//.test(file.type)) { setErrImg(L('lifeAvatarTipo')); return; }
    if (file.size > 6 * 1024 * 1024) { setErrImg(L('lifeAvatarPesante')); return; }
    const fr = new FileReader();
    fr.onload = () => {
      const dataUrl = fr.result;
      setBozza((b) => ({ ...b, avatar: dataUrl }));
      setErrImg('');
      salvaImmagine(dataUrl, { nome: bozza?.nome }).then(() => elencoImmagini(12)).then(setGalleria).catch(() => {});
    };
    fr.readAsDataURL(file);
  }, [bozza, L]);

  const input = { width: '100%', padding: 11, borderRadius: 10, border: bordo, background: card, color: testoP, fontSize: 14, fontFamily: FONT, boxSizing: 'border-box' };
  const etich = { fontSize: 12, color: muto, margin: '10px 0 4px', display: 'block' };

  // ── FORM ──
  if (bozza) {
    return (
      <div>
        <button onClick={() => setBozza(null)} style={{ background: card, border: bordo, borderRadius: 10, padding: '8px 12px', minHeight: 44, cursor: 'pointer', color: testoP, fontFamily: FONT, marginBottom: 8 }}>
          <Icon name="back" size={14} color={testoP} /> {L('lifeCancel')}
        </button>

        <label style={etich}>{L('lifeName')}</label>
        <input value={bozza.nome} onChange={campo('nome')} style={input} placeholder="Socrate, JFK…" />

        <label style={etich}>{L('lifeRole')}</label>
        <input value={bozza.ruolo} onChange={campo('ruolo')} style={input} placeholder={L('lifeRole')} />

        <label style={etich}>{L('lifePersonality')}</label>
        <textarea value={bozza.personalita} onChange={campo('personalita')} rows={5} style={{ ...input, resize: 'vertical' }}
          placeholder="Come parla, cosa sa, cosa evita…" />

        {/* b.212 — carattere a barre (stile ElevenLabs): regoli a vista */}
        <div style={{ marginTop: 10, padding: '12px 20px', borderRadius: 12, background: card, border: bordo }}>
          <div style={{ fontSize: 11, color: muto, marginBottom: 6, fontWeight: 500 }}>{L('lifeCharacter')}</div>
          {BARRE.map((s) => (
            <div key={s.k} style={{ margin: '9px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: testoP, marginBottom: 3 }}>
                <span style={{ fontWeight: 500 }}>{s.nome}</span>
              </div>
              <input type="range" min={0} max={100} value={barre[s.k]} onChange={cambiaBarra(s.k)}
                style={{ width: '100%', accentColor: accent, cursor: 'pointer' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: muto }}>
                <span>{s.a}</span><span>{s.b}</span>
              </div>
            </div>
          ))}
        </div>

        <label style={etich}>{L('lifeAvatar')}</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {AVATAR_SCELTE.map((a) => (
            <button key={a} onClick={() => setBozza((b) => ({ ...b, avatar: a }))}
              style={{ padding: 0, borderRadius: 10, cursor: 'pointer', border: `2px solid ${bozza.avatar === a ? accent : 'transparent'}`, background: 'none' }}>
              <img src={a} alt="" width={44} height={44} style={{ borderRadius: 8, display: 'block' }} />
            </button>
          ))}
        </div>

        {/* b.221/b.223 — immagine dell'avatar: genera dal personaggio
            (gpt-image-1), ridisegna dallo stesso volto (tap-to-restyle),
            oppure carica la tua. Le immagini restano sul dispositivo. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          <img src={bozza.avatar} alt="" width={48} height={48}
            style={{ borderRadius: 10, display: 'block', flexShrink: 0, objectFit: 'cover', border: `2px solid ${bozza.avatar?.startsWith('data:') ? accent : bordo}` }} />
          <button onClick={() => creaAvatar(null)} disabled={genImg || nGenImg >= MAX_GEN_IMG}
            style={{ padding: '0 14px', height: 44, borderRadius: 10, border: 'none', background: accent, color: suAccento, fontWeight: 500, cursor: 'pointer', fontFamily: FONT, opacity: (genImg || nGenImg >= MAX_GEN_IMG) ? 0.55 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
            {genImg ? '…' : <><Icon name="star" size={16} color={suAccento} />{L('lifeAvatarGen')}</>}
          </button>
          <button onClick={() => creaAvatar(bozza.avatar)} disabled={genImg || nGenImg >= MAX_GEN_IMG}
            style={{ padding: '0 12px', height: 44, borderRadius: 10, border: bordo, background: 'transparent', color: testoP, fontWeight: 500, cursor: 'pointer', fontFamily: FONT, opacity: (genImg || nGenImg >= MAX_GEN_IMG) ? 0.55 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="refresh" size={16} color={testoP} />{L('lifeAvatarRestyle')}
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={genImg}
            style={{ padding: '0 12px', height: 44, borderRadius: 10, border: bordo, background: 'transparent', color: testoP, fontWeight: 500, cursor: 'pointer', fontFamily: FONT, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="share" size={16} color={testoP} />{L('lifeAvatarUpload')}
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={caricaImmagine} style={{ display: 'none' }} />
          {nGenImg > 0 && <span style={{ fontSize: 11, color: muto }}>{nGenImg}/{MAX_GEN_IMG}</span>}
        </div>
        {errImg && <div style={{ color: rosso, fontSize: 12, marginTop: 6 }}>{errImg}</div>}

        {/* b.223 — galleria delle immagini salvate sul dispositivo: riusale senza ripagare. */}
        {galleria.length > 0 && <>
          <div style={{ fontSize: 11, color: muto, margin: '10px 0 4px' }}>{L('lifeAvatarGallery')}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {galleria.map((g) => (
              <button key={g.id} onClick={() => setBozza((b) => ({ ...b, avatar: g.dataUrl }))}
                style={{ padding: 0, borderRadius: 10, cursor: 'pointer', border: `2px solid ${bozza.avatar === g.dataUrl ? accent : 'transparent'}`, background: 'none' }}>
                <img src={g.dataUrl} alt="" width={44} height={44} style={{ borderRadius: 8, display: 'block', objectFit: 'cover' }} />
              </button>
            ))}
          </div>
        </>}

        <label style={etich}>{L('lifeVoice')}</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <TendinaVetro valore={bozza.voce?.id || ''} targa={L('lifeVoice')}
            onScegli={(id) => { const v = VOCI_ELENCO.find(x => x.id === id); setBozza((b) => ({ ...b, voce: v || b.voce })); }}
            opzioni={VOCI_ELENCO.map((v) => ({ id: v.id, label: v.nome }))}
            stile={{ ...input, flex: 1 }} />
          <Ascolta onAscolta={() => provaVoce(bozza.voce?.id)} parola={L('lifeTryVoice')} sfondo={accent} colore={suAccento} etichetta={L('lifeTryVoice')} />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={etich}>{L('lifeLanguage')}</label>
            <TendinaVetro valore={bozza.lingua || ''} targa={L('lifeLanguage')}
              onScegli={(id) => setBozza((b) => ({ ...b, lingua: id }))}
              opzioni={[{ id: '', label: L('lifeLangAuto') }, ...LANGS.map((l) => ({ id: l.code, label: l.name, icona: l.flag }))]}
              stile={{ ...input, width: '100%' }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={etich}>{L('lifeFreedom')}</label>
            <TendinaVetro valore={bozza.liberta} targa={L('lifeFreedom')}
              onScegli={(id) => setBozza((b) => ({ ...b, liberta: id }))}
              opzioni={LIBERTA.map((k) => ({ id: k, label: `${L('lifeFreedom')}: ${LIBERTA_ETICHETTE[k]}` }))}
              stile={{ ...input, width: '100%' }} />
          </div>
        </div>

        {/* b.317 — audit D1: AVVISO di compatibilità voce↔lingua, gia in fase
            di creazione (mai piu sorprese al primo ascolto). Se la lingua non
            ha una voce ElevenLabs dedicata lo si dice; se per quella lingua
            c'e una voce che rende meglio, la si consiglia con un tasto. */}
        {(() => {
          const comp = compatibilitaVoceLingua({ voceId: bozza.voce?.id, lingua: bozza.lingua, genere: bozza.genere || 'neutral' });
          if (!bozza.lingua) return null;
          if (!comp.ok) return (
            <div style={{ marginTop: 8, padding: '9px 20px', borderRadius: 10, background: rossoFondo, border: `1px solid ${rossoBordo}`, fontSize: 12, color: rosso }}>
              {L('lifeVoceLinguaNo')}
            </div>
          );
          if (comp.consiglio) {
            const nomeCons = VOCI_ELENCO.find((v) => v.id === comp.consiglio.id)?.nome;
            return (
              <div style={{ marginTop: 8, padding: '9px 20px', borderRadius: 10, background: `${accent}12`, border: `1px solid ${accent}44`, fontSize: 12, color: testoP, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span>{L('lifeVoceConsiglio')}{nomeCons ? ` (${nomeCons})` : ''}.</span>
                <button onClick={() => setBozza((b) => ({ ...b, voce: { id: comp.consiglio.id, nome: nomeCons || b.voce?.nome || '' } }))}
                  style={{ padding: '5px 10px', minHeight: 44, borderRadius: 8, border: 'none', background: accent, color: suAccento, fontWeight: 500, cursor: 'pointer', fontFamily: FONT, fontSize: 12 }}>
                  {L('lifeVoceUsala')}
                </button>
              </div>
            );
          }
          return null;
        })()}

        <label style={etich}>{L('lifeModel')}</label>
        <TendinaVetro valore={`${bozza.provider}|${bozza.modello}`} targa={L('lifeModel')}
          onScegli={(id) => { const [p, m] = String(id).split('|'); setBozza((b) => ({ ...b, provider: p, modello: m })); }}
          opzioni={MODELLI.map((m) => ({ id: `${m.provider}|${m.modello}`, label: m.label }))}
          stile={{ ...input, width: '100%' }} />

        <label style={{ ...etich, display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, cursor: 'pointer', marginTop: 14 }}
          onClick={() => setBozza((b) => ({ ...b, memoria: !b.memoria }))}>
          <span style={{ width: 42, height: 24, borderRadius: 999, background: bozza.memoria ? accent : card, border: bordo, position: 'relative', flexShrink: 0, transition: 'background 0.15s' }}>
            <span style={{ position: 'absolute', top: 2, left: bozza.memoria ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
          </span>
          <span><span style={{ color: testoP, fontWeight: 500 }}>{L('lifeMemory')}</span> — {L('lifeMemoryHint')}</span>
        </label>

        {/* b.237 — DEEP SETTING: identità stabile, comportamento per superficie.
            Un solo Archimede; qui si sceglie COME si comporta in Amico, Impara,
            Tavolo e Podcast (profili.js). Vuoto = default della superficie.
            Etichette dei profili da PROFILI_ELENCO (nomi di prodotto). */}
        <details style={{ marginTop: 14 }}>
          <summary style={{ ...etich, cursor: 'pointer', listStyle: 'revert' }}>Deep Setting</summary>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            {SUPERFICI_PROFILO.map((s) => (
              <div key={s}>
                <label style={etich}>{{ amico: 'Amico', impara: 'Impara', tavolo: 'Tavolo', podcast: 'Podcast' }[s]}</label>
                <TendinaVetro
                  valore={(bozza.profili && bozza.profili[s]) || ''}
                  targa={{ amico: 'Amico', impara: 'Impara', tavolo: 'Tavolo', podcast: 'Podcast' }[s]}
                  onScegli={(id) => setBozza((b) => {
                    const profili = { ...(b.profili || {}) };
                    if (id) profili[s] = id; else delete profili[s];
                    return { ...b, profili: Object.keys(profili).length ? profili : null };
                  })}
                  opzioni={[
                    { id: '', label: `\u2014 ${PROFILI[profiloPerSuperficie(s)].etichetta}` },
                    ...PROFILI_ELENCO.map((pr) => ({ id: pr.id, label: pr.etichetta })),
                  ]}
                  stile={{ ...input, width: '100%' }} />
              </div>
            ))}
          </div>
        </details>

        {errore && <div style={{ color: rosso, fontSize: 13, margin: '10px 0' }}>{errore}</div>}

        <button onClick={salva} disabled={salvando} style={{ width: '100%', marginTop: 16, padding: 14, minHeight: 44, borderRadius: 14, border: 'none', cursor: 'pointer', background: accent, color: suAccento, fontWeight: 500, fontSize: 15, fontFamily: FONT, opacity: salvando ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {salvando ? L('lifeGenerating') : <><Icon name="star" size={18} color={suAccento} />{L('lifeSave')}</>}
        </button>
      </div>
    );
  }

  // ── LISTA ──
  // b.498 — TAVOLA 24: la card e fatta di RIGHE, come sulla tavola.
  // In alto la persona (faccia 44, nome, ruolo) coi suoi comandi; sui
  // MIEI, sotto, l'interruttore della memoria — visibile, non sepolto
  // nel modulo di modifica — e la riga «dimentica», nel colore
  // dell'attenzione perche cancella. Sui predefiniti resta dimentica:
  // anche loro possono avere ricordi (b.411).
  const carta = (c, mio) => (
    <div key={c.id} style={{ ...clayCard(card), padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px' }}>
        <img src={c.avatar} alt="" width={44} height={44} style={{ borderRadius: 10 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 500, color: testoP, fontSize: 15 }}>{c.nome}</div>
          <div style={{ fontSize: 11.5, color: muto, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.ruolo}</div>
          {/* b.528 — Luca: «l'utente e in grado attraverso la sidebar di
              vedere e modificare il setting??». VEDERE: la mente di ogni
              Compagno ora e scritta sulla sua riga (era invisibile fuori
              dal form). MODIFICARE: per i predefiniti la via resta il
              Duplica (per scelta: l'originale non si tocca), per i tuoi
              il form — e vale al giro successivo, senza ricaricare:
              Tavolo, Podcast e Amico rileggono il Compagno a OGNI turno. */}
          <div style={{ fontSize: 10, color: muto, opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {(MODELLI.find((m) => m.modello === c.modello) || {}).label || `${c.provider || 'openai'} \u00b7 ${c.modello || 'gpt-4o-mini'}`}
          </div>
        </div>
        {mio
          ? <>
              <button onClick={() => modifica(c)} aria-label={L('lifeEdit')} style={{ background: 'none', border: bordo, borderRadius: 8, padding: 7, minHeight: 44, cursor: 'pointer' }}><Icon name="settings" size={14} color={testoP} /></button>
              <button onClick={() => elimina(c.id)} aria-label={L('lifeDelete')} style={{ background: 'none', border: bordo, borderRadius: 8, padding: 7, minHeight: 44, cursor: 'pointer' }}><Icon name="x" size={14} color={rosso} /></button>
            </>
          : <button onClick={() => daBase(c)} style={{ background: 'none', border: bordo, borderRadius: 8, padding: '7px 10px', minHeight: 44, cursor: 'pointer', color: accent, fontSize: 12, fontWeight: 500, fontFamily: FONT }}>{L('lifeDuplicate')}</button>}
      </div>
      {mio && (
        <button onClick={() => toggleMemoria(c)} aria-pressed={!!c.memoria}
          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
            padding: '10px 20px', minHeight: 44, background: 'none', border: 'none',
            borderTop: bordo, cursor: 'pointer', fontFamily: FONT }}>
          <span style={{ flex: 1, fontSize: 12.5, color: testoP }}>{c.memoria ? L('lifeMemoryOn') : `${L('lifeMemory')} — ${L('lifeMemoryHint')}`}</span>
          <span style={{ width: 42, height: 24, borderRadius: 999, background: c.memoria ? accent : card, border: bordo, position: 'relative', flexShrink: 0, transition: 'background 0.15s' }}>
            <span style={{ position: 'absolute', top: 2, left: c.memoria ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
          </span>
        </button>
      )}
      {/* b.411 · P1.17 — «Dimentica»: cancella cio che questo Compagno
          ricorda di te, e lascia il Compagno. Su OGNI card. */}
      <button onClick={() => dimentica(c.id)} aria-label={tt('lifeForget', 'Dimentica cio che ricorda di me')}
        title={tt('lifeForget', 'Dimentica cio che ricorda di me')}
        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 20px', minHeight: 44,
          background: 'none', border: 'none', borderTop: bordo, cursor: 'pointer',
          color: dimenticato === c.id ? accent : rosso, fontSize: 11.5, fontWeight: 500, fontFamily: FONT }}>
        {dimenticato === c.id ? tt('lifeForgotten', 'fatto') : tt('lifeForget', 'Dimentica cio che ricorda di me')}
      </button>
    </div>
  );

  return (
    <div>
      {/* b.212 — costruzione automatica: scrivi un personaggio e l'AI crea tutto */}
      <div style={{ padding: '14px 20px', ...clayCard(card), marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: testoP, marginBottom: 8 }}>{L('lifeCreateFrom')}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={descAg} onChange={(e) => setDescAg(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !generando) crea(false); }}
            placeholder={L('lifeCreateFromPh')}
            style={{ ...input, flex: 1 }} />
          <button onClick={() => crea(false)} disabled={generando}
            style={{ padding: '0 16px', minHeight: 44, borderRadius: 10, border: 'none', background: accent, color: suAccento, fontWeight: 500, cursor: 'pointer', fontFamily: FONT, opacity: generando ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
            {generando ? '…' : <><Icon name="star" size={16} color={suAccento} />{L('lifeCreate')}</>}
          </button>
        </div>
        <button onClick={() => crea(true)} disabled={generando}
          style={{ marginTop: 8, background: 'none', border: 'none', color: accent, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: FONT, padding: 4, minHeight: 44, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="zap" size={15} color={accent} />{L('lifeSurprise')}
        </button>
        {/* b.215 — la lista non rendeva mai `errore`: un fallimento di
            generazione (credito, rete, 401) spariva in silenzio. Ora si vede. */}
        {errore && <div style={{ color: rosso, fontSize: 13, marginTop: 10 }}>{errore}</div>}
      </div>

      {miei.length > 0 && <>
        <div style={{ fontSize: 12, color: muto, marginBottom: 8 }}>{L('lifeMine')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>{miei.map((c) => carta(c, true))}</div>
      </>}

      <div style={{ fontSize: 12, color: muto, marginBottom: 8 }}>{L('lifePredefined')}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{COMPAGNI_PREDEFINITI.map((c) => carta(c, false))}</div>

      {/* ═══ b.533 — LA KB PERSONALE (le Prompt Sections di RadioChat).
          Tre tipi: regole (sempre), argomento (si accende sui tag),
          contesto (sfondo). Valgono su Tavolo, Podcast e Amico: le
          rotte le iniettano nel system a ogni turno. ═══ */}
      <div style={{ padding: '14px 20px', ...clayCard(card), marginTop: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: testoP, marginBottom: 4 }}>{L('kbSectionsTitle')}</div>
        <div style={{ fontSize: 11.5, color: muto, marginBottom: 10 }}>{L('kbSectionsDesc')}</div>
        {(prefs?.sezioniPrompt || []).map((sz, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 0', borderTop: i ? bordo : 'none' }}>
            <button onClick={() => { vibrate(6); const nuove = [...prefs.sezioniPrompt]; nuove[i] = { ...sz, attiva: sz.attiva === false }; savePrefs({ ...prefs, sezioniPrompt: nuove }); }}
              aria-pressed={sz.attiva !== false} title={sz.attiva !== false ? 'ON' : 'OFF'}
              style={{ width: 34, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', flexShrink: 0, marginTop: 2,
                background: sz.attiva !== false ? accent : 'rgba(255,255,255,0.15)', position: 'relative' }}>
              <span style={{ position: 'absolute', top: 3, left: sz.attiva !== false ? 16 : 3, width: 16, height: 16, borderRadius: 8, background: '#fff', transition: 'left 0.15s' }} />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 500, color: testoP }}>
                {sz.titolo || L('kbTipo_' + (sz.tipo || 'regole'))}
                <span style={{ fontWeight: 400, color: muto }}> · {L('kbTipo_' + (sz.tipo || 'regole'))}{sz.tipo === 'argomento' && sz.tag?.length ? ` (${sz.tag.join(', ')})` : ''}</span>
              </div>
              <div style={{ fontSize: 12, color: muto, whiteSpace: 'pre-wrap' }}>{sz.testo}</div>
            </div>
            <button onClick={() => { vibrate(6); savePrefs({ ...prefs, sezioniPrompt: prefs.sezioniPrompt.filter((_, j) => j !== i) }); }}
              aria-label={L('removeWord')} style={{ width: 30, height: 30, borderRadius: 8, cursor: 'pointer', flexShrink: 0,
                background: 'none', border: bordo, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="x" size={11} color={muto} />
            </button>
          </div>
        ))}
        <SezioneNuova L={L} accent={accent} suAccento={suAccento} input={input} muto={muto}
          onAggiungi={(sz) => savePrefs({ ...prefs, sezioniPrompt: [...(prefs?.sezioniPrompt || []), sz] })} />
      </div>

      {/* b.498 — tavola 24: aggiungerne uno e la pillola grande in
          fondo, dopo cio che c'e gia. */}
      <button onClick={() => { vibrate(8); nuovo(); }}
        style={{ width: '100%', padding: 14, minHeight: 54, borderRadius: 16, border: 'none', cursor: 'pointer',
          background: accent, color: suAccento, fontWeight: 500, fontSize: 15, fontFamily: FONT,
          marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Icon name="plus" size={18} color={suAccento} /> {L('lifeCreateManual')}
      </button>
    </div>
  );
}

export default memo(GestioneCompagni);
