import { NextResponse } from 'next/server';
import { redis } from '../../lib/redis.js';
import { safeCompare } from '../../lib/apiGuard.js';

// Admin passphrase — MUST be set in environment variables
const ADMIN_PASS = process.env.ADMIN_PASS;
if (!ADMIN_PASS) {
  console.warn('⚠️ ADMIN_PASS not set — admin endpoints will be disabled');
}

export async function POST(req) {
  try {
    // Admin endpoint disabled if ADMIN_PASS not configured
    if (!ADMIN_PASS) {
      return NextResponse.json({ error: 'Admin endpoint not configured. Set ADMIN_PASS env var.' }, { status: 503 });
    }

    // Rate limit admin auth attempts: 5 per minute per IP
    const { checkRateLimit, getRateLimitKey } = await import('../../lib/rateLimit.js');
    const rl = await checkRateLimit(getRateLimitKey(req, 'admin'), 5);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many attempts. Locked out.' }, { status: 429 });
    }

    const { action, pass } = await req.json();

    if (!pass || !safeCompare(pass, ADMIN_PASS)) {
      return NextResponse.json({ error: 'Access denied, Captain.' }, { status: 403 });
    }

    // === LIST ALL USERS ===
    if (action === 'crew-manifest') {
      // SCAN for all user:* keys
      const users = [];
      let cursor = '0';
      do {
        const result = await redis('SCAN', cursor, 'MATCH', 'user:*', 'COUNT', '100');
        cursor = result[0];
        const keys = result[1];
        for (const key of keys) {
          try {
            const data = await redis('GET', key);
            if (data) {
              const user = JSON.parse(data);
              // Don't send API keys
              users.push({
                email: user.email,
                name: user.name || '',
                lang: user.lang || 'it',
                avatar: user.avatar || '',
                credits: user.credits || 0,
                totalSpent: user.totalSpent || 0,
                totalMessages: user.totalMessages || 0,
                useOwnKeys: !!user.useOwnKeys,
                hasApiKeys: !!(user.apiKeys && (user.apiKeys.encrypted || Object.keys(user.apiKeys).some(k => user.apiKeys[k]))),
                created: user.created || 0,
                lastLogin: user.lastLogin || 0,
              });
            }
          } catch {}
        }
      } while (cursor !== '0');

      // Sort by lastLogin descending
      users.sort((a, b) => (b.lastLogin || 0) - (a.lastLogin || 0));

      return NextResponse.json({ users, count: users.length });
    }

    // === ACTIVE ROOMS ===
    if (action === 'active-missions') {
      const rooms = [];
      let cursor = '0';
      do {
        const result = await redis('SCAN', cursor, 'MATCH', 'room:*', 'COUNT', '100');
        cursor = result[0];
        const keys = result[1];
        for (const key of keys) {
          try {
            const data = await redis('GET', key);
            if (data) {
              const room = JSON.parse(data);
              rooms.push({
                id: room.id,
                host: room.host,
                hostTier: room.hostTier || 'FREE',
                mode: room.mode,
                context: room.context || 'general',
                members: (room.members || []).map(m => ({ name: m.name, lang: m.lang, role: m.role })),
                memberCount: (room.members || []).length,
                msgCount: room.msgCount || 0,
                totalCost: room.totalCost || 0,
                created: room.created || 0,
                ended: room.ended || false,
              });
            }
          } catch {}
        }
      } while (cursor !== '0');

      rooms.sort((a, b) => (b.created || 0) - (a.created || 0));
      return NextResponse.json({ rooms, count: rooms.length });
    }

    // === ACTIVE SESSIONS ===
    if (action === 'active-comms') {
      const sessions = [];
      let cursor = '0';
      do {
        const result = await redis('SCAN', cursor, 'MATCH', 'session:*', 'COUNT', '100');
        cursor = result[0];
        const keys = result[1];
        for (const key of keys) {
          try {
            const data = await redis('GET', key);
            if (data) {
              const session = JSON.parse(data);
              sessions.push({
                email: session.email,
                created: session.created || 0,
              });
            }
          } catch {}
        }
      } while (cursor !== '0');

      sessions.sort((a, b) => (b.created || 0) - (a.created || 0));
      return NextResponse.json({ sessions, count: sessions.length });
    }

    // === GLOBAL STATS ===
    if (action === 'ship-status') {
      // Count keys by type
      let userCount = 0, roomCount = 0, sessionCount = 0, convCount = 0;
      let totalCredits = 0, totalSpent = 0, totalMessages = 0;

      // Users
      let cursor = '0';
      do {
        const result = await redis('SCAN', cursor, 'MATCH', 'user:*', 'COUNT', '100');
        cursor = result[0];
        for (const key of result[1]) {
          try {
            const data = await redis('GET', key);
            if (data) {
              const u = JSON.parse(data);
              userCount++;
              totalCredits += u.credits || 0;
              totalSpent += u.totalSpent || 0;
              totalMessages += u.totalMessages || 0;
            }
          } catch {}
        }
      } while (cursor !== '0');

      // Rooms
      cursor = '0';
      do {
        const result = await redis('SCAN', cursor, 'MATCH', 'room:*', 'COUNT', '100');
        cursor = result[0];
        roomCount += result[1].length;
      } while (cursor !== '0');

      // Sessions
      cursor = '0';
      do {
        const result = await redis('SCAN', cursor, 'MATCH', 'session:*', 'COUNT', '100');
        cursor = result[0];
        sessionCount += result[1].length;
      } while (cursor !== '0');

      // Conversations
      cursor = '0';
      do {
        const result = await redis('SCAN', cursor, 'MATCH', 'conv:*', 'COUNT', '100');
        cursor = result[0];
        convCount += result[1].length;
      } while (cursor !== '0');

      return NextResponse.json({
        userCount,
        roomCount,
        sessionCount,
        convCount,
        totalCredits,
        totalSpent,
        totalMessages,
      });
    }

    // === DAILY SPENDING REPORT ===
    if (action === 'daily-report') {
      const todayUTC = new Date().toISOString().split('T')[0];
      const date = todayUTC; // always today for security

      // Platform total
      const platformKey = `daily:platform:${todayUTC}`;
      const platformSpent = parseInt(await redis('GET', platformKey) || '0');

      // Per-user daily spend
      const userSpends = [];
      let cursor = '0';
      do {
        const result = await redis('SCAN', cursor, 'MATCH', `daily:*:${todayUTC}`, 'COUNT', '100');
        cursor = result[0];
        for (const key of result[1]) {
          if (key.startsWith('daily:platform:')) continue;
          const email = key.replace(`daily:`, '').replace(`:${todayUTC}`, '');
          const spent = parseInt(await redis('GET', key) || '0');
          userSpends.push({ email, spent, spentEur: (spent / 100).toFixed(2) });
        }
      } while (cursor !== '0');

      userSpends.sort((a, b) => b.spent - a.spent);

      return NextResponse.json({
        date: todayUTC,
        platformSpent,
        platformSpentEur: (platformSpent / 100).toFixed(2),
        platformLimit: 10000, // from DAILY_LIMITS
        platformLimitEur: '100.00',
        userSpends,
        topSpenders: userSpends.slice(0, 10),
      });
    }

    // === FULL DASHBOARD ===
    if (action === 'dashboard') {
      const todayUTC = new Date().toISOString().split('T')[0];

      // Platform daily spend
      const platformSpent = parseInt(await redis('GET', `daily:platform:${todayUTC}`) || '0');

      // User stats
      const users = [];
      let cursor = '0';
      let totalCredits = 0, totalSpent = 0, totalMessages = 0;
      let ownKeyUsers = 0, paidUsers = 0, freeUsers = 0;
      do {
        const result = await redis('SCAN', cursor, 'MATCH', 'user:*', 'COUNT', '100');
        cursor = result[0];
        for (const key of result[1]) {
          try {
            const data = await redis('GET', key);
            if (data) {
              const u = JSON.parse(data);
              totalCredits += u.credits || 0;
              totalSpent += u.totalSpent || 0;
              totalMessages += u.totalMessages || 0;
              if (u.useOwnKeys) ownKeyUsers++;
              else if (u.credits > 0) paidUsers++;
              else freeUsers++;

              // Get today's spend for this user
              const dailySpent = parseInt(await redis('GET', `daily:${u.email}:${todayUTC}`) || '0');

              users.push({
                email: u.email,
                name: u.name || '',
                credits: u.credits || 0,
                creditsEur: ((u.credits || 0) / 100).toFixed(2),
                totalSpent: u.totalSpent || 0,
                totalSpentEur: ((u.totalSpent || 0) / 100).toFixed(2),
                totalMessages: u.totalMessages || 0,
                todaySpent: dailySpent,
                todaySpentEur: (dailySpent / 100).toFixed(2),
                useOwnKeys: !!u.useOwnKeys,
                hasApiKeys: !!(u.apiKeys && (u.apiKeys.encrypted || Object.keys(u.apiKeys).some(k => u.apiKeys[k]))),
                tier: u.useOwnKeys ? 'OWN_KEYS' : (u.credits > 0 ? 'PAID' : 'FREE'),
                lastLogin: u.lastLogin || 0,
                created: u.created || 0,
              });
            }
          } catch {}
        }
      } while (cursor !== '0');

      users.sort((a, b) => b.todaySpent - a.todaySpent);

      // Active rooms count
      let roomCount = 0;
      cursor = '0';
      do {
        const result = await redis('SCAN', cursor, 'MATCH', 'room:*', 'COUNT', '100');
        cursor = result[0];
        roomCount += result[1].length;
      } while (cursor !== '0');

      // Active sessions count
      let sessionCount = 0;
      cursor = '0';
      do {
        const result = await redis('SCAN', cursor, 'MATCH', 'session:*', 'COUNT', '100');
        cursor = result[0];
        sessionCount += result[1].length;
      } while (cursor !== '0');

      // Revenue (from payments)
      let totalRevenue = 0;
      cursor = '0';
      do {
        const result = await redis('SCAN', cursor, 'MATCH', 'payments:*', 'COUNT', '100');
        cursor = result[0];
        for (const key of result[1]) {
          try {
            const entries = await redis('LRANGE', key, 0, -1);
            if (entries && Array.isArray(entries)) {
              for (const entry of entries) {
                const p = JSON.parse(entry);
                totalRevenue += p.amount || p.euros || 0;
              }
            }
          } catch {}
        }
      } while (cursor !== '0');

      return NextResponse.json({
        overview: {
          totalUsers: users.length,
          freeUsers,
          paidUsers,
          ownKeyUsers,
          activeRooms: roomCount,
          activeSessions: sessionCount,
          totalCreditsInCirculation: totalCredits,
          totalCreditsEur: (totalCredits / 100).toFixed(2),
          totalSpentAllTime: totalSpent,
          totalSpentEur: (totalSpent / 100).toFixed(2),
          totalMessages,
          totalRevenue,
          totalRevenueEur: totalRevenue.toFixed(2),
        },
        today: {
          date: todayUTC,
          platformSpent,
          platformSpentEur: (platformSpent / 100).toFixed(2),
          platformDailyLimit: 10000,
          platformLimitEur: '100.00',
          utilizationPct: ((platformSpent / 10000) * 100).toFixed(1),
        },
        users,
      });
    }

    return NextResponse.json({ error: 'Unknown command, Captain.' }, { status: 400 });
  } catch (e) {
    console.error('Startrek error:', e);
    return NextResponse.json({ error: 'Warp core breach: ' + e.message }, { status: 500 });
  }
}
