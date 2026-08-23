export const dynamic = 'force-dynamic';

export function GET(req) {
  const origin = new URL(req.url).origin;
  return Response.json({
    name: 'BarTalk Public API',
    apiVersion: 'v1',
    status: 'public-gateway',
    baseUrl: `${origin}/api/v1`,
    health: `${origin}/api/v1/health`,
    documentation: `${origin}/docs`,
    quickstart: `${origin}/quickstart.md`,
    aiInstructions: `${origin}/llms.txt`,
    openapi: `${origin}/openapi`,
    source: 'https://github.com/tmwe-dev/voice-translator2/tree/bartalk-api-v1/bartalk-api',
    authentication: {
      exchange: `${origin}/api/v1/auth/exchange`,
      input: 'BarTalk session Bearer token',
      output: 'bt_live_* Bearer API key',
      storage: 'server-side only',
      maxTtlDays: 7,
    },
    integrationPolicy: {
      publicApiOnly: true,
      internalCoreAccess: false,
      openapiIsAuthoritative: true,
      credentialsInBrowser: false,
      credentialsInUrl: false,
    },
    instructionForAiBuilder: `Read ${origin}/llms.txt, then ${origin}/openapi, and build only against BarTalk Public API v1.`,
  }, {
    headers: { 'cache-control': 'public, max-age=300' },
  });
}
