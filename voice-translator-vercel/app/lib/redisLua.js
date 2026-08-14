import { CAPIENZA } from './decisioni.js';

// Lua scripts for atomic Redis operations
// Each script runs as a single atomic unit inside Redis — no race conditions.
// Used by store.js via redis('EVAL', script, numkeys, KEYS..., ARGV...)
//
// b.139-bis — QUI DENTRO NON SI SCRIVONO PIU NUMERI DI POLITICA.
// Il tetto dei partecipanti era scritto tre volte in tre linguaggi
// (CreateRoomSheet 20, /api/mondo 20, questo file 10) e il terzo era
// quello che decideva davvero, perche `createRoom` non scriveva il
// campo. I limiti ora vengono da decisioni.js e si INTERPOLANO nel
// sorgente Lua: restano un numero solo, in un posto solo.

// Helper: all room scripts need to GET → decode → modify → encode → SET
// cjson is built into Redis Lua. KEYS[1] is always the room key.

/**
 * Atomic joinRoom: add or update a member in the room.
 * KEYS[1] = room key
 * ARGV[1] = name, ARGV[2] = lang, ARGV[3] = avatar ('' for null), ARGV[4] = now (timestamp)
 * Returns: updated room JSON, or nil if room doesn't exist
 */
export const JOIN_ROOM = `
local data = redis.call('GET', KEYS[1])
if not data then return nil end
local room = cjson.decode(data)
local name = ARGV[1]
local lang = ARGV[2]
local avatar = ARGV[3] ~= '' and ARGV[3] or nil
local now = tonumber(ARGV[4])
local found = false
for i, m in ipairs(room.members) do
  if m.name == name then
    room.members[i].lang = lang
    room.members[i].joined = now
    room.members[i].avatar = avatar
    found = true
    break
  end
end
if not found then
  -- b.126 · MAI sostituire un membro in silenzio.
  -- Prima, superato il decimo, l'undicesimo NON veniva rifiutato: prendeva
  -- il posto di un partecipante gia dentro. Quello sostituito conservava
  -- il suo gettone ma spariva da room.members, e da quel momento certe
  -- API gli rispondevano 403 "Not a room member" — senza che nulla glielo
  -- avesse detto. Buttato fuori da una conversazione mentre ci parlava.
  -- E il limite era 10 fisso, mentre la UI ne prometteva fino a 20.
  local tetto = tonumber(room.maxPartecipanti) or ${CAPIENZA.PREDEFINITA}
  if tetto < ${CAPIENZA.MIN} then tetto = ${CAPIENZA.MIN} end
  if tetto > ${CAPIENZA.MAX} then tetto = ${CAPIENZA.MAX} end
  if #room.members < tetto then
    table.insert(room.members, {name=name, lang=lang, joined=now, role='guest', avatar=avatar})
  else
    return 'PIENA'
  end
end
local encoded = cjson.encode(room)
redis.call('SET', KEYS[1], encoded, 'EX', 3600)
return encoded
`;

/**
 * Atomic setSpeaking: update speaking/typing state for a member.
 * KEYS[1] = room key
 * ARGV[1] = memberName, ARGV[2] = speaking (0/1), ARGV[3] = liveText ('' for null),
 * ARGV[4] = typing (0/1), ARGV[5] = now (timestamp), ARGV[6] = hasLiveText (0/1)
 */
export const SET_SPEAKING = `
local data = redis.call('GET', KEYS[1])
if not data then return nil end
local room = cjson.decode(data)
local memberName = ARGV[1]
local speaking = ARGV[2] == '1'
local liveText = ARGV[3]
local typing = ARGV[4] == '1'
local now = tonumber(ARGV[5])
local hasLiveText = ARGV[6] == '1'
for i, m in ipairs(room.members) do
  if m.name == memberName then
    room.members[i].speaking = speaking
    room.members[i].speakingAt = speaking and now or 0
    if hasLiveText then
      room.members[i].liveText = liveText
    elseif not speaking then
      room.members[i].liveText = ''
    end
    room.members[i].typing = typing
    room.members[i].typingAt = typing and now or 0
    break
  end
end
local encoded = cjson.encode(room)
redis.call('SET', KEYS[1], encoded, 'EX', 3600)
return encoded
`;

