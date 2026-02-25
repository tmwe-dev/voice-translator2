// User accounts, authentication, and credit system
// Uses same Upstash Redis as store.js

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(command, ...args) {
  const res = await fetch(`${UPSTASH_URL}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([command, ...args]),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

// =============================================
// USERS
// =============================================

export async function createUser(email, name, lang, avatar) {
  const key = `user:${email.toLowerCase()}`;
  const existing = await redis('GET', key);
  if (existing) return JSON.parse(existing);

  const user = {
    email: email.toLowerCase(),
    name: name || '',
    lang: lang || 'it',
    avatar: avatar || '/avatars/1.svg',
    credits: 0, // in euro-cents (e.g. 200 = €2.00)
    totalSpent: 0,
    totalMessages: 0,
    apiKeys: {}, // { openai: 'sk-...', anthropic: 'sk-ant-...', gemini: 'AIza...' }
    useOwnKeys: false,
    created: Date.now(),
    lastLogin: Date.now()
  };
  await redis('SET', key, JSON.stringify(user));
  return user;
}

export async function getUser(email) {
  if (!email) return null;
  const data = await redis('GET', `user:${email.toLowerCase()}`);
  if (!data) return null;
  return JSON.parse(data);
}

export async function updateUser(email, updates) {
  const key = `user:${email.toLowerCase()}`;
  const data = await redis('GET', key);
  if (!data) return null;
  const user = { ...JSON.parse(data), ...updates };
  await redis('SET', key, JSON.stringify(user));
  return user;
}

// =============================================
// CREDITS
// =============================================

// Credit packages: { id, euros, credits (in euro-cents), label }
export const CREDIT_PACKAGES = [
  { id: 'pack_2', euros: 2, credits: 200, label: '€2', messages: '~400 messaggi' },
  { id: 'pack_5', euros: 5, credits: 550, label: '€5', messages: '~1100 messaggi', bonus: '+10%' },
  { id: 'pack_10', euros: 10, credits: 1200, label: '€10', messages: '~2400 messaggi', bonus: '+20%' },
  { id: 'pack_20', euros: 20, credits: 2600, label: '€20', messages: '~5200 messaggi', bonus: '+30%' },
];

export async function addCredits(email, amount) {
  const key = `user:${email.toLowerCase()}`;
  const data = await redis('GET', key);
  if (!data) return null;
  const user = JSON.parse(data);
  user.credits = (user.credits || 0) + amount;
  await redis('SET', key, JSON.stringify(user));
  return user;
}

export async function deductCredits(email, amount) {
  const key = `user:${email.toLowerCase()}`;
  const data = await redis('GET', key);
  if (!data) return null;
  const user = JSON.parse(data);
  if (user.useOwnKeys) return user; // no deduction if using own keys
  if (user.credits < amount) return null; // insufficient credits
  user.credits = Math.max(0, user.credits - amount);
  user.totalSpent = (user.totalSpent || 0) + amount;
  user.totalMessages = (user.totalMessages || 0) + 1;
  await redis('SET', key, JSON.stringify(user));
  return user;
}

export async function getCredits(email) {
  const user = await getUser(email);
  if (!user) return { credits: 0, useOwnKeys: false };
  return { credits: user.credits, useOwnKeys: user.useOwnKeys };
}

// =============================================
// API KEYS
// =============================================

export async function saveApiKeys(email, keys, useOwnKeys) {
  const key = `user:${email.toLowerCase()}`;
  const data = await redis('GET', key);
  if (!data) return null;
  const user = JSON.parse(data);
  user.apiKeys = keys;
  user.useOwnKeys = useOwnKeys;
  await redis('SET', key, JSON.stringify(user));
  return user;
}

export async function getUserApiKey(email, provider = 'openai') {
  const user = await getUser(email);
  if (!user || !user.useOwnKeys || !user.apiKeys) return null;
  return user.apiKeys[provider] || null;
}

// =============================================
// AUTH - Magic Code
// =============================================

export async function createAuthCode(email) {
  const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
  const key = `authcode:${email.toLowerCase()}`;
  await redis('SET', key, JSON.stringify({ code, created: Date.now() }), 'EX', 600); // 10 min TTL
  return code;
}

export async function verifyAuthCode(email, code) {
  const key = `authcode:${email.toLowerCase()}`;
  const data = await redis('GET', key);
  if (!data) return false;
  const stored = JSON.parse(data);
  if (stored.code !== code) return false;
  // Delete code after successful verification
  await redis('DEL', key);
  return true;
}

// =============================================
// SESSIONS
// =============================================

export async function createSession(email) {
  const token = crypto.randomUUID() + '-' + Date.now().toString(36);
  const key = `session:${token}`;
  await redis('SET', key, JSON.stringify({ email: email.toLowerCase(), created: Date.now() }), 'EX', 604800); // 7 days
  // Update user last login
  await updateUser(email, { lastLogin: Date.now() });
  return token;
}

export async function getSession(token) {
  if (!token) return null;
  const data = await redis('GET', `session:${token}`);
  if (!data) return null;
  return JSON.parse(data);
}

export async function deleteSession(token) {
  if (!token) return;
  await redis('DEL', `session:${token}`);
}

// =============================================
// PAYMENT HISTORY
// =============================================

export async function addPaymentRecord(email, payment) {
  const key = `payments:${email.toLowerCase()}`;
  const record = JSON.stringify({
    ...payment,
    timestamp: Date.now()
  });
  await redis('RPUSH', key, record);
  await redis('LTRIM', key, -100, -1); // keep last 100
  return true;
}

export async function getPaymentHistory(email) {
  const key = `payments:${email.toLowerCase()}`;
  const entries = await redis('LRANGE', key, 0, -1);
  if (!entries || !Array.isArray(entries)) return [];
  return entries.map(e => JSON.parse(e)).reverse();
}
