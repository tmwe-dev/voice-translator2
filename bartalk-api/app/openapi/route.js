import { buildOpenApi } from '../../lib/openapi.js';
export function GET(req) {
  const u = new URL(req.url);
  return Response.json(buildOpenApi(u.origin), { headers: { 'Cache-Control': 'public, max-age=300' } });
}
