// NOTE: Cannot use edge runtime due to crypto/Redis deps in resolveAuth
import OpenAI from 'openai';
import { withApiGuard } from '../../lib/apiGuard.js';
import { checkRateLimit, getRateLimitKey } from '../../lib/rateLimit.js';
import { resolveAuth } from '../../lib/apiAuth.js';
import { MODEL_MAP, calcConfidence, validateOutput } from '../../lib/translateValidation.js';
import { buildSystemPrompt, buildMessages } from '../../lib/translatePrompt.js';
import { routeProvider } from '../../lib/providerRouter.js';
import { validateTranslateInput } from '../../lib/schemas.js';
import { ErrorCode, apiError } from '../../lib/errors.js';

// ═══════════════════════════════════════════════
// Translation Streaming via SSE
// First word visible in ~300ms instead of ~1.5s
// Client receives incremental tokens as they're generated
//
// Event format:
//   data: {"delta":"ciao"}
//   data: {"delta":" mondo"}
//   data: {"done":true,"translated":"ciao mondo","confidence":0.95}
// ═══════════════════════════════════════════════

async function handlePost(req) {
  try {

    const body = await req.json();
    const validation = validateTranslateInput(body);
    if (!validation.valid) {
      return apiError(ErrorCode.INVALID_INPUT, validation.error);
    }

    const { text, sourceLang, targetLang, sourceLangName, targetLangName,
            roomId, context, isReview, domainContext, description, userToken,
            aiModel, roomMode, nativeLang, conversationContext } = validation.data;

    // Resolve model
    const modelInfo = MODEL_MAP[aiModel] || MODEL_MAP['gpt-4o-mini'];
    const authProvider = modelInfo.provider === 'openai' ? 'openai'
      : modelInfo.provider === 'anthropic' ? 'anthropic'
      : modelInfo.provider === 'gemini' ? 'gemini' : 'openai';

    // Only OpenAI supports streaming well in this implementation
    if (modelInfo.provider !== 'openai') {
      // Fall back to non-streaming for non-OpenAI providers
      return apiError(ErrorCode.INVALID_INPUT, 'Streaming only supported with OpenAI models. Use /api/translate instead.');
    }

    const { apiKey } = await resolveAuth({
      userToken, roomId, provider: authProvider,
      minCredits: 5, skipCreditCheck: !!isReview,
    });

    // Build prompt
    const systemPrompt = buildSystemPrompt({
      sourceLang, targetLang, sourceLangName, targetLangName,
      roomMode, nativeLang, domainContext, description, isReview, conversationContext
    });
    const messages = buildMessages(systemPrompt, text, context);

    // Create streaming completion
    const openai = new OpenAI({ apiKey });
    const stream = await openai.chat.completions.create({
      model: modelInfo.actual,
      messages,
      temperature: 0.3,
      max_tokens: 500,
      stream: true,
    });

    // SSE response
    const encoder = new TextEncoder();
    let fullText = '';

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) {
              fullText += delta;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
            }
          }

          // Final event with complete text and confidence
          const confidence = calcConfidence(text, fullText, sourceLang, targetLang);
          const valid = validateOutput(text, fullText, targetLang);

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            done: true,
            translated: fullText.trim(),
            confidence,
            valid: valid.valid,
          })}\n\n`));

          controller.close();
        } catch (err) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('Translate-stream error:', e);
    return apiError(ErrorCode.TRANSLATION_FAILED, e.message);
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 60, prefix: 'translate-stream' });
