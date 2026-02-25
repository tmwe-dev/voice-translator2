import { NextResponse } from 'next/server';

// Free translation using MyMemory API
// No API key needed, no cost - uses community translation memory
// Limit: ~5000 chars/day per IP (server IP, but low usage expected for trial)
// With email param: 50000 chars/day

const MYMEMORY_URL = 'https://api.mymemory.translated.net/get';

export async function POST(req) {
  try {
    const { text, sourceLang, targetLang } = await req.json();
    if (!text?.trim()) return NextResponse.json({ translated: '' });

    // MyMemory supports standard ISO 639-1 codes with pipe separator
    const langpair = `${sourceLang}|${targetLang}`;
    const url = `${MYMEMORY_URL}?q=${encodeURIComponent(text.trim())}&langpair=${langpair}&de=voicetranslator@app.com`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'VoiceTranslator/2.0' }
    });

    if (!res.ok) throw new Error(`MyMemory API error: ${res.status}`);
    const data = await res.json();

    const translated = data.responseData?.translatedText || '';

    // MyMemory sometimes returns the original text in UPPERCASE when it can't translate
    // or returns "PLEASE SELECT TWO LANGUAGES" - handle these
    if (!translated ||
        translated === text.trim().toUpperCase() ||
        translated.includes('PLEASE SELECT') ||
        translated.includes('MYMEMORY WARNING')) {
      // Fallback: return empty so client can try speechSynthesis with original
      return NextResponse.json({ translated: text.trim(), fallback: true });
    }

    return NextResponse.json({
      translated: translated.trim(),
      match: data.responseData?.match || 0,
      fallback: false
    });
  } catch (e) {
    console.error('Free translate error:', e);
    // On error, return original text so the app doesn't break
    const { text } = await req.json().catch(() => ({ text: '' }));
    return NextResponse.json({ translated: text || '', fallback: true, error: e.message });
  }
}
