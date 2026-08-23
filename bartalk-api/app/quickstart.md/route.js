export const dynamic = 'force-dynamic';

export function GET(req) {
  const origin = new URL(req.url).origin;
  const body = `# BarTalk Public API v1 — Quickstart

## 1. Check readiness

\`\`\`bash
curl ${origin}/api/v1/health
\`\`\`

A ready gateway returns HTTP 200. HTTP 503 means the API gateway or BarTalk Core is not ready.

## 2. Obtain an API key

Use a valid BarTalk session server-side:

\`\`\`bash
curl -X POST ${origin}/api/v1/auth/exchange \\
  -H "Authorization: Bearer $BARTALK_SESSION" \\
  -H "Content-Type: application/json" \\
  -d '{"scopes":["translate","speech:stt","speech:tts"],"ttlDays":1}'
\`\`\`

Store the returned \`bt_live_*\` key only in your backend/server environment.

## 3. Call the API

\`\`\`bash
curl -X POST ${origin}/api/v1/translate \\
  -H "Authorization: Bearer $BARTALK_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"text":"Buongiorno","sourceLang":"it","targetLang":"en"}'
\`\`\`

Use the current OpenAPI contract for exact schemas and supported endpoints:

${origin}/openapi

## TypeScript server-side skeleton

\`\`\`ts
const BARTALK_BASE_URL = process.env.BARTALK_API_BASE_URL!;
const BARTALK_API_KEY = process.env.BARTALK_API_KEY!;

export async function bartalk(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BARTALK_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${BARTALK_API_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  const requestId = res.headers.get('x-request-id');
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`BarTalk ${res.status} [${requestId || 'no-request-id'}]: ${body}`);
  }
  return res;
}
\`\`\`

## Rules

- Public base URL: \`${origin}/api/v1\`
- Never call internal BarTalk Core / Voice Translator endpoints directly.
- Never expose \`bt_live_*\` keys in frontend JavaScript or URLs.
- Never share \`BARTALK_API_SIGNING_SECRET\`.
- Use only endpoints in \`${origin}/openapi\`.
- Keep room membership tokens separate from account API keys.
- Live Companion requires open -> heartbeat at \`battitoSecondi\` -> close.
- If a capability is not in OpenAPI, treat it as unavailable; do not bypass the gateway.

## Give this API to an AI builder

Send only this instruction:

> Read ${origin}/llms.txt and build the application using only the BarTalk Public API described there and in its linked OpenAPI specification.

Full docs: ${origin}/docs
Machine manifest: ${origin}/developer.json
`;

  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  });
}
