// Lua scripts for atomic Redis operations
// Each script runs as a single atomic unit inside Redis — no race conditions.
// Used by store.js via redis('EVAL', script, numkeys, KEYS..., ARGV...)

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
  if #room.members < 10 then
    table.insert(room.members, {name=name, lang=lang, joined=now, role='guest', avatar=avatar})
  else
    for i, m in ipairs(room.members) do
      if m.role ~= 'host' then
        room.members[i] = {name=name, lang=lang, joined=now, role='guest', avatar=avatar}
        break
      end
    end
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
export const UPDATE_ROOM_MODE = `
local data = redis.call('GET', KEYS[1])
if not data then return nil end
local room = cjson.decode(data)
room.mode = ARGV[1]
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
    room.members[i].speaking = true
    room.members[i].speakingAt = now
  else
    room.members[i].handRaised = false
    room.members[i].handRaisedAt = 0
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
local msgs = redis.call('LRANGE', key, 0, -1)
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
redis.call('SET', KEYS[1], encoded, 'EX', 86400)
return encoded
`;
