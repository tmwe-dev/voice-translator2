import { NextResponse } from 'next/server';
import { getSession, getUser, createGiftInvite, acceptGiftInvite, getGiftInfo } from '../../lib/users.js';
import { redis } from '../../lib/redis.js';
import { checkRateLimit, getRateLimitKey } from '../../lib/rateLimit.js';

// Contact list & presence system
// Redis keys:
//   contacts:{email} → SET of contact emails
//   presence:{email} → { online: true, lastSeen: timestamp } with TTL 90s
//   invite:{code} → { from: email, created: timestamp } with TTL 7 days

const PRESENCE_TTL = 90; // seconds — heartbeat every 60s, expire after 90s
const INVITE_TTL = 604800; // 7 days

export async function POST(req) {
  try {
    const { action, token, contactEmail, inviteCode, giftAmount } = await req.json();

    // Rate limit
    const rl = await checkRateLimit(getRateLimitKey(req, 'contacts'), 30);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    // Auth required for all actions
    if (!token) {
      return NextResponse.json({ error: 'Auth required' }, { status: 401 });
    }
    const session = await getSession(token);
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }
    const email = session.email;

    // === HEARTBEAT — update presence ===
    if (action === 'heartbeat') {
      const presenceKey = `presence:${email}`;
      await redis('SET', presenceKey, JSON.stringify({
        online: true,
        lastSeen: Date.now()
      }), 'EX', PRESENCE_TTL);
      return NextResponse.json({ ok: true });
    }

    // === GO OFFLINE ===
    if (action === 'offline') {
      await redis('DEL', `presence:${email}`);
      return NextResponse.json({ ok: true });
    }

    // === ADD CONTACT ===
    if (action === 'add') {
      if (!contactEmail) {
        return NextResponse.json({ error: 'contactEmail required' }, { status: 400 });
      }
      const targetEmail = contactEmail.toLowerCase().trim();
      if (targetEmail === email) {
        return NextResponse.json({ error: 'Cannot add yourself' }, { status: 400 });
      }

      // Check if target user exists
      const targetUser = await getUser(targetEmail);
      if (!targetUser) {
        return NextResponse.json({ error: 'User not found', notRegistered: true }, { status: 404 });
      }

      // Add bidirectional contact
      await redis('SADD', `contacts:${email}`, targetEmail);
      await redis('SADD', `contacts:${targetEmail}`, email);

      return NextResponse.json({
        ok: true,
        contact: {
          email: targetUser.email,
          name: targetUser.name || '',
          avatar: targetUser.avatar || '/avatars/1.png',
          lang: targetUser.lang || 'it',
        }
      });
    }

    // === REMOVE CONTACT ===
    if (action === 'remove') {
      if (!contactEmail) {
        return NextResponse.json({ error: 'contactEmail required' }, { status: 400 });
      }
      const targetEmail = contactEmail.toLowerCase().trim();
      await redis('SREM', `contacts:${email}`, targetEmail);
      await redis('SREM', `contacts:${targetEmail}`, email);
      return NextResponse.json({ ok: true });
    }

    // === LIST CONTACTS with presence ===
    if (action === 'list') {
      const contactEmails = await redis('SMEMBERS', `contacts:${email}`);
      if (!contactEmails || !Array.isArray(contactEmails) || contactEmails.length === 0) {
        return NextResponse.json({ contacts: [] });
      }

      const contacts = [];
      for (const ce of contactEmails) {
        const user = await getUser(ce);
        if (!user) continue;

        // Check presence
        const presenceData = await redis('GET', `presence:${ce}`);
        let online = false;
        let lastSeen = 0;
        if (presenceData) {
          try {
            const p = JSON.parse(presenceData);
            online = p.online || false;
            lastSeen = p.lastSeen || 0;
          } catch {}
        }

        contacts.push({
          email: user.email,
          name: user.name || '',
          avatar: user.avatar || '/avatars/1.png',
          lang: user.lang || 'it',
          online,
          lastSeen,
        });
      }

      // Sort: online first, then by name
      contacts.sort((a, b) => {
        if (a.online && !b.online) return -1;
        if (!a.online && b.online) return 1;
        return (a.name || a.email).localeCompare(b.name || b.email);
      });

      return NextResponse.json({ contacts });
    }

    // === GENERATE INVITE LINK (with optional gift) ===
    if (action === 'create-invite') {
      // If gift amount specified, create a gift invite (escrow model)
      if (giftAmount && giftAmount > 0) {
        try {
          const user = await getUser(email);
          const result = await createGiftInvite(email, user?.name || '', giftAmount);
          return NextResponse.json({
            ok: true,
            inviteCode: result.inviteCode,
            giftApplied: true,
            giftAmount,
            newBalance: result.newBalance
          });
        } catch (e) {
          return NextResponse.json({ error: e.message }, { status: 400 });
        }
      }

      // Standard invite (no gift)
      const code = generateInviteCode();
      const inviteKey = `invite:${code}`;
      await redis('SET', inviteKey, JSON.stringify({
        from: email,
        fromName: (await getUser(email))?.name || '',
        created: Date.now()
      }), 'EX', INVITE_TTL);

      return NextResponse.json({ ok: true, inviteCode: code });
    }

    // === ACCEPT INVITE ===
    if (action === 'accept-invite') {
      if (!inviteCode) {
        return NextResponse.json({ error: 'inviteCode required' }, { status: 400 });
      }
      const inviteKey = `invite:${inviteCode}`;
      const inviteData = await redis('GET', inviteKey);
      if (!inviteData) {
        return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 404 });
      }

      let invite; try { invite = JSON.parse(inviteData); } catch { return NextResponse.json({ error: 'Invalid invite data' }, { status: 400 }); }
      if (invite.from === email) {
        return NextResponse.json({ error: 'Cannot accept your own invite' }, { status: 400 });
      }

      // Add bidirectional contact
      await redis('SADD', `contacts:${email}`, invite.from);
      await redis('SADD', `contacts:${invite.from}`, email);

      // Don't delete invite — allow multiple people to use it (unless it's a gift)
      const inviterUser = await getUser(invite.from);
      const response = {
        ok: true,
        inviter: {
          email: invite.from,
          name: inviterUser?.name || invite.fromName || '',
          avatar: inviterUser?.avatar || '/avatars/1.png',
        }
      };

      // If invite has a gift, try to apply it (check if not already claimed)
      if (invite.giftAmount && invite.giftAmount > 0 && invite.giftStatus === 'pending') {
        try {
          const giftResult = await acceptGiftInvite(email, inviteCode);
          if (giftResult) {
            response.giftReceived = giftResult.giftAmount;
            response.giftFromName = giftResult.senderName;
            // Mark gift as claimed to prevent double-claims
            const updatedInviteData = { ...invite, giftStatus: 'claimed', claimedBy: email, claimedAt: Date.now() };
            await redis('SET', inviteKey, JSON.stringify(updatedInviteData), 'EX', INVITE_TTL);
          }
        } catch (e) {
          console.error('Gift acceptance error:', e);
          // Gift claim failed, but contact addition succeeded
        }
      }

      return NextResponse.json(response);
    }

    // === GET GIFT INFO (public, for display before acceptance) ===
    if (action === 'get-gift-info') {
      if (!inviteCode) {
        return NextResponse.json({ error: 'inviteCode required' }, { status: 400 });
      }
      const info = await getGiftInfo(inviteCode);
      if (!info) {
        return NextResponse.json({ error: 'No gift found or already claimed' }, { status: 404 });
      }
      return NextResponse.json({ ok: true, gift: info });
    }

    // === START DIRECT CHAT with contact ===
    if (action === 'start-chat') {
      if (!contactEmail) {
        return NextResponse.json({ error: 'contactEmail required' }, { status: 400 });
      }
      const targetEmail = contactEmail.toLowerCase().trim();

      // Verify they are contacts
      const isContact = await redis('SISMEMBER', `contacts:${email}`, targetEmail);
      if (!isContact) {
        return NextResponse.json({ error: 'Not in your contacts' }, { status: 403 });
      }

      // Check if target is online
      const presenceData = await redis('GET', `presence:${targetEmail}`);
      let targetOnline = false;
      if (presenceData) {
        try { const p = JSON.parse(presenceData); targetOnline = p.online || false; } catch { targetOnline = false; }
      }

      return NextResponse.json({
        ok: true,
        targetOnline,
        // The frontend will create a room and send the room code to the contact
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (e) {
    console.error('Contacts error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function generateInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = 'VT-';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
