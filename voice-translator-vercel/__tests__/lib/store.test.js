import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  JOIN_ROOM, SET_SPEAKING, ADD_COST, UPDATE_ROOM_MODE,
  CHANGE_MEMBER_LANG, SET_HAND_RAISED, GRANT_SPEAKING,
  UPDATE_HEARTBEAT, UPDATE_MESSAGE, ADD_MESSAGE, UPDATE_CONV_SUMMARY
} from '../../app/lib/redisLua.js';

// Mock Redis with EVAL support for Lua scripts
const redisStore = {};

// Simulate Lua scripts in JS (mirrors redisLua.js logic on in-memory store)
function handleEval(script, numKeys, ...rest) {
  const keys = rest.slice(0, numKeys);
  const argv = rest.slice(numKeys);

  if (script === JOIN_ROOM) {
    const data = redisStore[keys[0]];
    if (!data) return null;
    const room = JSON.parse(data);
    const [name, lang, avatarRaw, nowStr] = argv;
    const avatar = avatarRaw !== '' ? avatarRaw : null;
    const now = parseInt(nowStr);
    const existing = room.members.findIndex(m => m.name === name);
    if (existing >= 0) {
      room.members[existing].lang = lang;
      room.members[existing].joined = now;
      room.members[existing].avatar = avatar;
    } else if (room.members.length < 10) {
      room.members.push({ name, lang, joined: now, role: 'guest', avatar });
    } else {
      const idx = room.members.findIndex(m => m.role !== 'host');
      if (idx >= 0) room.members[idx] = { name, lang, joined: now, role: 'guest', avatar };
    }
    const encoded = JSON.stringify(room);
    redisStore[keys[0]] = encoded;
    return encoded;
  }

  // b.248 — il battito non e piu di sola lettura: stampa lastSeen sul
  // membro che batte (e la grazia a chi non ha ancora il campo). Mirror
  // di UPDATE_HEARTBEAT in redisLua.js, come per gli altri script qui.
  if (script === UPDATE_HEARTBEAT) {
    const data = redisStore[keys[0]];
    if (!data) return null;
    const room = JSON.parse(data);
    const [name, nowStr] = argv;
    const now = parseInt(nowStr);
    for (const m of room.members) {
      if (m.name === name) m.lastSeen = now;
      else if (typeof m.lastSeen !== 'number') m.lastSeen = now;
    }
    const encoded = JSON.stringify(room);
    redisStore[keys[0]] = encoded;
    return encoded;
  }

  if (script === SET_SPEAKING) {
    const data = redisStore[keys[0]];
    if (!data) return null;
    const room = JSON.parse(data);
    const [memberName, speakingStr, liveText, typingStr, nowStr, hasLiveTextStr] = argv;
    const speaking = speakingStr === '1';
    const typing = typingStr === '1';
    const now = parseInt(nowStr);
    const hasLiveText = hasLiveTextStr === '1';
    const member = room.members.find(m => m.name === memberName);
    if (member) {
      member.speaking = speaking;
      member.speakingAt = speaking ? now : 0;
      if (hasLiveText) member.liveText = liveText;
      else if (!speaking) member.liveText = '';
      member.typing = typing;
      member.typingAt = typing ? now : 0;
    }
    const encoded = JSON.stringify(room);
    redisStore[keys[0]] = encoded;
    return encoded;
  }

  if (script === ADD_COST) {
    const data = redisStore[keys[0]];
    if (!data) return null;
    const room = JSON.parse(data);
    room.totalCost = (room.totalCost || 0) + parseFloat(argv[0]);
    room.msgCount = (room.msgCount || 0) + 1;
    const encoded = JSON.stringify(room);
    redisStore[keys[0]] = encoded;
    return encoded;
  }

  if (script === UPDATE_ROOM_MODE) {
    const data = redisStore[keys[0]];
    if (!data) return null;
    const room = JSON.parse(data);
    room.mode = argv[0];
    // b.157 — mirror del reset di mani alzate/permesso concesso che
    // UPDATE_ROOM_MODE ora fa in redisLua.js ad ogni cambio modalita.
    for (const m of room.members) {
      m.handRaised = false;
      m.handRaisedAt = 0;
      m.granted = false;
    }
    const encoded = JSON.stringify(room);
    redisStore[keys[0]] = encoded;
    return encoded;
  }

  if (script === SET_HAND_RAISED) {
    const data = redisStore[keys[0]];
    if (!data) return null;
    const room = JSON.parse(data);
    const [memberName, raisedStr, nowStr] = argv;
    const raised = raisedStr === '1';
    const member = room.members.find(m => m.name === memberName);
    if (member) {
      member.handRaised = raised;
      member.handRaisedAt = raised ? parseInt(nowStr) : 0;
    }
    const encoded = JSON.stringify(room);
    redisStore[keys[0]] = encoded;
    return encoded;
  }

  if (script === GRANT_SPEAKING) {
    const data = redisStore[keys[0]];
    if (!data) return null;
    const room = JSON.parse(data);
    const [grantee, nowStr] = argv;
    const now = parseInt(nowStr);
    for (const m of room.members) {
      m.handRaised = false;
      m.handRaisedAt = 0;
      if (m.name === grantee) {
        m.granted = true;
        m.speaking = true;
        m.speakingAt = now;
      } else {
        m.granted = false;
        m.speaking = false;
        m.speakingAt = 0;
      }
    }
    const encoded = JSON.stringify(room);
    redisStore[keys[0]] = encoded;
    return encoded;
  }

  if (script === CHANGE_MEMBER_LANG) {
    const data = redisStore[keys[0]];
    if (!data) return null;
    const room = JSON.parse(data);
    const member = room.members.find(m => m.name === argv[0]);
    if (member) { member.lang = argv[1]; member.langChangedAt = parseInt(argv[2]); }
    const encoded = JSON.stringify(room);
    redisStore[keys[0]] = encoded;
    return encoded;
  }

  if (script === ADD_MESSAGE) {
    // KEYS[1]=room key, KEYS[2]=msgs key, ARGV[1]=msg JSON, ARGV[2]=id, ARGV[3]=now
    const roomData = redisStore[keys[0]];
    if (!roomData) return null;
    const msg = JSON.parse(argv[0]);
    msg.id = argv[1];
    msg.timestamp = parseInt(argv[2]);
    const encoded = JSON.stringify(msg);
    if (!redisStore[keys[1]]) redisStore[keys[1]] = [];
    redisStore[keys[1]].push(encoded);
    return encoded;
  }

  if (script === UPDATE_MESSAGE) {
    const msgs = redisStore[keys[0]] || [];
    const [sender, original, translated, targetLang, translationsJson] = argv;
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = JSON.parse(msgs[i]);
      if (m.sender === sender && m.original === original) {
        if (translated) m.translated = translated;
        if (targetLang) m.targetLang = targetLang;
        if (translationsJson) m.translations = JSON.parse(translationsJson);
        const encoded = JSON.stringify(m);
        msgs[i] = encoded;
        return encoded;
      }
    }
    return null;
  }

  if (script === UPDATE_CONV_SUMMARY) {
    const data = redisStore[keys[0]];
    if (!data) return null;
    const conv = JSON.parse(data);
    conv.summary = argv[0];
    const encoded = JSON.stringify(conv);
    redisStore[keys[0]] = encoded;
    return encoded;
  }

  return null;
}

