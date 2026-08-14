// ═══════════════════════════════════════════════════════════════
// CLASSROOM: LO STUDENTE AUTORIZZATO PUO' DAVVERO PARLARE (b.157)
//
// Nato dall'audit dei setting chiesto da Luca (14/8), continuazione
// di b.156: "mancano ancora Classroom (alza mano)...".
//
// CONFERMATO leggendo il codice: RoomView.js aveva
//   const canTalk = roomMode === 'classroom' ? isHost : true;
// — cablato a "solo l'host", senza mai leggere nessuno stato di
// concessione. L'intero percorso alza-mano -> concedi-parola
// (TalkControls.js, handleRaiseHand/handleGrantSpeak in
// roomActions.js, i Lua SET_HAND_RAISED/GRANT_SPEAKING) scriveva uno
// stato che la UI non leggeva mai: uno studente "concesso" restava
// muto esattamente come prima.
//
// Il test legge il codice SENZA i commenti (che citano "isHost" e
// "granted" nelle spiegazioni) cosi non si autoconvince leggendo la
// propria diagnosi.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const leggi = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const senzaCommenti = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('RoomView: canTalk in classroom legge anche il permesso concesso, non solo isHost', () => {
  const src = senzaCommenti(leggi('app/components/RoomView.js'));
  const iCanTalk = src.indexOf('const canTalk =');

  it('la riga esiste', () => {
    expect(iCanTalk).toBeGreaterThan(-1);
  });

  it('non e piu cablata al solo isHost', () => {
    const riga = src.slice(iCanTalk, iCanTalk + 200);
    // Il vecchio difetto era letteralmente questa riga:
    //   const canTalk = roomMode === 'classroom' ? isHost : true;
    expect(riga).not.toMatch(/canTalk = roomMode === 'classroom' \? isHost : true;/);
  });

  it('legge un campo di concessione persistente del proprio membro', () => {
    const riga = src.slice(iCanTalk, iCanTalk + 200);
    expect(riga).toMatch(/granted/);
    expect(riga).toMatch(/isHost/); // l'host deve poter parlare comunque
  });
});

describe('GRANT_SPEAKING scrive un campo distinto da "speaking" (che ogni battuta riscrive)', () => {
  const src = senzaCommenti(leggi('app/lib/redisLua.js'));
  const iGrant = src.indexOf('export const GRANT_SPEAKING');
  const iFine = src.indexOf('export const', iGrant + 10);
  const corpo = src.slice(iGrant, iFine > -1 ? iFine : iGrant + 1200);

  it('lo script esiste ed e quello atteso', () => {
    expect(iGrant).toBeGreaterThan(-1);
  });

  it('imposta granted = true per il destinatario', () => {
    expect(corpo).toMatch(/granted = true/);
  });

  it('imposta granted = false per tutti gli altri', () => {
    expect(corpo).toMatch(/granted = false/);
  });
});

describe('UPDATE_ROOM_MODE azzera mani alzate e permessi residui ad ogni cambio modalita', () => {
  const src = senzaCommenti(leggi('app/lib/redisLua.js'));
  const iMode = src.indexOf('export const UPDATE_ROOM_MODE');
  const iFine = src.indexOf('export const', iMode + 10);
  const corpo = src.slice(iMode, iFine > -1 ? iFine : iMode + 800);

  it('resetta handRaised', () => {
    expect(corpo).toMatch(/handRaised = false/);
  });

  it('resetta granted', () => {
    expect(corpo).toMatch(/granted = false/);
  });
});
