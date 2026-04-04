import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0a0a1a 0%, #1a1a2e 50%, #16213e 100%)',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          position: 'relative',
        }}
      >
        {/* Decorative gradient circles */}
        <div style={{
          position: 'absolute', top: -80, right: -80, width: 300, height: 300,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(108,99,255,0.3), transparent)',
          display: 'flex',
        }} />
        <div style={{
          position: 'absolute', bottom: -60, left: -60, width: 250, height: 250,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.2), transparent)',
          display: 'flex',
        }} />

        {/* App icon */}
        <div style={{
          fontSize: 72, marginBottom: 16, display: 'flex',
        }}>
          🎤
        </div>

        {/* Title */}
        <div style={{
          fontSize: 56, fontWeight: 800, color: '#ffffff',
          letterSpacing: '-1px', marginBottom: 8, display: 'flex',
        }}>
          BarTalk
        </div>

        {/* Subtitle */}
        <div style={{
          fontSize: 26, color: 'rgba(255,255,255,0.7)',
          maxWidth: 700, textAlign: 'center', lineHeight: 1.4,
          display: 'flex',
        }}>
          Real-time AI Voice Translation · 15+ Languages
        </div>

        {/* Feature pills */}
        <div style={{
          display: 'flex', gap: 16, marginTop: 32,
        }}>
          {['Voice Cloning', 'Multi-Provider AI', 'Free to Start'].map((f) => (
            <div
              key={f}
              style={{
                padding: '10px 20px', borderRadius: 24,
                background: 'rgba(108,99,255,0.2)', border: '1px solid rgba(108,99,255,0.4)',
                color: '#a5a0ff', fontSize: 18, fontWeight: 600,
                display: 'flex',
              }}
            >
              {f}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
