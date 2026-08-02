# Security Notes — BarTalk b.51

## Remaining Known Vulnerabilities (2 high)

### Next.js 14.2.35 — multiple DoS vectors
- GHSA-h25m-26qc-wcjf: HTTP request deserialization DoS (fixed in 15.0.8)
- GHSA-q4gf-8mx6-v5v3: DoS with Server Components (fixed in 15.5.15)
- GHSA-8h8q-6873-q5fj: DoS with Server Components (fixed in 15.5.15)
- GHSA-p9j2-gv94-2wf4: SSRF in rewrites (fixed in 15.5.15)

**Mitigation**: App is deployed on Vercel which provides DDoS protection at edge.
No rewrites are used in next.config.js. Server Components are not used (app uses
client-side SPA pattern with 'use client'). Risk is low but not zero.

**Fix**: Upgrade to Next.js 15.5.22 (requires React 19 migration — breaking change).
Estimated effort: 4-8 hours for React 19 compat + testing.

### PostCSS <=8.5.17 — XSS and path traversal
- GHSA-qx2v-qp2m-jg93: XSS via unescaped `</style>` in CSS stringify
- GHSA-6g55-p6wh-862q: Arbitrary file read via sourceMappingURL
- GHSA-r28c-9q8g-f849: Path traversal in source map auto-loading

**Mitigation**: PostCSS runs at build time only, not at runtime. These vulns
affect build pipelines processing untrusted CSS (not applicable here).

**Fix**: Bundled with Next.js — fixed automatically by upgrading Next.js.

## Security Hardening Applied (b.49-b.51)

1. ✅ OAuth state CSRF protection (mandatory state parameter)
2. ✅ ADMIN_PASS mandatory for all test endpoints
3. ✅ RLS payments INSERT = service-role only (WITH CHECK false)
4. ✅ Tokens removed from query strings (Authorization header only)
5. ✅ Stripe returnUrl whitelist validation
6. ✅ resolveRoomIdentity fix for conversation retrieval
7. ✅ Name-only access removed from conversation history
8. ✅ OTP with crypto.randomInt + attempt limiting
9. ✅ Google/Apple audience validation mandatory
10. ✅ Impersonation via name removed from live rooms
11. ✅ Service worker cache of private data disabled
12. ✅ Supabase RPC revoked for anon/authenticated
13. ✅ Redis atomic operations with CAS
