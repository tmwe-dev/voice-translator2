'use client';

/**
 * Next.js loading.js — shown during route transitions
 * Provides a polished skeleton UI matching the app's dark theme
 */
export default function Loading() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', padding: 32,
      background: 'linear-gradient(135deg, #0a0a1a 0%, #1a1a2e 100%)',
      color: '#e0e0e0', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    }}>
      <style>{`
        @keyframes vtPulse { 0%,100% { opacity: 0.3; } 50% { opacity: 0.7; } }
        @keyframes vtSpin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Animated logo / spinner */}
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        border: '3px solid rgba(108,99,255,0.2)',
        borderTopColor: '#6C63FF',
        animation: 'vtSpin 0.8s linear infinite',
        marginBottom: 24,
      }} />

      {/* Skeleton card */}
      <div style={{
        width: '100%', maxWidth: 400, padding: 24, borderRadius: 16,
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      }}>
        {/* Title skeleton */}
        <div style={{
          height: 20, width: '60%', borderRadius: 8,
          background: 'rgba(255,255,255,0.08)',
          animation: 'vtPulse 1.5s ease-in-out infinite',
          marginBottom: 16,
        }} />
        {/* Line skeletons */}
        {[100, 85, 70].map((w, i) => (
          <div key={i} style={{
            height: 12, width: `${w}%`, borderRadius: 6,
            background: 'rgba(255,255,255,0.06)',
            animation: 'vtPulse 1.5s ease-in-out infinite',
            animationDelay: `${i * 0.2}s`,
            marginBottom: 10,
          }} />
        ))}
        {/* Button skeleton */}
        <div style={{
          height: 40, width: '50%', borderRadius: 12, marginTop: 16,
          background: 'rgba(108,99,255,0.15)',
          animation: 'vtPulse 1.5s ease-in-out infinite',
          animationDelay: '0.6s',
        }} />
      </div>
    </div>
  );
}
