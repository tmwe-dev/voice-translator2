'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body style={{
        margin: 0,
        padding: 0,
        background: '#09090b',
        color: '#e4e4e7',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
      }}>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <h1 style={{ fontSize: 64, marginBottom: 16 }}>😵</h1>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Something went wrong</h2>
          <p style={{ fontSize: 14, color: '#71717a', marginBottom: 24 }}>
            An unexpected error occurred. Our team has been notified.
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: '10px 24px',
              borderRadius: 12,
              border: 'none',
              background: '#f97316',
              color: '#fff',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
