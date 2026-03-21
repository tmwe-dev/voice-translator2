// ═══════════════════════════════════════════════════════════════
// Input Validation Schemas
// Lightweight validation without external deps (no zod needed at runtime)
// Each schema returns { valid: boolean, data: object, error?: string }
// ═══════════════════════════════════════════════════════════════

const LANG_CODE_RE = /^[a-z]{2}(-[A-Za-z]{2,4})?$/;
const ROOM_ID_RE = /^[A-Z0-9]{4,20}$/;
const EMAIL_RE = /^[^\s@<>"'`\\;]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Whitelist of valid language codes
const VALID_LANGS = new Set([
  'th','en','it','es','fr','de','pt','zh','ja','ko','ar','hi',
  'ru','tr','vi','id','ms','nl','pl','sv','el','cs','ro','hu','fi',
  'bg','da','et','hr','lt','lv','mt','sk','sl','uk','bn','ta','te',
  'zh-TW','pt-BR','en-US','en-GB','es-MX','fr-CA',
]);

/**
 * Validate a value against type and constraints.
 */
function check(val, type, { required = false, maxLen, minLen, pattern, oneOf, min, max } = {}) {
  if (val === undefined || val === null || val === '') {
    return required ? 'required' : null;
  }
  if (type === 'string') {
    if (typeof val !== 'string') return 'must be string';
    if (maxLen && val.length > maxLen) return `max ${maxLen} chars`;
    if (minLen && val.length < minLen) return `min ${minLen} chars`;
    if (pattern && !pattern.test(val)) return 'invalid format';
    if (oneOf && !oneOf.has(val) && !oneOf.has(val.replace(/-.*/, ''))) return 'invalid value';
  } else if (type === 'number') {
    if (typeof val !== 'number' || isNaN(val)) return 'must be number';
    if (min !== undefined && val < min) return `min ${min}`;
    if (max !== undefined && val > max) return `max ${max}`;
  } else if (type === 'boolean') {
    if (typeof val !== 'boolean') return 'must be boolean';
  }
  return null;
}

/**
 * Sanitize string: strip HTML, null bytes, control chars, trim
 */
function clean(str, maxLen = 5000) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/\0/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .trim()
    .slice(0, maxLen);
}

// ═══ Translation ═══

export function validateTranslateInput(body) {
  if (!body || typeof body !== 'object') return { valid: false, error: 'Invalid body' };

  const errors = {};
  const e = (field, err) => { if (err) errors[field] = err; };

  e('text', check(body.text, 'string', { required: true, minLen: 1, maxLen: 10000 }));
  e('sourceLang', check(body.sourceLang, 'string', { required: true, pattern: LANG_CODE_RE }));
  e('targetLang', check(body.targetLang, 'string', { required: true, pattern: LANG_CODE_RE }));
  e('sourceLangName', check(body.sourceLangName, 'string', { maxLen: 50 }));
  e('targetLangName', check(body.targetLangName, 'string', { maxLen: 50 }));
  e('roomId', check(body.roomId, 'string', { maxLen: 20 }));
  e('aiModel', check(body.aiModel, 'string', { maxLen: 50 }));

  if (Object.keys(errors).length > 0) {
    return { valid: false, error: `Invalid fields: ${Object.keys(errors).join(', ')}`, errors };
  }

  return {
    valid: true,
    data: {
      text: clean(body.text, 10000),
      sourceLang: body.sourceLang.slice(0, 10),
      targetLang: body.targetLang.slice(0, 10),
      sourceLangName: clean(body.sourceLangName || '', 50),
      targetLangName: clean(body.targetLangName || '', 50),
      roomId: body.roomId ? body.roomId.replace(/[^a-zA-Z0-9\-]/g, '').slice(0, 20) : undefined,
      context: body.context ? clean(body.context, 2000) : undefined,
      isReview: !!body.isReview,
      domainContext: body.domainContext ? clean(body.domainContext, 100) : undefined,
      description: body.description ? clean(body.description, 200) : undefined,
      userToken: body.userToken || undefined,
      aiModel: body.aiModel || undefined,
      lendingCode: body.lendingCode || undefined,
      roomMode: body.roomMode || undefined,
      nativeLang: body.nativeLang || undefined,
      conversationContext: body.conversationContext ? clean(body.conversationContext, 3000) : undefined,
    },
  };
}

// ═══ TTS ═══

export function validateTTSInput(body) {
  if (!body || typeof body !== 'object') return { valid: false, error: 'Invalid body' };

  const errors = {};
  const e = (field, err) => { if (err) errors[field] = err; };

  e('text', check(body.text, 'string', { required: true, minLen: 1, maxLen: 5000 }));
  e('langCode', check(body.langCode, 'string', { maxLen: 10 }));

  if (Object.keys(errors).length > 0) {
    return { valid: false, error: `Invalid fields: ${Object.keys(errors).join(', ')}`, errors };
  }

  return {
    valid: true,
    data: {
      text: clean(body.text, 5000),
      voice: body.voice || undefined,
      userToken: body.userToken || undefined,
      roomId: body.roomId || undefined,
      langCode: body.langCode || undefined,
      wantStream: !!body.stream,
    },
  };
}

// ═══ Room ═══

export function validateRoomCreate(body) {
  if (!body || typeof body !== 'object') return { valid: false, error: 'Invalid body' };

  const errors = {};
  const e = (field, err) => { if (err) errors[field] = err; };

  e('name', check(body.name, 'string', { required: true, minLen: 1, maxLen: 50 }));
  e('lang', check(body.lang, 'string', { required: true, pattern: LANG_CODE_RE }));
  e('mode', check(body.mode, 'string', { maxLen: 20 }));

  if (Object.keys(errors).length > 0) {
    return { valid: false, error: `Invalid fields: ${Object.keys(errors).join(', ')}`, errors };
  }

  return {
    valid: true,
    data: {
      name: clean(body.name, 50),
      lang: body.lang,
      mode: body.mode || 'conversation',
      avatar: body.avatar || null,
      context: body.context ? clean(body.context, 100) : null,
      contextPrompt: body.contextPrompt ? clean(body.contextPrompt, 500) : null,
      description: body.description ? clean(body.description, 200) : null,
    },
  };
}

// ═══ Message ═══

export function validateMessageInput(body) {
  if (!body || typeof body !== 'object') return { valid: false, error: 'Invalid body' };

  const errors = {};
  const e = (field, err) => { if (err) errors[field] = err; };

  e('roomId', check(body.roomId, 'string', { required: true, maxLen: 20 }));
  e('text', check(body.text, 'string', { required: true, minLen: 1, maxLen: 10000 }));
  e('sender', check(body.sender, 'string', { required: true, maxLen: 50 }));

  if (Object.keys(errors).length > 0) {
    return { valid: false, error: `Invalid fields: ${Object.keys(errors).join(', ')}`, errors };
  }

  return {
    valid: true,
    data: {
      roomId: body.roomId.replace(/[^a-zA-Z0-9\-]/g, '').slice(0, 20),
      text: clean(body.text, 10000),
      sender: clean(body.sender, 50),
      lang: body.lang || 'en',
      translations: body.translations || null,
      token: body.token || undefined,
    },
  };
}

// ═══ Exports ═══

export { VALID_LANGS, LANG_CODE_RE, ROOM_ID_RE, clean as sanitize };
