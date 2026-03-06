import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { getConversation, updateConversationSummary } from '../../lib/store.js';
import { getSession, getUser, deductCredits } from '../../lib/users.js';
import { MIN_CHARGE, ERRORS, calcGptCost, usdToEurCents } from '../../lib/config.js';
import { trackDailySpend } from '../../lib/apiAuth.js';

async function handlePost(req) {
  try {
    const { convId, userToken } = await req.json();

    if (!convId) return NextResponse.json({ error: 'convId required' }, { status: 400 });

    // Authentication required (no guest/room path for summaries)
    if (!userToken) {
      return NextResponse.json({ error: ERRORS.AUTH_REQUIRED }, { status: 401 });
    }

    let billingEmail = null;
    let isOwnKey = false;
    let apiKey = process.env.OPENAI_API_KEY;

    const session = await getSession(userToken);
    if (!session) {
      return NextResponse.json({ error: ERRORS.INVALID_SESSION }, { status: 401 });
    }
    billingEmail = session.email;
    const user = await getUser(billingEmail);
    if (user?.useOwnKeys && user.apiKeys?.openai) {
      apiKey = user.apiKeys.openai;
      isOwnKey = true;
    }

    const conv = await getConversation(convId);
    if (!conv) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });

    // If summary already exists, return it (no cost)
    if (conv.summary) {
      return NextResponse.json({ summary: conv.summary });
    }

    const openai = new OpenAI({ apiKey });

    // Build conversation transcript for GPT
    const members = conv.members.map(m => `${m.name} (${m.lang})`).join(' & ');
    const duration = conv.ended && conv.created
      ? Math.round((conv.ended - conv.created) / 60000) : 0;

    let transcript = '';
    for (const msg of conv.messages) {
      transcript += `[${msg.sender}] ${msg.original}\n`;
      transcript += `  → ${msg.translated}\n\n`;
    }

    // Truncate if too long (max ~6000 chars for cost)
    if (transcript.length > 6000) {
      transcript = transcript.substring(0, 6000) + '\n... (truncated)';
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a multilingual conversation analyst. Generate a structured report/summary of a translated conversation.

Output a JSON object with these fields:
- "title": A short title for the conversation (max 60 chars, in the host's language)
- "summary": A 2-3 sentence summary of the main topics discussed (in the host's language)
- "keyPoints": Array of 3-5 key points or decisions made (in the host's language)
- "topics": Array of 1-3 topic tags (e.g., "business", "travel", "personal")
- "sentiment": Overall sentiment ("positive", "neutral", "mixed", "negative")
- "participants": Brief description of who participated and their languages
- "duration": "${duration} minuti"
- "messageCount": ${conv.messages.length}

Output ONLY valid JSON, no markdown, no code blocks.`
        },
        {
          role: 'user',
          content: `Conversation between ${members}:\n\n${transcript}`
        }
      ],
      temperature: 0.3,
      max_tokens: 800
    });

    // Calculate and deduct cost
    const costUsd = calcGptCost(completion.usage);
    const costEurCents = usdToEurCents(costUsd);

    if (billingEmail && !isOwnKey) {
      try {
        const charge = Math.max(MIN_CHARGE.SUMMARY, costEurCents);
        await deductCredits(billingEmail, charge);
        await trackDailySpend(billingEmail, charge);
      } catch (e) { console.error('Summary credit deduct error:', e); }
    }

    let summary;
    try {
      const raw = completion.choices[0].message.content.trim();
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      summary = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('Summary parse error:', parseErr);
      summary = {
        title: 'Conversazione',
        summary: completion.choices[0].message.content.trim().substring(0, 200),
        keyPoints: [],
        topics: [],
        sentiment: 'neutral',
        participants: members,
        duration: `${duration} minuti`,
        messageCount: conv.messages.length
      };
    }

    // Save summary to conversation
    await updateConversationSummary(convId, summary);

    return NextResponse.json({ summary });
  } catch (e) {
    if (e instanceof NextResponse) return e;
    console.error('Summary error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 30, prefix: 'summary' });
