// La prova finale: credenziali PRESE DALLA PRODUZIONE, come fa un telefono.
import { chromium } from '@playwright/test';
const r = await fetch('https://voice-translator2.vercel.app/api/turn');
const { iceServers } = await r.json();
console.log('dalla porta:', JSON.stringify(iceServers?.map(s => s.urls)));
const b = await chromium.launch();
const page = await (await b.newContext()).newPage();
const esito = await page.evaluate(async (iceServers) => {
  const pc = new RTCPeerConnection({ iceServers, iceTransportPolicy: 'relay' });
  pc.createDataChannel('x');
  const relay = [];
  const fine = new Promise(res => {
    pc.onicecandidate = (e) => { if (e.candidate) relay.push(e.candidate.candidate); else res(); };
    setTimeout(res, 9000);
  });
  await pc.setLocalDescription(await pc.createOffer());
  await fine; pc.close();
  return relay;
}, iceServers);
console.log('vie relay con credenziali di produzione:', esito.length);
esito.slice(0,2).forEach(c => console.log(' ', c.slice(0,85)));
await b.close();
