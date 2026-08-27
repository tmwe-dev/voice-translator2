import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JOIN_ROOM } from '../app/lib/redisLua.js';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// b.526 — Luca dal vivo: «in chat non traduce piu l'ospite... forse le
// impostazioni di chi invita sono mantenute». Riprodotto con due schede:
// l'ospite col nome gia presente in stanza NON diventava un secondo
// membro — sostituiva il record dell'host (lingua compresa), la stanza
// restava a UNO, e senza partner niente traduzione: "Translating..."
// appeso per sempre. L'identita era il nome.

describe('b.526 — il nome non e la persona (JOIN_ROOM)', () => {
  it('un omonimo VIVO prende il suffisso invece di sostituire', () => {
    expect(JOIN_ROOM).toContain("(not fidato) and type(m.lastSeen) == 'number' and (now - m.lastSeen) <= soglia");
    expect(JOIN_ROOM).toContain("name .. ' (' .. n .. ')'");
  });
  it('un omonimo STANTIO riprende il suo posto (riconnessione, come sempre)', () => {
    expect(JOIN_ROOM).toContain('room.members[i].lang = lang');
    expect(JOIN_ROOM).toContain('room.members[i].lastSeen = now');
  });
  it('il suffisso cerca il primo libero, anche con (2) gia occupato', () => {
    expect(JOIN_ROOM).toContain('while occupato do');
    expect(JOIN_ROOM).toContain('n = n + 1');
  });
  it('lo script torna il nome ASSEGNATO, non quello chiesto', () => {
    expect(JOIN_ROOM).toContain('return cjson.encode({stanza=room, nome=name})');
  });
});

describe('b.526 — il gettone nasce sul nome vero', () => {
  const f = leggi('app/lib/roomActions.js');
  it('handleJoin usa il nome assegnato per ruolo e sessione', () => {
    expect(f).toMatch(/const nomeVero = room\.nomeAssegnato \|\| name;/);
    expect(f).toMatch(/createRoomSession\(room\.id, nomeVero, ruoloFinale\)/);
    expect(f).toMatch(/verifiedName: nomeVero/);
  });
  it('la riammissione col gettone resta fidata: mai il suffisso a chi E lui', () => {
    expect(leggi('app/lib/store.js')).toMatch(/joinRoom\(roomId, session\.name, lang \|\| 'en', avatar \|\| null, \{ fidato: true \}\)/);
  });
});

describe('b.526 — il client sa chi e diventato', () => {
  const f = leggi('app/hooks/useRoomPolling.js');
  it('l ingresso cattura il verifiedName', () => {
    expect(f).toMatch(/if \(data\.verifiedName\) verifiedNameRef\.current = data\.verifiedName;/);
  });
  it('il rientro d emergenza usa il nome verificato, non le preferenze', () => {
    expect(f).toMatch(/name: verifiedNameRef\.current \|\| prefsRef\.current\.name/);
  });
});

describe('b.526 — «lascia lo spagnolo anche a me»', () => {
  it('la tendina della lingua ospite non esclude piu la lingua dell invitante', () => {
    const f = leggi('app/components/QuickInvite.js');
    expect(f).not.toMatch(/LANGS\.filter\(l => l\.code !== lang\)\.map/);
    expect(f).toMatch(/b\.465/);
  });
});
