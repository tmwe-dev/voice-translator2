import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { getConversation, updateConversationSummary } from '../../lib/store.js';
import { getSession, getUser, deductCredits } from '../../lib/users.js';
import { MIN_CHARGE, ERRORS, calcGptCost, usdToEurCents } from '../../lib/config.js';
import { trackDailySpend } from '../../lib/apiAuth.js';
import { createLogger } from '../../lib/logger.js';
import { assertCloudProcessingAllowed, DirectModeError } from '../../lib/sessionGuard.js';
import { addebitaRiassunto } from '../../wallet/addebita.js';

const log = createLogger('summary');

async function handlePost(req) {
  try {
    // ── Direct mode guard ──
    try { assertCloudProcessingAllowed(req); } catch (e) {
      if (e instanceof DirectModeError) return NextResponse.json({ error: e.message }, { status: 403 });
      throw e;
    }

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

    // ── b.123 · AVERE UN ACCOUNT NON VUOL DIRE ESSERCI STATO ──
    //
    // Qui c'era un controllo solo: "sei autenticato?". Superato quello,
    // si prendeva la conversazione e si costruiva la TRASCRIZIONE
    // INTEGRALE da mandare al modello. Mancava la seconda domanda, che
    // e quella che conta: "sei stato in QUESTA conversazione?".
    //
    // Da solo sarebbe stato grave a meta — bisogna indovinare un
    // identificativo. Ma insieme al buco di /api/conversation, dove
    // bastava un nome per farsi dare l'elenco degli identificativi, non
    // c'era piu niente da indovinare: si prendeva la lista di Mario e
    // si chiedeva il riassunto delle sue conversazioni, una per una.
    //
    // Due controlli deboli in due file diversi, ciascuno con la sua
    // buona ragione, che messi in fila diventano una porta aperta.
    // E il motivo per cui i test verdi su ogni singolo pezzo non
    // bastano: nessuno di loro guarda la catena.
    //
    // Il riassunto e anche l'unica risposta che RIVELEREBBE il contenuto
    // in forma leggibile — quindi il controllo va qui, prima di leggere
    // anche un solo messaggio.
    const nomeUtente = session.name || session.email;
    const eraPresente = conv.members?.some((m) => m.name === nomeUtente);
    if (!eraPresente) {
      log.warn('riassunto negato: utente estraneo alla conversazione');
      return NextResponse.json(
        { error: 'Non hai partecipato a questa conversazione' },
        { status: 403 }
      );
    }

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
      } catch (e) { log.error('Summary credit deduct error:', e); }
    }

    // ── Wallet: riassunto = 10 secondi di credito, addebito dopo il lavoro ──
    await addebitaRiassunto(isOwnKey ? null : billingEmail);

    let summary;
    try {
      const raw = completion.choices[0].message.content.trim();
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      summary = JSON.parse(cleaned);
    } catch (parseErr) {
      log.error('Summary parse error:', parseErr);
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
    log.error('Summary error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 30, prefix: 'summary' });
