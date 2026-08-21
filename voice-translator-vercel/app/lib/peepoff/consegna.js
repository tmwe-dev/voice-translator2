'use client';
// ═══════════════════════════════════════════════════════════════
// b.349 — PEEPOFF · LA CONSEGNA. Il canale diretto fra due
// dispositivi: aggancio WebRTC coi segnali (offerta/risposta/
// ghiaccio) sul nostro server, poi la BUSTA passa SOLO nel canale
// cifrato — mai dal server. Consegnato = ricevuta firmata verificata.
//
// Scelta dichiarata (divergenza dall'originale, che e solo-diretto):
// se il diretto non passa si usa anche il nostro relay TURN — che
// vede soltanto byte gia cifrati, mai il contenuto.
// ═══════════════════════════════════════════════════════════════

import { sigilla, apri, firmaRicevuta, verificaRicevuta } from './busta.js';

async function chiama(azione, corpo, userToken) {
  const r = await fetch('/api/peepoff', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ azione, userToken, ...corpo }),
  });
  const d = await r.json().catch(() => null);
  if (!r.ok) { const e = new Error(d?.error || 'errore di rete'); e.status = r.status; throw e; }
  return d;
}

export const registraDispositivo = (c, t) => chiama('dispositivo', c, t);
export const risolvi = (indirizzo, t) => chiama('risolvi', { indirizzo }, t);
export const battito = (deviceId, t, spegni = false) => chiama('battito', { deviceId, spegni }, t);
// b.363 — non piu esportata: la legge solo questo file. Era offerta a
// tutto il progetto senza che nessuno la chiedesse.
const mandaSegnale = (c, t) => chiama('segnale', c, t);
// b.363 — non piu esportata: la legge solo questo file. Era offerta a
// tutto il progetto senza che nessuno la chiedesse.
const prelevaSegnali = (deviceId, t) => chiama('segnali', { deviceId }, t);

async function serventiIce() {
  try {
    const r = await fetch('/api/turn');
    const d = await r.json().catch(() => null);
    const relay = Array.isArray(d?.iceServers) ? d.iceServers : [];
    return [{ urls: 'stun:stun.l.google.com:19302' }, ...relay];
  } catch { return [{ urls: 'stun:stun.l.google.com:19302' }]; }
}

function attendi(ms) { return new Promise((r) => setTimeout(r, ms)); }

/**
 * SPEDISCE una busta a UN dispositivo del destinatario, da mittente.
 * Fa da solo tutto l'aggancio; risolve con la ricevuta verificata o
 * lancia un errore parlante ('spento', 'aggancio-fallito', 'ricevuta-invalida').
 */
export async function spedisci({ busta, mioDeviceId, loroDeviceId, chiaveFirmaLoro, userToken, tempoMaxMs = 25000 }) {
  const pc = new RTCPeerConnection({ iceServers: await serventiIce() });
  const canale = pc.createDataChannel('peepoff');
  const spegni = () => { try { pc.close(); } catch { /* il canale era gia chiuso */ } };

  try {
    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        mandaSegnale({ aDevice: loroDeviceId, daDevice: mioDeviceId, tipo: 'ghiaccio', payload: ev.candidate.toJSON() }, userToken).catch(() => { /* un candidato perso non ferma l'aggancio */ });
      }
    };
    const offerta = await pc.createOffer();
    await pc.setLocalDescription(offerta);
    await mandaSegnale({ aDevice: loroDeviceId, daDevice: mioDeviceId, tipo: 'offerta', payload: { sdp: offerta.sdp } }, userToken);

    const scadenza = Date.now() + tempoMaxMs;
    let rispostaMessa = false;

    const ricevuta = await new Promise((risolviP, boccia) => {
      let chiusa = false;
      const chiudi = (fn, v) => { if (!chiusa) { chiusa = true; fn(v); } };
      canale.onmessage = async (ev) => {
        try {
          const r = JSON.parse(ev.data);
          if (r && r.impronta && r.firma) chiudi(risolviP, r);
        } catch { /* frammento non JSON: si ignora */ }
      };
      canale.onopen = () => { canale.send(JSON.stringify({ tipo: 'busta', busta })); };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') chiudi(boccia, new Error('aggancio-fallito'));
      };
      (async () => {
        while (Date.now() < scadenza && !chiusa) {
          try {
            const { segnali } = await prelevaSegnali(mioDeviceId, userToken);
            for (const s of segnali || []) {
              if (s.da_device !== loroDeviceId) continue;
              if (s.tipo === 'risposta' && !rispostaMessa) {
                rispostaMessa = true;
                await pc.setRemoteDescription({ type: 'answer', sdp: s.payload.sdp });
              } else if (s.tipo === 'ghiaccio' && rispostaMessa) {
                await pc.addIceCandidate(s.payload).catch(() => { /* candidato tardivo: innocuo */ });
              }
            }
          } catch { /* un giro a vuoto: si riprova al prossimo */ }
          await attendi(1200);
        }
        chiudi(boccia, new Error('spento'));
      })();
    });

    const buona = await verificaRicevuta(ricevuta, busta, chiaveFirmaLoro);
    if (!buona) throw new Error('ricevuta-invalida');
    return ricevuta;
  } finally { spegni(); }
}