const mockRedis = vi.fn(async (cmd, ...args) => {
  if (cmd === 'EVAL') {
    const [script, numKeys, ...rest] = args;
    return handleEval(script, numKeys, ...rest);
  }
  const key = args[0];
  switch (cmd) {
    case 'SET':
      redisStore[key] = args[1];
      return 'OK';
    case 'GET':
      return redisStore[key] || null;
    case 'RPUSH':
      if (!redisStore[key]) redisStore[key] = [];
      redisStore[key].push(args[1]);
      return redisStore[key].length;
    case 'LRANGE':
      return redisStore[key] || [];
    case 'LTRIM':
      return 'OK';
    case 'LSET': {
      const idx = args[1];
      if (redisStore[key] && idx < redisStore[key].length) redisStore[key][idx] = args[2];
      return 'OK';
    }
    case 'EXPIRE':
      return 1;
    default:
      return null;
  }
});

vi.mock('../../app/lib/redis.js', () => ({
  redis: (...args) => mockRedis(...args),
}));

const { createRoom, getRoom, joinRoom, setSpeaking, updateHeartbeat, addCost, updateRoomMode, changeMemberLang, addMessage, getMessages, setHandRaised, grantSpeaking } = await import('../../app/lib/store.js');

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(redisStore).forEach(k => delete redisStore[k]);
});

