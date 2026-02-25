import { NextResponse } from 'next/server';
import { redis } from '../../lib/redis.js';

// Secret admin passphrase — change this in production
const ADMIN_PASS = process.env.ADMIN_PASS || 'NCC-1701-D';

export async function POST(req) {
  try {
    const { action, pass } = await req.json();

    if (pass !== ADMIN_PASS) {
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

    return NextResponse.json({ error: 'Unknown command, Captain.' }, { status: 400 });
  } catch (e) {
    console.error('Startrek error:', e);
    return NextResponse.json({ error: 'Warp core breach: ' + e.message }, { status: 500 });
  }
}
