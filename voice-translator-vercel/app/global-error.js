'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect, useState } from 'react';
import { t, linguaInterfacciaFuoriContesto } from './lib/i18n.js';

// b.139 — l'ultima schermata che vede chi incappa in un errore di
// radice, e diceva "Something went wrong" a tutti. Sostituisce l'intero
// documento, percio AppProvider non c'e piu: la lingua si legge da
// sola, come in CookieConsent. Se anche questa lettura fallisce, t()
// ripiega sull'inglese — mai una pagina bianca.
export default function GlobalError({ error, reset }) {
  const [lingua, setLingua] = useState('en');
  const T = (k) => t(lingua, k);

  useEffect(() => {
    setLingua(linguaInterfacciaFuoriContesto());
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
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>{T('errorTitle')}</h2>
          <p style={{ fontSize: 14, color: '#71717a', marginBottom: 24 }}>
            {T('errorNotified')}
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
            {T('retryWord')}
          </button>
        </div>
      </body>
    </html>
  );
}