/**
 * Atomic addCost: increment totalCost and msgCount.
 * KEYS[1] = room key
 * ARGV[1] = amount (number as string)
 */
export const ADD_COST = `
local data = redis.call('GET', KEYS[1])
if not data then return nil end
local room = cjson.decode(data)
room.totalCost = (room.totalCost or 0) + tonumber(ARGV[1])
room.msgCount = (room.msgCount or 0) + 1
local encoded = cjson.encode(room)
redis.call('SET', KEYS[1], encoded, 'EX', 3600)
return encoded
`;

/**
 * Atomic updateRoomMode.
 * KEYS[1] = room key, ARGV[1] = newMode
 */
/**
 * Atomic aggiornaPoliticaPubblica (b.125).
 *
 * La stanza non conosceva `hot`, `roomType`, `maxPartecipanti` ne
 * `suApprovazione`: quei campi vivevano SOLO nella voce della vetrina
 * (/api/mondo) e nelle regole di moderazione. Ma la chat legge
 * `roomInfo.hot` per decidere se velare le parole pesanti, e roomInfo
 * E la stanza — quindi leggeva sempre `undefined`.
 *
 * Risultato: le stanze "litigio libero" non lo sono mai state.
 *
 * KEYS[1] = room key
 * ARGV[1] = hot ('1' o '0'), [2] = roomType, [3] = maxPartecipanti, [4] = suApprovazione
 */
export const AGGIORNA_POLITICA_PUBBLICA = `
local data = redis.call('GET', KEYS[1])
if not data then return nil end
local room = cjson.decode(data)
room.hot = ARGV[1] == '1'
room.roomType = ARGV[2]
room.maxPartecipanti = tonumber(ARGV[3])
room.suApprovazione = ARGV[4] == '1'
local encoded = cjson.encode(room)
redis.call('SET', KEYS[1], encoded, 'EX', 3600)
return encoded
`;

// b.157 — audit dei setting: cambiare modalita non azzerava mani alzate
// ne il permesso di parola concesso in un giro precedente di classroom.
// Una stanza che esce ed entra di nuovo in classroom ripartiva con
// membri gia "granted" da una sessione precedente, senza che l'host
// avesse concesso nulla stavolta. Si azzera ad ogni cambio modalita,
// qualunque sia la modalita di destinazione.
export const UPDATE_ROOM_MODE = `
local data = redis.call('GET', KEYS[1])
if not data then return nil end
local room = cjson.decode(data)
room.mode = ARGV[1]
for i, m in ipairs(room.members) do
  room.members[i].handRaised = false
  room.members[i].handRaisedAt = 0
  room.members[i].granted = false
end
local encoded = cjson.encode(room)
redis.call('SET', KEYS[1], encoded, 'EX', 3600)
return encoded
`;

/**
 * Atomic changeMemberLang.
 * KEYS[1] = room key, ARGV[1] = memberName, ARGV[2] = newLang, ARGV[3] = now
 */
export const CHANGE_MEMBER_LANG = `
local data = redis.call('GET', KEYS[1])
if not data then return nil end
local room = cjson.decode(data)
for i, m in ipairs(room.members) do
  if m.name == ARGV[1] then
    room.members[i].lang = ARGV[2]
    room.members[i].langChangedAt = tonumber(ARGV[3])
    break
  end
end
local encoded = cjson.encode(room)
redis.call('SET', KEYS[1], encoded, 'EX', 3600)
return encoded
`;

/**
 * Atomic setHandRaised.
 * KEYS[1] = room key, ARGV[1] = memberName, ARGV[2] = raised (0/1), ARGV[3] = now
 */
