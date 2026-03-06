'use client';

import { useEffect, useState } from 'react';

export default function NotFound() {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          window.location.href = '/';
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#09090b',
      color: '#e4e4e7',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      padding: 20,
    }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: 80, marginBottom: 16 }}>🌐</div>
        <h1 style={{ fontSize: 48, fontWeight: 800, margin: '0 0 8px', background: 'linear-gradient(135deg, #f97316, #fb923c)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          404
        </h1>
        <p style={{ fontSize: 16, color: '#a1a1aa', marginBottom: 24 }}>
          This page doesn&apos;t exist. Maybe a translation got lost?
        </p>
        <a
          href="/"
          style={{
            display: 'inline-block',
            padding: '12px 28px',
            borderRadius: 12,
            background: '#f97316',
            color: '#fff',
            fontWeight: 700,
            fontSize: 14,
            textDecoration: 'none',
            transition: 'transform 0.2s',
          }}
          aria-label="Go back to home page"
        >
          Go Home
        </a>
        <p style={{ fontSize: 12, color: '#52525b', marginTop: 16 }}>
          Redirecting in {countdown}s...
        </p>
      </div>
    </div>
  );
}
