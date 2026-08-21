// ═══════════════════════════════════════════════════════════════
// PROTEZIONE SSRF — adattata da COBRA (modules/security/ssrf.js)
//
// COBRA non e una dipendenza: questo file e una copia ridotta e
// tradotta in ESM del suo controllo, presa perche gia collaudata.
// L'originale non e stato toccato.
//
// Qui serve un caso solo, quello del server: la richiesta parte da
// una funzione Vercel, e un URL che risolve verso la rete interna
// non va aperto MAI. Fail-closed: se non sappiamo dove punta, non
// si va. Il ramo "browser" di COBRA (Chrome risolve da se) qui non
// esiste e non e stato copiato.
// ═══════════════════════════════════════════════════════════════

import dns from 'dns';

const BLOCKED_HOSTNAMES = new Set([
  'localhost', 'localhost.localdomain', 'ip6-localhost', 'ip6-loopback',
  'metadata.google.internal', 'metadata', 'instance-data',
]);

const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.localdomain'];

/** Espande le notazioni alternative di un IPv4 in quattro ottetti. */
// b.363 — non piu esportata: la usa solo questo file. Era offerta a tutto
// il progetto senza che nessuno la chiedesse.
function parseIPv4(host) {
  const dotted = host.split('.');
  if (dotted.length === 4 && dotted.every(p => /^\d+$/.test(p))) {
    const n = dotted.map(Number);
    if (n.every(x => x >= 0 && x <= 255)) return n;
  }
  let value = null;
  if (/^0x[0-9a-f]+$/i.test(host)) value = parseInt(host, 16);
  else if (/^0[0-7]+$/.test(host)) value = parseInt(host, 8);
  else if (/^\d+$/.test(host)) value = parseInt(host, 10);
  if (value !== null && Number.isFinite(value) && value >= 0 && value <= 0xFFFFFFFF) {
    return [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];
  }
  if (dotted.length === 4) {
    const n = dotted.map(p => {
      if (/^0x[0-9a-f]+$/i.test(p)) return parseInt(p, 16);
      if (/^0[0-7]+$/.test(p)) return parseInt(p, 8);
      if (/^\d+$/.test(p)) return parseInt(p, 10);
      return NaN;
    });
    if (n.every(x => Number.isInteger(x) && x >= 0 && x <= 255)) return n;
  }
  return null;
}

/** Vero se l'IPv4 appartiene a una rete non instradabile. */
// b.363 — non piu esportata: la usa solo questo file. Era offerta a tutto
// il progetto senza che nessuno la chiedesse.
function isPrivateIPv4(o) {
  if (!o) return false;
  const [a, b] = o;
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;
  return false;
}

/** Vero se l'IPv6 e loopback, link-local, unique-local o mappa un IPv4 privato. */
// b.363 — non piu esportata: la usa solo questo file. Era offerta a tutto
// il progetto senza che nessuno la chiedesse.
function isPrivateIPv6(host) {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === '::' || h === '::1') return true;
  if (/^fe[89ab][0-9a-f]:/.test(h)) return true;
  if (/^f[cd][0-9a-f]{2}:/.test(h)) return true;
  const mapped = h.match(/^::ffff:(.+)$/);
  if (mapped) {
    const inner = mapped[1];
    if (inner.includes('.')) return isPrivateIPv4(parseIPv4(inner));
    const hexParts = inner.split(':');
    if (hexParts.length === 2) {
      const hi = parseInt(hexParts[0], 16), lo = parseInt(hexParts[1], 16);
      if (Number.isFinite(hi) && Number.isFinite(lo)) {
        return isPrivateIPv4([(hi >> 8) & 255, hi & 255, (lo >> 8) & 255, lo & 255]);
      }
    }
  }
  return false;
}

// b.363 — non piu esportata: la usa solo questo file. Era offerta a tutto
// il progetto senza che nessuno la chiedesse.
function isPrivateAddress(addr) {
  if (!addr) return true;
  if (addr.includes(':')) return isPrivateIPv6(addr);
  return isPrivateIPv4(parseIPv4(addr));
}

/** Controllo sincrono: protocollo, hostname noti, IP scritti in ogni notazione. */
export function isSSRFSafe(urlString) {
  try {
    const u = new URL(urlString);
    if (!['http:', 'https:'].includes(u.protocol)) return false;
    const hostname = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (!hostname) return false;
    if (BLOCKED_HOSTNAMES.has(hostname)) return false;
    if (BLOCKED_SUFFIXES.some(s => hostname.endsWith(s))) return false;
    if (u.username || u.password) return false;
    if (hostname.includes(':')) return !isPrivateIPv6(hostname);
    const v4 = parseIPv4(hostname);
    if (v4) return !isPrivateIPv4(v4);
    return true;
  } catch { return false; }
}

/**
 * Controllo completo: isSSRFSafe + risoluzione DNS. Copre il rebinding
 * (dominio pubblico che risolve verso la rete interna). Fail-closed.
 */
export async function assertSSRFSafe(urlString, { timeoutMs = 3000 } = {}) {
  if (!isSSRFSafe(urlString)) {
    return { safe: false, reason: 'Hostname o protocollo non consentito' };
  }
  let hostname;
  try { hostname = new URL(urlString).hostname.toLowerCase().replace(/^\[|\]$/g, ''); }
  catch { return { safe: false, reason: 'URL non valido' }; }

  if (hostname.includes(':') || parseIPv4(hostname)) return { safe: true };

  let addresses;
  try {
    addresses = await Promise.race([
      dns.promises.lookup(hostname, { all: true, verbatim: true }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('DNS timeout')), timeoutMs)),
    ]);
  } catch (e) {
    // Sul server non c'e il ramo "apre Chrome" di COBRA: nel dubbio, no.
    return { safe: false, reason: `DNS non risolto: ${e.message}` };
  }

  const list = (addresses || []).map(a => a.address);
  if (list.length === 0) return { safe: false, reason: 'Nessun indirizzo risolto' };
  const privates = list.filter(isPrivateAddress);
  if (privates.length > 0) {
    return { safe: false, reason: `Il dominio risolve a indirizzi interni: ${privates.join(', ')}` };
  }
  return { safe: true, addresses: list };
}