export const SET_HAND_RAISED = `
local data = redis.call('GET', KEYS[1])
if not data then return nil end
local room = cjson.decode(data)
local raised = ARGV[2] == '1'
for i, m in ipairs(room.members) do
  if m.name == ARGV[1] then
    room.members[i].handRaised = raised
    room.members[i].handRaisedAt = raised and tonumber(ARGV[3]) or 0
    break
  end
end
local encoded = cjson.encode(room)
redis.call('SET', KEYS[1], encoded, 'EX', 3600)
return encoded
`;

/**
 * Atomic grantSpeaking: grant speaking to one member, lower all others.
 * KEYS[1] = room key, ARGV[1] = memberName, ARGV[2] = now
 *
 * b.157 — audit dei setting: PRIMA questo script toccava solo
 * "speaking"/"speakingAt", cioe l'indicatore transitorio "sta parlando
 * ORA" che ogni singola battuta di conversazione riscrive (vedi
 * SET_SPEAKING sopra). Il permesso concesso spariva al primo "sto
 * parlando" successivo di chiunque — compreso il concesso stesso — e
 * RoomView.js non lo leggeva comunque: "canTalk" era cablato a
 * "isHost", quindi lo studente autorizzato non poteva parlare lo
 * stesso. Aggiunto un campo persistente dedicato, "granted", che
 * "speaking" non tocca e non sovrascrive.
 */
export const GRANT_SPEAKING = `
local data = redis.call('GET', KEYS[1])
if not data then return nil end
local room = cjson.decode(data)
local grantee = ARGV[1]
local now = tonumber(ARGV[2])
for i, m in ipairs(room.members) do
  if m.name == grantee then
    room.members[i].handRaised = false
    room.members[i].handRaisedAt = 0
    room.members[i].granted = true
    room.members[i].speaking = true
    room.members[i].speakingAt = now
  else
    room.members[i].handRaised = false
    room.members[i].handRaisedAt = 0
    room.members[i].granted = false
    room.members[i].speaking = false
    room.members[i].speakingAt = 0
  end
end
local encoded = cjson.encode(room)
redis.call('SET', KEYS[1], encoded, 'EX', 3600)
return encoded
`;

/**
 * Atomic updateMessage: find by sender+original, apply updates.
 * KEYS[1] = msgs key
 * ARGV[1] = sender, ARGV[2] = original, ARGV[3] = translated, ARGV[4] = targetLang, ARGV[5] = translations JSON
 */
export const UPDATE_MESSAGE = `
local key = KEYS[1]
local sender = ARGV[1]
local original = ARGV[2]
local translated = ARGV[3]
local targetLang = ARGV[4]
local translationsJson = ARGV[5]
-- b.126 · si cerca per ID; il contenuto e solo un ripiego.
-- Prima si cercava SOLO per sender + original, dal fondo. Due "ok" di
-- fila dello stesso utente sono indistinguibili: se la traduzione del
-- primo arrivava in ritardo, finiva sul secondo. Un'entita non si
-- identifica mai col proprio contenuto.
local messageId = ARGV[6] or ''
local msgs = redis.call('LRANGE', key, 0, -1)
if messageId ~= '' then
  for i = #msgs, 1, -1 do
    local m = cjson.decode(msgs[i])
    if m.clientId == messageId then
      if translated ~= '' then m.translated = translated end
      if targetLang ~= '' then m.targetLang = targetLang end
      if translationsJson ~= '' then m.translations = cjson.decode(translationsJson) end
      local encoded = cjson.encode(m)
      redis.call('LSET', key, i - 1, encoded)
      return encoded
    end
  end
end
for i = #msgs, 1, -1 do
  local m = cjson.decode(msgs[i])
  if m.sender == sender and m.original == original then
    if translated ~= '' then m.translated = translated end
    if targetLang ~= '' then m.targetLang = targetLang end
    if translationsJson ~= '' then m.translations = cjson.decode(translationsJson) end
    local encoded = cjson.encode(m)
    redis.call('LSET', key, i - 1, encoded)
    return encoded
  end
end
return nil
`;