describe('Room Management', () => {
  it('creates a room with correct structure', async () => {
    const room = await createRoom('Luca', 'it', 'conversation', null, null, null, null, 'PRO', 'luca@test.com');
    expect(room.id).toHaveLength(8);
    expect(room.host).toBe('Luca');
    expect(room.mode).toBe('conversation');
    expect(room.hostTier).toBe('PRO');
    expect(room.hostEmail).toBe('luca@test.com');
    expect(room.members).toHaveLength(1);
    expect(room.members[0].name).toBe('Luca');
    expect(room.members[0].role).toBe('host');
    expect(room.members[0].lang).toBe('it');
    expect(room.ended).toBe(false);
    expect(room.totalCost).toBe(0);
  });

  it('getRoom retrieves stored room', async () => {
    const created = await createRoom('Luca', 'it');
    const retrieved = await getRoom(created.id);
    expect(retrieved.id).toBe(created.id);
    expect(retrieved.host).toBe('Luca');
  });

  it('getRoom returns null for missing room', async () => {
    const result = await getRoom('NONEXISTENT');
    expect(result).toBeNull();
  });

  it('getRoom returns null for empty id', async () => {
    const result = await getRoom('');
    expect(result).toBeNull();
  });

  it('getRoom is case-insensitive', async () => {
    const room = await createRoom('Luca', 'it');
    const retrieved = await getRoom(room.id.toLowerCase());
    expect(retrieved).toBeTruthy();
  });
});

describe('Join Room', () => {
  it('adds new member to room', async () => {
    const room = await createRoom('Luca', 'it');
    const updated = await joinRoom(room.id, 'Guest', 'en', null);
    expect(updated.members).toHaveLength(2);
    expect(updated.members[1].name).toBe('Guest');
    expect(updated.members[1].role).toBe('guest');
  });

  it('updates existing member on rejoin', async () => {
    const room = await createRoom('Luca', 'it');
    await joinRoom(room.id, 'Guest', 'en');
    const updated = await joinRoom(room.id, 'Guest', 'fr');
    expect(updated.members).toHaveLength(2);
    expect(updated.members[1].lang).toBe('fr');
  });

  it('returns null for nonexistent room', async () => {
    const result = await joinRoom('NOPE', 'Guest', 'en');
    expect(result).toBeNull();
  });

  it('caps members at 10', async () => {
    const room = await createRoom('Host', 'it');
    for (let i = 1; i <= 9; i++) {
      await joinRoom(room.id, `Guest${i}`, 'en');
    }
    // 10th member should replace oldest guest
    const updated = await joinRoom(room.id, 'Guest10', 'en');
    expect(updated.members.length).toBeLessThanOrEqual(10);
    // Host should still be there
    expect(updated.members.some(m => m.name === 'Host')).toBe(true);
  });
});

