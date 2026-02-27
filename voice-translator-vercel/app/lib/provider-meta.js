// ═══════════════════════════════════════════════
// Provider metadata — safe to import from client components
// (no server-only dependencies like request, net, tls, fs)
// ═══════════════════════════════════════════════

export const PROVIDERS = {
  google:        { name: 'Google Translate', quality: 4, latency: 400,  free: true },
  baidu:         { name: 'Baidu Translate',  quality: 5, latency: 600,  free: true },
  microsoft:     { name: 'Microsoft',        quality: 4, latency: 500,  free: true },
  mymemory:      { name: 'MyMemory',         quality: 3, latency: 700,  free: true },
  libretranslate:{ name: 'LibreTranslate',   quality: 2, latency: 1000, free: true },
};
