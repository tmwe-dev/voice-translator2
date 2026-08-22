'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { memGet } from '../lib/memoria.js';
import { emailInIndirizzo, normalizzaIndirizzo, indirizzoInEmail } from '../lib/peepoff/indirizzo.js';
import { generaIdentita, improntaLeggibile, sigilla, apri } from '../lib/peepoff/busta.js';
import {
  salvaIdentita, leggiIdentita, salvaMessaggio, elencaMessaggi,
  salvaVoce, elencaCoda, attesaScalino, voceDovuta, SCADENZA_MS,
  registraImpronta, elencaContatti, riconosciCambio,
} from '../lib/peepoff/archivio.js';
import { registraDispositivo, risolvi, battito, spedisci, portiere } from '../lib/peepoff/consegna.js';

// ═══════════════════════════════════════════════════════════════
// b.349 — PEEPOFF, l'app sorella (/posta): messaggi che NON passano
// mai da un server. L'indirizzo e la tua email con # al posto di @;
// il contenuto viaggia solo nel canale diretto cifrato; "consegnato"
// esiste solo con la ricevuta firmata dal dispositivo del destinatario.
// Pelle BarTalk, identita BarTalk (stesso login), server nostro solo
// per chiavi pubbliche, presenza e aggancio.
// ═══════════════════════════════════════════════════════════════

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const C = {
  fondo: '#05070f', carta: 'rgba(255,255,255,0.05)', bordo: '1px solid rgba(255,255,255,0.10)',
  testo: '#eef2ff', muto: 'rgba(238,242,255,0.55)', accento: '#5b8cff', ciano: '#38e1ff',
  verde: '#3ddc84', rosso: '#ff5470', ambra: '#ffc44d',
};

const STATI = {
  in_coda: ['In coda', C.muto], spento: ['Destinatario spento — riprovo da solo', C.ambra],
  in_consegna: ['In consegna…', C.ciano], consegnato: ['Consegnato ✓ (ricevuta firmata)', C.verde],
  scaduto: ['Scaduto (7 giorni senza incontro)', C.rosso], errore: ['Aggancio fallito — riprovo', C.ambra],
};