/**
 * Atomic addMessage: verify room exists, generate ID, RPUSH + LTRIM + EXPIRE.
 * KEYS[1] = room key, KEYS[2] = msgs key
 * ARGV[1] = message JSON (without id/timestamp), ARGV[2] = messageId, ARGV[3] = now
 */
export const ADD_MESSAGE = `
local roomData = redis.call('GET', KEYS[1])
if not roomData then return nil end
local msg = cjson.decode(ARGV[1])
msg.id = ARGV[2]
msg.timestamp = tonumber(ARGV[3])
local encoded = cjson.encode(msg)
redis.call('RPUSH', KEYS[2], encoded)
redis.call('LTRIM', KEYS[2], -200, -1)
redis.call('EXPIRE', KEYS[2], 3600)
return encoded
`;

/**
 * Atomic addCredits: add amount to user credits in a single operation.
 * KEYS[1] = user key (user:email)
 * ARGV[1] = amount (number as string)
 * Returns: updated user JSON, or nil if user doesn't exist
 */
export const CREDIT_ADD = `
local data = redis.call('GET', KEYS[1])
if not data then return nil end
local user = cjson.decode(data)
user.credits = (user.credits or 0) + tonumber(ARGV[1])
user._v = (user._v or 0) + 1
user._lastMod = tonumber(ARGV[2])
local encoded = cjson.encode(user)
redis.call('SET', KEYS[1], encoded)
return encoded
`;

/**
 * Atomic deductCredits: deduct amount, checking sufficient balance.
 * KEYS[1] = user key (user:email)
 * ARGV[1] = amount, ARGV[2] = now timestamp
 * Returns: updated user JSON, 'OWN_KEYS' if user has own keys (skip deduction),
 *          'INSUFFICIENT' if balance too low, nil if user doesn't exist
 */
export const CREDIT_DEDUCT = `
local data = redis.call('GET', KEYS[1])
if not data then return nil end
local user = cjson.decode(data)
if user.useOwnKeys then return 'OWN_KEYS' end
local current = user.credits or 0
local amount = tonumber(ARGV[1])
if current < amount then return 'INSUFFICIENT' end
user.credits = current - amount
if user.credits < 0 then user.credits = 0 end
user.totalSpent = (user.totalSpent or 0) + amount
user.totalMessages = (user.totalMessages or 0) + 1
user._v = (user._v or 0) + 1
user._lastMod = tonumber(ARGV[2])
local encoded = cjson.encode(user)
redis.call('SET', KEYS[1], encoded)
return encoded
`;

/**
 * Atomic updateConversationSummary.
 * KEYS[1] = conv key, ARGV[1] = summary JSON
 */
export const UPDATE_CONV_SUMMARY = `
local data = redis.call('GET', KEYS[1])
if not data then return nil end
local conv = cjson.decode(data)
conv.summary = ARGV[1]
local encoded = cjson.encode(conv)
-- b.126 · qui c'era 86400: UN giorno.
-- saveConversation salva a 604800 (sette giorni) e l'elenco scade a
-- sette. Generare il riassunto RISCRIVEVA la conversazione accorciandole
-- la vita a un giorno, senza toccare l'elenco. Dopo 24 ore la
-- conversazione compariva ancora nell'archivio e aprirla dava "non
-- trovata": dati dell'utente persi, per aver chiesto un riassunto.
-- Si conserva la scadenza che c'era invece di imporne una nuova: se
-- alla conversazione restavano due giorni, restano due giorni.
local ttl = redis.call('TTL', KEYS[1])
if ttl == nil or ttl < 0 then ttl = 604800 end
redis.call('SET', KEYS[1], encoded, 'EX', ttl)
return encoded
`;