describe('Room Operations', () => {
  it('setSpeaking updates member state', async () => {
    const room = await createRoom('Luca', 'it');
    const updated = await setSpeaking(room.id, 'Luca', true, 'Ciao');
    const member = updated.members[0];
    expect(member.speaking).toBe(true);
    expect(member.liveText).toBe('Ciao');
  });

  it('setSpeaking clears liveText on stop', async () => {
    const room = await createRoom('Luca', 'it');
    await setSpeaking(room.id, 'Luca', true, 'Speaking...');
    const updated = await setSpeaking(room.id, 'Luca', false);
    expect(updated.members[0].speaking).toBe(false);
    expect(updated.members[0].liveText).toBe('');
  });

  it('updateHeartbeat returns room and refreshes TTL', async () => {
    const room = await createRoom('Luca', 'it');
    const result = await updateHeartbeat(room.id, 'Luca');
    expect(result).toBeTruthy();
    expect(mockRedis).toHaveBeenCalledWith('EXPIRE', expect.any(String), 3600);
  });

  it('addCost increments totalCost and msgCount', async () => {
    const room = await createRoom('Luca', 'it');
    const updated = await addCost(room.id, 0.05);
    expect(updated.totalCost).toBeCloseTo(0.05);
    expect(updated.msgCount).toBe(1);
  });

  it('updateRoomMode changes mode', async () => {
    const room = await createRoom('Luca', 'it', 'conversation');
    const updated = await updateRoomMode(room.id, 'freetalk');
    expect(updated.mode).toBe('freetalk');
  });

  it('changeMemberLang updates language', async () => {
    const room = await createRoom('Luca', 'it');
    const updated = await changeMemberLang(room.id, 'Luca', 'fr');
    expect(updated.members[0].lang).toBe('fr');
    expect(updated.members[0].langChangedAt).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// b.157 — Classroom: "alza mano" -> "l'host concede la parola"
//
// Nato dall'audit dei setting chiesto da Luca. CONFERMATO leggendo il
// codice: canTalk in RoomView.js era cablato a `isHost`, e
// grantSpeaking toccava solo "speaking"/"speakingAt" — lo stesso campo
// che ogni battuta di conversazione riscrive (SET_SPEAKING). Il
// permesso concesso dall'host non sopravviveva alla prima battuta
// successiva di NESSUNO, e comunque nessuno lo leggeva. Aggiunto un
// campo persistente dedicato, "granted", distinto da "speaking".
// ═══════════════════════════════════════════════════════════════
describe('Classroom — alza mano e concedi parola (b.157)', () => {
  it('setHandRaised alza la mano del membro giusto, non tocca gli altri', async () => {
    const room = await createRoom('Host', 'it');
    await joinRoom(room.id, 'Studente', 'en');
    const updated = await setHandRaised(room.id, 'Studente', true);
    const studente = updated.members.find(m => m.name === 'Studente');
    const host = updated.members.find(m => m.name === 'Host');
    expect(studente.handRaised).toBe(true);
    expect(studente.handRaisedAt).toBeGreaterThan(0);
    expect(host.handRaised).toBeFalsy();
  });

  it('grantSpeaking concede "granted" al destinatario e lo toglie a tutti gli altri', async () => {
    const room = await createRoom('Host', 'it');
    await joinRoom(room.id, 'Studente', 'en');
    await joinRoom(room.id, 'Studente2', 'fr');
    await setHandRaised(room.id, 'Studente', true);
    const updated = await grantSpeaking(room.id, 'Studente');
    const studente = updated.members.find(m => m.name === 'Studente');
    const studente2 = updated.members.find(m => m.name === 'Studente2');
    expect(studente.granted).toBe(true);
    expect(studente.handRaised).toBe(false);
    expect(studente2.granted).toBe(false);
  });

  it('il "granted" concesso NON sparisce alla prima battuta di conversazione successiva (bug originale)', async () => {
    const room = await createRoom('Host', 'it');
    await joinRoom(room.id, 'Studente', 'en');
    await grantSpeaking(room.id, 'Studente');
    // una battuta qualsiasi, anche di un altro membro, non deve toccare "granted"
    const updated = await setSpeaking(room.id, 'Host', true, 'Ciao a tutti');
    const studente = updated.members.find(m => m.name === 'Studente');
    expect(studente.granted).toBe(true);
  });

  it('cambiare modalita azzera mani alzate e permessi residui di un giro precedente', async () => {
    const room = await createRoom('Host', 'it', 'classroom');
    await joinRoom(room.id, 'Studente', 'en');
    await grantSpeaking(room.id, 'Studente');
    const updated = await updateRoomMode(room.id, 'classroom');
    const studente = updated.members.find(m => m.name === 'Studente');
    expect(studente.granted).toBe(false);
    expect(studente.handRaised).toBe(false);
  });
});

describe('Messages', () => {
  it('adds message to room', async () => {
    const room = await createRoom('Luca', 'it');
    const msg = await addMessage(room.id, {
      sender: 'Luca', original: 'Ciao', translated: 'Hello',
      sourceLang: 'it', targetLang: 'en'
    });
    expect(msg).toBeTruthy();
    expect(msg.id).toBeTruthy();
    expect(msg.timestamp).toBeGreaterThan(0);
    expect(msg.sender).toBe('Luca');
  });

  it('returns null for nonexistent room', async () => {
    const msg = await addMessage('NOPE', { sender: 'Luca', original: 'Test' });
    expect(msg).toBeNull();
  });

  it('getMessages returns messages after timestamp', async () => {
    const room = await createRoom('Luca', 'it');
    const before = Date.now() - 1000;
    await addMessage(room.id, { sender: 'Luca', original: 'First' });
    const msgs = await getMessages(room.id, before);
    expect(msgs.length).toBeGreaterThanOrEqual(1);
  });

  it('getMessages returns empty for nonexistent room', async () => {
    const msgs = await getMessages('NOPE', 0);
    expect(msgs).toEqual([]);
  });
});
