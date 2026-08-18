// Shim REST compatibile Upstash → Redis locale (solo per il collaudo nel sandbox).
import http from 'http';
import Redis from 'ioredis';
const r = new Redis({ port: 6379 });
const srv = http.createServer((req, res) => {
  let corpo = '';
  req.on('data', (c) => corpo += c);
  req.on('end', async () => {
    try {
      const arr = JSON.parse(corpo || '[]');
      const [cmd, ...args] = arr;
      const esito = await r.call(cmd, ...args.map(a => String(a)));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ result: esito }));
    } catch (e) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(e.message || e) }));
    }
  });
});
srv.listen(8079, () => console.log('shim upstash su :8079'));
