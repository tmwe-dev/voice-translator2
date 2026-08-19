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
  });
  pc.createDataChannel('x');
  const righe = [];
  pc.onicecandidateerror = (e) => righe.push(`ERRORE ${e.errorCode} ${e.errorText} su ${e.url}`);
  const fine = new Promise(r => {
    pc.onicecandidate = (e) => { if (e.candidate) righe.push('CAND ' + e.candidate.candidate.slice(0, 80)); else r(); };
    setTimeout(r, 10000);
  });
  await pc.setLocalDescription(await pc.createOffer());
  await fine;
  pc.close();
  return righe;
}, { username, credential });
esito.forEach(r => console.log(r));
await b.close();
