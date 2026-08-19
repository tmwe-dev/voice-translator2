// ═══ BarTalk — traduttore REST→Redis (compatibile Upstash) ═══
// Parla il protocollo che l'app gia usa: POST / con corpo ["CMD", ...args]
// e Authorization: Bearer TOKEN → risposta { result } o { error }.
// Dietro: un Redis VERO su localhost (Lua compreso). ~100 righe, niente
// dipendenze: solo Node.
import { createServer } from 'http';
import { connect } from 'net';
import { readFileSync } from 'fs';

const TOKEN = readFileSync(new URL('./token.txt', import.meta.url), 'utf8').trim();
const PORTA = 8079;
const REDIS_PORT = 6390;

// ── RESP: serializza un comando ──
function serializza(args) {
  let s = `*${args.length}\r\n`;
  for (const a of args) {
    const v = String(a);
    s += `$${Buffer.byteLength(v)}\r\n${v}\r\n`;
  }
  return s;
}

// ── RESP: leggi UNA risposta dal buffer; torna [valore, byteConsumati] o null ──
function leggi(buf, pos = 0) {
  if (pos >= buf.length) return null;
  const nl = buf.indexOf('\r\n', pos);
  if (nl < 0) return null;
  const tipo = buf[pos];
  const testa = buf.slice(pos + 1, nl).toString();
  const dopo = nl + 2;
  if (tipo === 43) return [testa, dopo];                       // +OK
  if (tipo === 58) return [parseInt(testa, 10), dopo];         // :int
  if (tipo === 45) return [{ __err: testa }, dopo];            // -ERR
  if (tipo === 36) {                                           // $bulk
    const n = parseInt(testa, 10);
    if (n === -1) return [null, dopo];
    if (buf.length < dopo + n + 2) return null;
    return [buf.slice(dopo, dopo + n).toString(), dopo + n + 2];
  }
  if (tipo === 42) {                                           // *array
    const n = parseInt(testa, 10);
    if (n === -1) return [null, dopo];
    const out = []; let p = dopo;
    for (let i = 0; i < n; i++) {
      const r = leggi(buf, p);
      if (!r) return null;
      out.push(r[0]); p = r[1];
    }
    return [out, p];
  }
  return [{ __err: 'tipo RESP sconosciuto' }, dopo];
}

function comando(args) {
  return new Promise((resolve, reject) => {
    const sock = connect(REDIS_PORT, '127.0.0.1');
    let buf = Buffer.alloc(0);
    const timer = setTimeout(() => { sock.destroy(); reject(new Error('redis timeout')); }, 5000);
    sock.on('error', (e) => { clearTimeout(timer); reject(e); });
    sock.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      const r = leggi(buf);
      if (r) { clearTimeout(timer); sock.end(); resolve(r[0]); }
    });
    sock.write(serializza(args));
  });
}

createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if ((req.headers.authorization || '') !== `Bearer ${TOKEN}`) {
    res.statusCode = 401; return res.end('{"error":"unauthorized"}');
  }
  let corpo = '';
  req.on('data', c => { corpo += c; if (corpo.length > 1e6) req.destroy(); });
  req.on('end', async () => {
    try {
      const args = JSON.parse(corpo);
      if (!Array.isArray(args) || !args.length) { res.statusCode = 400; return res.end('{"error":"bad request"}'); }
      const r = await comando(args);
      if (r && typeof r === 'object' && r.__err) return res.end(JSON.stringify({ error: r.__err }));
      res.end(JSON.stringify({ result: r }));
    } catch (e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: String(e.message || e).slice(0, 120) }));
    }
  });
}).listen(PORTA, '0.0.0.0', () => console.log('proxy REST su', PORTA, '→ redis', REDIS_PORT));
