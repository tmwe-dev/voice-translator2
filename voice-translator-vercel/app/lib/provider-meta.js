// ═══════════════════════════════════════════════
// Provider metadata — safe to import from client components
// ═══════════════════════════════════════════════

export const PROVIDERS = {
  google:    { name: 'Google Translate', quality: 4, latency: 400,  free: true },
  microsoft: { name: 'Microsoft',        quality: 4, latency: 500,  free: true },
  mymemory:  { name: 'MyMemory',         quality: 3, latency: 700,  free: true },
};

// ── LLM Translation Models (paid) ──
export const LLM_MODELS = {
  'gpt-4o-mini':   { name: 'GPT-4o Mini',     provider: 'openai',    quality: 4, speed: 5, cost: '$',  color: '#10a37f' },
  'gpt-4o':        { name: 'GPT-4o',           provider: 'openai',    quality: 5, speed: 3, cost: '$$', color: '#10a37f' },
  'claude-sonnet': { name: 'Claude Sonnet',    provider: 'anthropic', quality: 5, speed: 4, cost: '$$', color: '#d97706' },
  'claude-haiku':  { name: 'Claude Haiku',     provider: 'anthropic', quality: 4, speed: 5, cost: '$',  color: '#d97706' },
  'gemini-flash':  { name: 'Gemini Flash',     provider: 'gemini',    quality: 4, speed: 5, cost: '$',  color: '#4285F4' },
  'gemini-pro':    { name: 'Gemini Pro',       provider: 'gemini',    quality: 5, speed: 3, cost: '$$', color: '#4285F4' },
};

// ── TTS Engines ──
export const TTS_ENGINES = {
  elevenlabs: {
    name: 'ElevenLabs',
    models: [
      { id: 'eleven_flash_v2_5', name: 'Flash v2.5', latency: '~75ms', quality: 4 },
      { id: 'eleven_multilingual_v2', name: 'Multilingual v2', latency: '~300ms', quality: 5 },
      { id: 'eleven_v3', name: 'v3 (Latest)', latency: '~200ms', quality: 5 },
    ],
    color: '#f97316',
  },
  openai: {
    name: 'OpenAI TTS',
    models: [{ id: 'gpt-4o-mini-tts', name: 'GPT-4o Mini TTS', latency: '~200ms', quality: 5 }],
    voices: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
    color: '#10a37f',
  },
  edge: {
    name: 'Edge TTS (Free)',
    models: [{ id: 'edge-tts-universal', name: 'Neural TTS', latency: '~150ms', quality: 4 }],
    color: '#00A4EF',
  },
};

// ── Avatar Voice Map (mirrors server-side AVATAR_VOICE_MAP) ──
export const AVATAR_NAMES = ['Marcus', 'Elena', 'Omar', 'Aisha', 'Alex', 'Thomas', 'Yuki', 'Margaret', 'Leo'];