/**
 * IL PORTIERE del ricevente: ascolta i segnali, accetta gli agganci in
 * arrivo, apre le buste, archivia e firma la ricevuta. Ritorna la
 * funzione di spegnimento.
 */
export function portiere({ mioDeviceId, identita, userToken, suMessaggio, suErrore }) {
  let vivo = true;
  const connessioni = new Map(); // daDevice -> RTCPeerConnection

  const giro = async () => {
    while (vivo) {
      try {
        const { segnali } = await prelevaSegnali(mioDeviceId, userToken);
        for (const s of segnali || []) {
          if (s.tipo === 'offerta') {
            accetta(s).catch((e) => suErrore?.('aggancio in arrivo fallito: ' + (e?.message || e)));
          } else if (s.tipo === 'ghiaccio') {
            const pc = connessioni.get(s.da_device);
            if (pc) pc.addIceCandidate(s.payload).catch(() => { /* candidato tardivo: innocuo */ });
          }
        }
      } catch { /* rete assente: si riprova */ }
      await attendi(2500);
    }
  };

  const accetta = async (s) => {
    const pc = new RTCPeerConnection({ iceServers: await serventiIce() });
    connessioni.set(s.da_device, pc);
    pc.onicecandidate = (ev) => {
      if (ev.candidate) mandaSegnale({ aDevice: s.da_device, daDevice: mioDeviceId, tipo: 'ghiaccio', payload: ev.candidate.toJSON() }, userToken).catch(() => { /* un candidato perso non ferma l'aggancio */ });
    };
    pc.ondatachannel = (ev) => {
      ev.channel.onmessage = async (msg) => {
        try {
          const dato = JSON.parse(msg.data);
          if (dato?.tipo !== 'busta' || !dato.busta) return;
          const esito = await suMessaggio(dato.busta, s.da_address, s.da_device);
          if (esito?.improntaBusta) {
            const ric = await firmaRicevuta(esito.improntaBusta, identita.firma.privateKey);
            ev.channel.send(JSON.stringify(ric));
          }
        } catch (e) { suErrore?.('busta non apribile: ' + (e?.message || e)); }
      };
    };
    await pc.setRemoteDescription({ type: 'offer', sdp: s.payload.sdp });
    const risposta = await pc.createAnswer();
    await pc.setLocalDescription(risposta);
    await mandaSegnale({ aDevice: s.da_device, daDevice: mioDeviceId, tipo: 'risposta', payload: { sdp: risposta.sdp } }, userToken);
    // le connessioni d'ascolto si chiudono da sole dopo un minuto di quiete
    setTimeout(() => { try { pc.close(); } catch { /* la connessione era gia stata chiusa: nulla da fare */ } connessioni.delete(s.da_device); }, 60000);
  };

  giro();
  return () => {
    vivo = false;
    for (const pc of connessioni.values()) { try { pc.close(); } catch { /* la connessione era gia stata chiusa: nulla da fare */ } }
    connessioni.clear();
  };
}

export { sigilla, apri };
