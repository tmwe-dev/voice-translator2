// Prova VERA del ponte: un browser chiede una via al relay con le
// credenziali temporanee. Se coturn le accetta, arriva un candidato "relay".
import { chromium } from '@playwright/test';
import { createHmac } from 'crypto';
const SEGRETO = 'GiCsoHcBnk6wiSHp0DvPEdW33Vx5QCpwkJ6i8gor';
const scad = Math.floor(Date.now()/1000) + 600;
const username = scad + ':bartalk';
const credential = createHmac('sha1', SEGRETO).update(username).digest('base64');
const b = await chromium.launch();
const page = await (await b.newContext()).newPage();
const esito = await page.evaluate(async ({ username, credential }) => {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: ['turn:38.242.207.31:3478', 'turn:38.242.207.31:3478?transport=tcp'], username, credential }],
    iceTransportPolicy: 'relay',
  });
  pc.createDataChannel('x');
  const trovati = [];
  const fine = new Promise(r => {
    pc.onicecandidate = (e) => { if (e.candidate) trovati.push(e.candidate.candidate); else r(); };
    setTimeout(r, 8000);
  });
  await pc.setLocalDescription(await pc.createOffer());
  await fine;
  pc.close();
  return trovati;
}, { username, credential });
console.log('candidati relay ricevuti:', esito.length);
esito.slice(0,3).forEach(c => console.log(' ', c.slice(0,90)));
await b.close();
