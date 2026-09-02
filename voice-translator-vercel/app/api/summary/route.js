import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { getConversation, updateConversationSummary } from '../../lib/store.js';
import { getSession, getUser } from '../../lib/users.js';
import { MIN_CHARGE, ERRORS, calcGptCost, usdToEurCents } from '../../lib/config.js';
import { trackDailySpend } from '../../lib/apiAuth.js';
import { createLogger } from '../../lib/logger.js';
import { assertCloudProcessingAllowed, assertElaborazioneConsentita, DirectModeError } from '../../lib/sessionGuard.js';
import { riserva, commit, release } from '../../wallet/riserva.js';
import { costoRiassunto } from '../../wallet/consumo.js';

const log = createLogger('summary');

async function handlePost(req) {
  // b.171 — riserva wallet dichiarata FUORI dal try, cosi il ramo di
  // errore la restituisce (release). Stesso schema di tts/route.js.
  let riservaId = null;
  try {
    // b.580 — la modalita Diretta si blocca PRIMA di leggere il body.
    // Il client non e una fonte autorevole, ma questa prima barriera ha
    // un compito preciso: se dichiara Direct, il server non deve nemmeno
    // deserializzare contenuto destinato a elaborazione cloud. Subito dopo,
    // appena abbiamo convId, resta anche la verifica autorevole sulla stanza.
    try {
      assertCloudProcessingAllowed(req);
    } catch (e) {
      if (e instanceof DirectModeError) return NextResponse.json({ error: e.message }, { status: 403 });
      throw e;
    }

    const { convId, userToken } = await req.json();

    if (!convId) return NextResponse.json({ error: 'convId required' }, { status: 400 });

    // ── Direct mode guard ──
    // b.167 — CONFERMATO (audit esterno 15/8): mancava la domanda alla
    // stanza vera. convId E roomId (stessa chiave, vedi saveConversation
    // in store.js): una stanza Diretta non dovrebbe avere messaggi salvati
    // da riassumere, ma il controllo va fatto comunque qui, non dedotto
    // per assenza — e la stessa disciplina gia applicata alle altre rotte.
    try {
      await assertElaborazioneConsentita(req, { roomId: convId });
    } catch (e) {
      if (e instanceof DirectModeError) return NextResponse.json({ error: e.message }, { status: 403 });
      throw e;
    }

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

    // b.159 — CONFERMATO (audit b.158, punto 7): qui non esisteva NESSUN
    // controllo del credito prima di chiamare OpenAI (a differenza di
    // tts-elevenlabs, che e il riferimento corretto): l'addebito partiva
    // dopo, il suo esito ('esaurito' compreso) veniva ignorato, e il
    // riassunto veniva restituito comunque. Un wallet a zero non
    // fermava niente: pagava solo la piattaforma.
    // b.171 — RISERVA prima di OpenAI, non piu "controlla poi addebita".
    // Il vecchio pre-controllo leggeva il saldo ma non lo bloccava: due
    // riassunti concorrenti passavano entrambi sullo STESSO saldo e
    // chiamavano entrambi OpenAI, poi solo l'addebito finale ne
    // distingueva uno. Ora si blocca il costo fisso SUBITO e atomico,
    // come translate/tts: commit dopo il successo, release nel catch.
    const costoR = costoRiassunto();
    if (billingEmail && !isOwnKey) {
      const r = await riserva(billingEmail, costoR, { tipo: 'riassunto', convId });
      if (!r.ok) {
        return NextResponse.json({ error: 'Credito insufficiente' }, { status: 402 });
      }
      riservaId = r.riservaId;
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

    // Calculate cost (per il tetto di piattaforma; il wallet ha il suo
    // conto fisso, confermato dal commit della riserva piu sotto)
    const costUsd = calcGptCost(completion.usage);
    const costEurCents = usdToEurCents(costUsd);

    // b.157 — tolto il doppio addebito sul vecchio user.credits: il
    // wallet (il commit della riserva, subito sotto) e il conto vero.
    if (billingEmail && !isOwnKey) {
      // b.594 — MODULO 3 (piano qualita): era `await`, quindi un timeout
      // Redis qui (41 occ/mese in produzione) allungava la risposta
      // all'utente per un contatore che non serve alla risposta stessa.
      // trackDailySpend cattura gia i suoi errori internamente (vedi
      // apiAuth.js) — fuoco-e-dimentica, stesso pattern gia in uso in
      // transcribe/translate/tts/chat-action.
      const charge = Math.max(MIN_CHARGE.SUMMARY, costEurCents);
      trackDailySpend(billingEmail, charge).catch((e) => log.error('Summary daily-spend tracking error:', e));
    }

    // ── Wallet: conferma la riserva presa prima di OpenAI ──
    // b.171 — costo fisso, quindi commit allo stesso importo riservato.
    // Con chiave propria (isOwnKey) non c'era riserva: riservaId resta
    // null e il wallet non si tocca.
    if (riservaId) {
      await commit(riservaId, costoR, { tipo: 'riassunto', convId });
      riservaId = null;
    }

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
    // b.171 — riserva attiva + errore = si restituisce il credito. Mai
    // lasciarlo bloccato per un riassunto che non e stato consegnato.
    if (riservaId) await release(riservaId, 'errore_imprevisto').catch(() => {});
    if (e instanceof NextResponse) return e;
    log.error('Summary error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 30, prefix: 'summary' });
