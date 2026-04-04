// ═══════════════════════════════════════════════
// Credit Gifting — Escrow-based gift invite system
// ═══════════════════════════════════════════════

import { redis } from './redis.js';
import { addCredits, deductCredits } from './credits.js';

const GIFT_MIN = 50;           // min 50 credits (€0.50)
const GIFT_INVITE_TTL = 604800; // 7 days in seconds

function generateGiftCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = 'VT-GIFT-';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Create a gift invite — deducts credits from sender IMMEDIATELY (escrow)
 */
export async function createGiftInvite(senderEmail, senderName, giftAmount, user) {
  const lowerEmail = senderEmail.toLowerCase();
  if (!user) throw new Error('User not found');
  if (giftAmount < GIFT_MIN) throw new Error(`Minimum gift is ${GIFT_MIN} credits`);
  const maxGift = Math.floor(user.credits * 0.5);
  if (giftAmount > maxGift) throw new Error(`Maximum gift is 50% of your balance (${maxGift})`);
  if (giftAmount > user.credits) throw new Error('Insufficient credits');

  const updated = await deductCredits(lowerEmail, giftAmount);
  if (!updated) throw new Error('Insufficient credits');

  const code = generateGiftCode();
  const now = Date.now();
  const expires = now + GIFT_INVITE_TTL * 1000;

  const inviteKey = `invite:${code}`;
  await redis('SET', inviteKey, JSON.stringify({
    from: lowerEmail, fromName: senderName || user.name || '',
    giftAmount, giftStatus: 'pending', created: now, expires
  }), 'EX', GIFT_INVITE_TTL);

  const escrowKey = `gift-escrow:${code}`;
  await redis('SET', escrowKey, JSON.stringify({
    senderEmail: lowerEmail, amount: giftAmount, status: 'pending', createdAt: now
  }), 'EX', GIFT_INVITE_TTL + 86400);

  await redis('SADD', 'expiring-gifts', code);
  return { inviteCode: code, newBalance: updated.credits };
}

/**
 * Accept a gift invite — transfer credits to recipient
 */
export async function acceptGiftInvite(recipientEmail, inviteCode) {
  const inviteKey = `invite:${inviteCode}`;
  const data = await redis('GET', inviteKey);
  if (!data) return null;

  let invite; try { invite = JSON.parse(data); } catch { return null; }
  if (!invite.giftAmount || invite.giftAmount <= 0) return null;
  if (invite.giftStatus !== 'pending') return null;

  if (invite.expires && Date.now() > invite.expires) {
    await refundGift(inviteCode, invite);
    return null;
  }

  await addCredits(recipientEmail.toLowerCase(), invite.giftAmount);

  invite.giftStatus = 'accepted';
  invite.acceptedBy = recipientEmail.toLowerCase();
  invite.acceptedAt = Date.now();
  const ttlRemaining = Math.max(60, Math.floor((invite.expires - Date.now()) / 1000));
  await redis('SET', inviteKey, JSON.stringify(invite), 'EX', ttlRemaining);

  const escrowKey = `gift-escrow:${inviteCode}`;
  const escrowData = await redis('GET', escrowKey);
  if (escrowData) {
    let escrow; try { escrow = JSON.parse(escrowData); } catch { escrow = null; }
    if (escrow) {
      escrow.status = 'accepted';
      escrow.acceptedBy = recipientEmail.toLowerCase();
      escrow.acceptedAt = Date.now();
      await redis('SET', escrowKey, JSON.stringify(escrow), 'EX', 86400);
    }
  }

  await redis('SREM', 'expiring-gifts', inviteCode);
  return { giftAmount: invite.giftAmount, senderName: invite.fromName || '' };
}

/**
 * Get gift info for display before acceptance
 */
export async function getGiftInfo(inviteCode, getUser) {
  const data = await redis('GET', `invite:${inviteCode}`);
  if (!data) return null;
  let invite; try { invite = JSON.parse(data); } catch { return null; }
  if (!invite.giftAmount || invite.giftStatus !== 'pending') return null;
  const sender = await getUser(invite.from);
  return {
    senderName: sender?.name || invite.fromName || '',
    senderAvatar: sender?.avatar || '/avatars/1.png',
    giftAmount: invite.giftAmount,
    expiresAt: invite.expires
  };
}

/**
 * Refund a single expired gift
 */
async function refundGift(code, invite) {
  if (!invite || invite.giftStatus !== 'pending') return false;
  await addCredits(invite.from, invite.giftAmount);
  invite.giftStatus = 'refunded';
  invite.refundedAt = Date.now();
  await redis('SET', `invite:${code}`, JSON.stringify(invite), 'EX', 86400);

  const escrowKey = `gift-escrow:${code}`;
  const escrowData = await redis('GET', escrowKey);
  if (escrowData) {
    let escrow; try { escrow = JSON.parse(escrowData); } catch { escrow = null; }
    if (escrow) {
      escrow.status = 'refunded';
      escrow.refundedAt = Date.now();
      await redis('SET', escrowKey, JSON.stringify(escrow), 'EX', 86400);
    }
  }
  await redis('SREM', 'expiring-gifts', code);
  return true;
}

/**
 * Refund all expired gifts (run periodically)
 */
export async function refundExpiredGifts() {
  const codes = await redis('SMEMBERS', 'expiring-gifts');
  if (!codes || !Array.isArray(codes) || codes.length === 0) return { refunded: 0, totalAmount: 0 };

  let refunded = 0, totalAmount = 0;
  for (const code of codes) {
    const data = await redis('GET', `invite:${code}`);
    if (!data) {
      const escrowData = await redis('GET', `gift-escrow:${code}`);
      if (escrowData) {
        let escrow; try { escrow = JSON.parse(escrowData); } catch { escrow = null; }
        if (escrow) {
          if (escrow.status === 'pending') {
            await addCredits(escrow.senderEmail, escrow.amount);
            escrow.status = 'refunded'; escrow.refundedAt = Date.now();
            await redis('SET', `gift-escrow:${code}`, JSON.stringify(escrow), 'EX', 86400);
            refunded++; totalAmount += escrow.amount;
          }
      }
      await redis('SREM', 'expiring-gifts', code);
      continue;
    }
    let invite; try { invite = JSON.parse(data); } catch { return null; }
    if (invite.giftStatus === 'pending' && invite.expires && Date.now() > invite.expires) {
      await refundGift(code, invite);
      refunded++; totalAmount += invite.giftAmount;
    }
  }
  return { refunded, totalAmount };
}
