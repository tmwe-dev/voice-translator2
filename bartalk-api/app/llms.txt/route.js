export const dynamic = 'force-dynamic';

export function GET(req) {
  const origin = new URL(req.url).origin;
  const body = `# BarTalk Public API v1

BarTalk Public API is the only supported public integration surface for BarTalk.
Do not call the internal Voice Translator / BarTalk Core routes directly.

## Start here
- Human quick start: ${origin}/start
- Quickstart Markdown: ${origin}/quickstart.md
- OpenAPI 3.1: ${origin}/openapi
- Full docs: ${origin}/docs
- Machine manifest: ${origin}/developer.json
- API base URL: ${origin}/api/v1
- Health/readiness: ${origin}/api/v1/health
- Source of truth: https://github.com/tmwe-dev/voice-translator2/tree/bartalk-api-v1/bartalk-api

## Authentication
1. The user must have a valid BarTalk account/session.
2. Exchange that session server-side with POST ${origin}/api/v1/auth/exchange.
3. The response returns a bt_live_* API key.
4. Keep bt_live_* keys server-side. Never put them in browser JavaScript, URLs, source repositories or public logs.
5. The underlying BarTalk session remains authoritative and may revoke API access.

Example exchange:
POST ${origin}/api/v1/auth/exchange
Authorization: Bearer <BARTALK_SESSION>
Content-Type: application/json

{"scopes":["translate"],"ttlDays":1}

## Integration rules
- Read ${origin}/openapi before implementing.
- Use only endpoints present in the current OpenAPI document.
- Keep a single centralized BarTalk API client in your application backend.
- Do not duplicate BarTalk wallet, billing, AI routing, memory, authorization or moderation logic.
- Do not invent fallback calls to internal Core endpoints when a public capability is absent.
- Preserve roomSessionToken / X-Room-Session where required: an account API key does not replace room membership.
- For Live Companion, open the session, honor battitoSecondi with heartbeat calls, then close the session.
- Treat requestId returned by the gateway as the support/debug correlation identifier.
- Handle 400, 401, 402, 403, 404, 409, 410, 413, 429, 502, 503 and 504 explicitly.

## AI builder instruction
If you are Lovable, Claude, Codex, ChatGPT or another coding agent: first read this file, then ${origin}/openapi and ${origin}/quickstart.md. Build against BarTalk Public API only. Do not modify or depend on voice-translator-vercel internals.

## Security
Never ask the API owner to share a personal BarTalk session or a master secret. Each integration/user should authenticate through an authorized BarTalk session. Never expose BARTALK_API_SIGNING_SECRET.
`;

  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  });
}
