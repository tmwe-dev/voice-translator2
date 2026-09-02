import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// b.608 — Modulo F3 dell'audit di architettura (b.598): RoomView riceveva
// 66 props (l'audit ne contava 78 con i default), 45 delle quali erano
// campi di quattro hook che page.js smontava uno per uno. Ora riceve i
// quattro oggetti e li destruttura con gli stessi nomi.

describe('b.608 — RoomView: quattro oggetti per dominio, non 66 props', () => {
  const r = leggi('app/components/RoomView.js');
  const firma = r.slice(r.indexOf('const RoomView = memo(function RoomView({'), r.indexOf('}) {', r.indexOf('const RoomView = memo(')));
  const props = firma.split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
    .replace('const RoomView = memo(function RoomView({', '').split(',').map(x => x.trim()).filter(Boolean);
  it('la firma ha meno di 30 props e i quattro domini in testa', () => {
    expect(props.length).toBeLessThan(30);
    expect(props.slice(0, 4)).toEqual(['translation', 'roomPolling', 'audio', 'auth']);
  });
  it('i campi degli hook si destrutturano subito, con i nomi di prima', () => {
    expect(r).toMatch(/const \{ streamingMsg, recording,[^}]*\} = translation;/);
    expect(r).toMatch(/const \{ roomId, roomInfo, messages,[^}]*\} = roomPolling;/);
    expect(r).toMatch(/const \{ playingMsgId, audioEnabled,[^}]*\} = audio;/);
    expect(r).toMatch(/const \{ userToken, isTrial, isTopPro,[^}]*\} = auth;/);
  });
  it('page.js passa gli oggetti, non piu i 45 campi uno per uno', () => {
    const p = leggi('app/page.js');
    const blocco = p.slice(p.indexOf('<RoomView'), p.indexOf('/>', p.indexOf('<RoomView')));
    expect(blocco).toContain('translation={translation} roomPolling={roomPolling} audio={audio} auth={auth}');
    for (const morto of ['streamingMsg={translation.', 'roomId={roomPolling.', 'playingMsgId={audio.', 'isTrial={auth.']) {
      expect(blocco).not.toContain(morto);
    }
    expect((blocco.match(/=\{/g) || []).length).toBeLessThan(30);
  });
});
