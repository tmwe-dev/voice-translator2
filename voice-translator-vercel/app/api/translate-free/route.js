import { NextResponse } from 'next/server';

// Free translation using MyMemory API
// No API key needed, no cost - uses community translation memory
// With email param: 50000 chars/day (resets at midnight UTC)

const MYMEMORY_URL = 'https://api.mymemory.translated.net/get';
const FREE_DAILY_LIMIT = 50000; // chars per day with email registration

export async function POST(req) {
  try {
    const { text, sourceLang, targetLang } = await req.json();
    if (!text?.trim()) return NextResponse.json({ translated: '', charsUsed: 0 });

    const trimmed = text.trim();
    const charsUsed = trimmed.length;

    // MyMemory supports standard ISO 639-1 codes with pipe separator
    const langpair = `${sourceLang}|${targetLang}`;
    const url = `${MYMEMORY_URL}?q=${encodeURIComponent(trimmed)}&langpair=${langpair}&de=voicetranslator@app.com`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'VoiceTranslator/2.0' }
    });

    if (!res.ok) throw new Error(`MyMemory API error: ${res.status}`);
    const data = await res.json();

    const translated = data.responseData?.translatedText || '';

    // Detect daily limit exceeded
    // MyMemory returns 429 or specific messages when limit is hit
    if (data.responseStatus === 429 ||
        (translated && translated.includes('MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS')) ||
        (translated && translated.includes('MYMEMORY WARNING'))) {
      return NextResponse.json({
        translated: trimmed,
        fallback: true,
        limitExceeded: true,
        charsUsed: 0,
        dailyLimit: FREE_DAILY_LIMIT
      });
    }

    // MyMemory sometimes returns the original text in UPPERCASE when it can't translate
    // or returns "PLEASE SELECT TWO LANGUAGES" - handle these
    if (!translated ||
        translated === trimmed.toUpperCase() ||
        translated.includes('PLEASE SELECT')) {
      return NextResponse.json({ translated: trimmed, fallback: true, charsUsed });
    }

    return NextResponse.json({
      translated: translated.trim(),
      match: data.responseData?.match || 0,
      fallback: false,
      charsUsed,
      dailyLimit: FREE_DAILY_LIMIT
    });
  } catch (e) {
    console.error('Free translate error:', e);
    return NextResponse.json({ translated: '', fallback: true, error: e.message, charsUsed: 0 });
  }
}
