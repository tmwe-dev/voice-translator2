'use client';

export default function SkipToContent() {
  return (
    <a
      href="#main-content"
      style={{
        position: 'absolute',
        top: -100,
        left: 0,
        background: '#f97316',
        color: '#fff',
        padding: '8px 16px',
        zIndex: 10000,
        fontSize: 14,
        fontWeight: 700,
        textDecoration: 'none',
        borderRadius: '0 0 8px 0',
        transition: 'top 0.2s',
      }}
      onFocus={(e) => { e.target.style.top = '0'; }}
      onBlur={(e) => { e.target.style.top = '-100px'; }}
    >
      Skip to main content
    </a>
  );
}