export default function Posta() {
  const [stato, setStato] = useState('avvio'); // avvio | login | pronto
  const [indirizzo, setIndirizzo] = useState('');
  const [impronta, setImpronta] = useState('');
  const [scheda, setScheda] = useState('scrivi'); // scrivi | uscita | arrivo | contatti
  const [a, setA] = useState('');
  const [oggetto, setOggetto] = useState('');
  const [corpo, setCorpo] = useState('');
  const [nota, setNota] = useState('');
  const [uscita, setUscita] = useState([]);
  const [arrivo, setArrivo] = useState([]);
  const [contatti, setContatti] = useState([]);
  const [aperto, setAperto] = useState(null);
  const tokenRef = useRef(null);
  const identitaRef = useRef(null);
  const deviceIdRef = useRef('');
  const lavoroRef = useRef(false);

  const aggiorna = useCallback(async () => {
    setUscita(await elencaCoda().catch(() => []));
    setArrivo(await elencaMessaggi('arrivo').catch(() => []));
    setContatti(await elencaContatti().catch(() => []));
  }, []);

  // ── AVVIO: sessione BarTalk → identita del dispositivo → presenza ──
  useEffect(() => {
    let spegniPortiere = null;
    let battitoTimer = null;
    let vivo = true;
    (async () => {
      const token = memGet('vt-token');
      if (!token) { setStato('login'); return; }
      tokenRef.current = token;
      try {
        let id = await leggiIdentita();
        if (!id) {
          const nuova = await generaIdentita();
          id = { scambio: nuova.scambio, firma: nuova.firma, scambioPub: nuova.scambioPub, firmaPub: nuova.firmaPub, impronta: nuova.impronta, deviceId: crypto.randomUUID() };
          await salvaIdentita(id);
        }
        identitaRef.current = id;
        deviceIdRef.current = id.deviceId;
        const r = await registraDispositivo({ deviceId: id.deviceId, chiaveScambio: id.scambioPub, chiaveFirma: id.firmaPub, impronta: id.impronta }, token);
        if (!vivo) return;
        setIndirizzo(r.indirizzo);
        setImpronta(id.impronta);
        setStato('pronto');
        await aggiorna();

        battitoTimer = setInterval(() => battito(id.deviceId, token).catch(() => { /* battito perso: il prossimo recupera */ }), 25000);
        battito(id.deviceId, token).catch(() => { /* il primo battito puo perdersi: non e un guasto */ });

        // il PORTIERE: accoglie gli agganci, apre le buste, firma le ricevute
        spegniPortiere = portiere({
          mioDeviceId: id.deviceId, identita: id, userToken: token,
          // b.381 — LA FIRMA SI VERIFICA CONTRO IL DISPOSITIVO CHE HA
          // DAVVERO SPEDITO. Il portiere sa da quale dispositivo e
          // arrivata la busta e lo passa da sempre — ma qui quel dato
          // veniva ignorato, e si prendeva il PRIMO dispositivo
          // dell'indirizzo.
          //
          // Con un dispositivo solo funziona. Con tre — iPhone, Mac, PC —
          // se scrivi dal Mac e il primo in elenco e l'iPhone, si
          // verificava una firma buona con la chiave sbagliata e usciva
          // "firma non verificata" su un messaggio perfettamente
          // autentico. Cioe il sospetto cadeva sul mittente onesto.
          suMessaggio: async (busta, daIndirizzo, daDevice) => {
            const ris = await risolvi(daIndirizzo, token).catch(() => null);
            const dispMittente =
              (daDevice && ris?.dispositivi?.find((d) => d.deviceId === daDevice || d.device_id === daDevice))
              || ris?.dispositivi?.[0];
            const esito = await apri(busta, id.scambio.privateKey, dispMittente?.chiaveFirma || {});
            const m = esito.messaggio || {};
            await salvaMessaggio({
              id: crypto.randomUUID(), cartella: 'arrivo', da: daIndirizzo,
              oggetto: String(m.oggetto || '').slice(0, 200), corpo: String(m.corpo || '').slice(0, 20000),
              quando: Date.now(), firmaValida: esito.firmaValida,
            });
            if (dispMittente?.impronta) await registraImpronta(daIndirizzo, dispMittente.impronta);
            await aggiorna();
            return esito;
          },
          suErrore: (msg) => console.warn('[PeepOff]', msg),
        });
      } catch (e) {
        if (vivo) { setStato('login'); console.warn('[PeepOff] avvio fallito:', e?.message); }
      }
    })();
    return () => {
      vivo = false;
      clearInterval(battitoTimer);
      spegniPortiere?.();
      if (deviceIdRef.current && tokenRef.current) battito(deviceIdRef.current, tokenRef.current, true).catch(() => { /* congedo perso: la presenza scade da sola */ });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── IL FATTORINO: lavora la coda a scalini, si sveglia sulla presenza ──
  const lavoraCoda = useCallback(async () => {
    if (lavoroRef.current || !tokenRef.current || !identitaRef.current) return;
    lavoroRef.current = true;
    try {
      const ora = Date.now();
      for (const voce of await elencaCoda()) {
        if (!voceDovuta(voce, ora)) continue;
        if (ora - voce.creato > SCADENZA_MS) {
          await salvaVoce({ ...voce, stato: 'scaduto' });
          continue;
        }
        const ris = await risolvi(voce.a, tokenRef.current).catch(() => null);
        const disp = ris?.dispositivi?.find((d) => d.presente) || null;
        if (!ris?.esiste || !disp) {
          await salvaVoce({ ...voce, stato: ris?.esiste === false ? 'spento' : 'spento', tentativi: voce.tentativi + (disp ? 0 : 0), prossimo: ora + attesaScalino(voce.tentativi) });
          continue;
        }
        await registraImpronta(voce.a, disp.impronta);
        await salvaVoce({ ...voce, stato: 'in_consegna' });
        setUscita(await elencaCoda());
        try {
          const busta = voce.busta || await sigilla(
            { oggetto: voce.oggetto, corpo: voce.corpo, da: indirizzo, a: voce.a, quando: voce.creato },
            disp.chiaveScambio, identitaRef.current.firma.privateKey,
          );
          await spedisci({ busta, mioDeviceId: deviceIdRef.current, loroDeviceId: disp.deviceId, chiaveFirmaLoro: disp.chiaveFirma, userToken: tokenRef.current });
          await salvaVoce({ ...voce, busta: null, stato: 'consegnato', consegnato: Date.now() });
          await salvaMessaggio({ id: voce.id, cartella: 'spediti', a: voce.a, oggetto: voce.oggetto, corpo: voce.corpo, quando: voce.creato, consegnato: Date.now() });
        } catch (e) {
          await salvaVoce({ ...voce, stato: e?.message === 'spento' ? 'spento' : 'errore', tentativi: voce.tentativi + 1, prossimo: Date.now() + attesaScalino(voce.tentativi) });
        }
      }
    } finally {
      lavoroRef.current = false;
      aggiorna();
    }
  }, [indirizzo, aggiorna]);

  useEffect(() => {
    if (stato !== 'pronto') return;
    const t = setInterval(lavoraCoda, 5000);
    return () => clearInterval(t);
  }, [stato, lavoraCoda]);

  // ── SCRIVI ──
  const invia = useCallback(async () => {
    const dest = normalizzaIndirizzo(a);
    if (!dest) { setNota('Indirizzo non valido: serve la forma nome#dominio (la sua email con # al posto di @).'); return; }
    if (!corpo.trim()) { setNota('Il messaggio è vuoto.'); return; }
    setNota('');
    const ris = await risolvi(dest, tokenRef.current).catch(() => null);
    if (ris && ris.esiste === false) {
      setNota(`${dest} non è ancora su PeepOff. Invito da mandare alla sua email (${indirizzoInEmail(dest)}): "Scrivimi in segreto su ${window.location.origin}/posta — il tuo indirizzo è già ${dest}".`);
      return;
    }
    await salvaVoce({
      id: crypto.randomUUID(), a: dest, oggetto: oggetto.trim().slice(0, 200), corpo: corpo.slice(0, 20000),
      stato: 'in_coda', tentativi: 0, prossimo: 0, creato: Date.now(),
    });
    setOggetto(''); setCorpo(''); setScheda('uscita');
    await aggiorna();
    lavoraCoda();
  }, [a, oggetto, corpo, aggiorna, lavoraCoda]);

  // ── VISTE ──
  const S = {
    pagina: { minHeight: '100dvh', background: C.fondo, color: C.testo, fontFamily: FONT, padding: 16, maxWidth: 760, margin: '0 auto' },
    carta: { background: C.carta, border: C.bordo, borderRadius: 14, padding: 14, marginBottom: 10 },
    campo: { width: '100%', padding: 12, borderRadius: 12, border: C.bordo, background: 'rgba(255,255,255,0.04)', color: C.testo, fontSize: 15, fontFamily: FONT, boxSizing: 'border-box' },
    bottone: { padding: '12px 18px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${C.accento}, ${C.ciano})`, color: '#04121c', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: FONT },
    linguetta: (on) => ({ flex: 1, padding: 10, borderRadius: 12, border: on ? `1px solid ${C.accento}` : C.bordo, background: on ? 'rgba(91,140,255,0.12)' : 'transparent', color: on ? C.accento : C.muto, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: FONT }),
  };

  if (stato === 'avvio') return <main style={S.pagina}><p style={{ color: C.muto }}>Apro la cassaforte…</p></main>;
  if (stato === 'login') return (
    <main style={S.pagina}>
      <h1 style={{ fontSize: 22, margin: '20px 0 8px' }}>PeepOff</h1>
      <p style={{ color: C.muto, lineHeight: 1.6 }}>Messaggi che non passano mai da un server. Per avere il tuo indirizzo serve l'accesso BarTalk: entra dall'app e torna qui.</p>
      <Link href="/" style={{ ...S.bottone, display: 'inline-block', marginTop: 12, textDecoration: 'none' }}>Vai a BarTalk e accedi</Link>
    </main>
  );

  return (
    <main style={S.pagina}>
      <header style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>PeepOff</h1>
          <span style={{ color: C.ciano, fontWeight: 800 }}>{indirizzo}</span>
        </div>
        <div style={{ fontSize: 11, color: C.muto, marginTop: 4 }}>
          La tua impronta (confrontala a voce per certificarti): <span style={{ letterSpacing: 1 }}>{improntaLeggibile(impronta)}</span>
        </div>
        <div style={{ fontSize: 11, color: C.muto, marginTop: 2 }}>Il contenuto viaggia solo fra i dispositivi: questo server non lo vede mai.</div>
      </header>

      <nav style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button style={S.linguetta(scheda === 'scrivi')} onClick={() => setScheda('scrivi')}>Scrivi</button>
        <button style={S.linguetta(scheda === 'uscita')} onClick={() => setScheda('uscita')}>In uscita {uscita.filter((v) => v.stato !== 'consegnato').length ? `(${uscita.filter((v) => v.stato !== 'consegnato').length})` : ''}</button>
        <button style={S.linguetta(scheda === 'arrivo')} onClick={() => setScheda('arrivo')}>In arrivo {arrivo.length ? `(${arrivo.length})` : ''}</button>
        <button style={S.linguetta(scheda === 'contatti')} onClick={() => setScheda('contatti')}>Contatti</button>
      </nav>

      {scheda === 'scrivi' && (
        <section style={S.carta}>
          <input value={a} onChange={(e) => setA(e.target.value)} placeholder="A: nome#dominio (la sua email con # al posto di @)" style={{ ...S.campo, marginBottom: 8 }} />
          <input value={oggetto} onChange={(e) => setOggetto(e.target.value)} placeholder="Oggetto" style={{ ...S.campo, marginBottom: 8 }} />
          <textarea value={corpo} onChange={(e) => setCorpo(e.target.value)} rows={8} placeholder="Il messaggio (resta cifrato dal tuo dispositivo al suo)" style={{ ...S.campo, resize: 'vertical', marginBottom: 8 }} />
          {nota && <p style={{ color: C.ambra, fontSize: 13, lineHeight: 1.5 }}>{nota}</p>}
          <button style={S.bottone} onClick={invia}>Sigilla e spedisci</button>
        </section>
      )}

      {scheda === 'uscita' && (
        uscita.length === 0
          ? <p style={{ color: C.muto }}>Niente in uscita.</p>
          : uscita.sort((x, y) => y.creato - x.creato).map((v) => {
              const [testoStato, colore] = STATI[v.stato] || [v.stato, C.muto];
              return (
                <article key={v.id} style={S.carta}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <strong>{v.a}</strong>
                    <span style={{ color: colore, fontSize: 12, fontWeight: 700 }}>{testoStato}</span>
                  </div>
                  <div style={{ color: C.testo, marginTop: 4 }}>{v.oggetto || '(senza oggetto)'}</div>
                  <div style={{ color: C.muto, fontSize: 12, marginTop: 2 }}>{new Date(v.creato).toLocaleString('it-IT')}{v.tentativi ? ` · tentativi: ${v.tentativi}` : ''}</div>
                </article>
              );
            })
      )}

      {scheda === 'arrivo' && (
        arrivo.length === 0
          ? <p style={{ color: C.muto }}>Niente in arrivo. Quando qualcuno ti scrive, il messaggio arriva dritto qui — e da nessun'altra parte.</p>
          : arrivo.map((m) => (
              <article key={m.id} style={{ ...S.carta, cursor: 'pointer' }} onClick={() => setAperto(aperto === m.id ? null : m.id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <strong>{m.da}</strong>
                  <span style={{ color: m.firmaValida ? C.verde : C.ambra, fontSize: 12, fontWeight: 700 }}>
                    {m.firmaValida ? 'Firma verificata ✓' : 'Firma non verificata'}
                  </span>
                </div>
                <div style={{ marginTop: 4, fontWeight: 700 }}>{m.oggetto || '(senza oggetto)'}</div>
                <div style={{ color: C.muto, fontSize: 12, marginTop: 2 }}>{new Date(m.quando).toLocaleString('it-IT')}</div>
                {aperto === m.id && <p style={{ marginTop: 10, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{m.corpo}</p>}
              </article>
            ))
      )}

      {scheda === 'contatti' && (
        contatti.length === 0
          ? <p style={{ color: C.muto }}>Nessun contatto ancora: compaiono da soli al primo scambio, con la loro impronta.</p>
          : contatti.map((c) => (
              <article key={c.indirizzo} style={S.carta}>
                <strong>{c.indirizzo}</strong>
                <div style={{ fontSize: 11, color: C.muto, marginTop: 4, letterSpacing: 1 }}>{improntaLeggibile(c.impronta)}</div>
                {c.cambiata && (
                  <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'rgba(255,84,112,0.12)', color: C.rosso, fontSize: 13 }}>
                    Le chiavi di questo contatto sono CAMBIATE (nuovo dispositivo o recupero). Verifica a voce la nuova impronta prima di fidarti.
                    <button onClick={() => riconosciCambio(c.indirizzo).then(aggiorna)}
                      style={{ marginLeft: 10, padding: '4px 10px', borderRadius: 8, border: C.bordo, background: 'transparent', color: C.testo, cursor: 'pointer', fontFamily: FONT, fontSize: 12 }}>
                      Ho verificato
                    </button>
                  </div>
                )}
              </article>
            ))
      )}
    </main>
  );
}
