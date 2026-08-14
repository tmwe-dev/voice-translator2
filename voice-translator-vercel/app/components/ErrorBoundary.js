'use client';
import { Component } from 'react';
import { t, preloadLang, linguaInterfacciaFuoriContesto } from '../lib/i18n.js';
import { PALETTE } from '../lib/palette.js';

/**
 * ErrorBoundary — catches React render errors gracefully
 * Shows a friendly fallback UI instead of a white screen
 * i18n: Detects user language for error messages
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary]', error, errorInfo);
    // Report to Sentry if available
    if (typeof window !== 'undefined') {
      import('@sentry/nextjs').then(Sentry => {
        Sentry.captureException(error, {
          contexts: { react: { componentStack: errorInfo?.componentStack } },
          tags: { source: 'ErrorBoundary' },
        });
      }).catch(() => {
        console.error('[ErrorBoundary] Failed to report to Sentry, logged locally:', error);
      });
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  // ── b.138 · la schermata di errore aveva un dizionario tutto suo ──
  //
  // Qui dentro c'era una tabella di dieci lingue scritta a mano, con
  // quattro frasi ciascuna: mancavano thai, hindi, russo, turco e
  // vietnamita, e chi aveva scelto una di quelle vedeva l'inglese pur
  // avendo l'app tradotta. Peggio: la lingua la deduceva SOLO dal
  // browser, ignorando prefs.uiLang — un italiano in Germania con il
  // telefono in tedesco leggeva l'errore in tedesco.
  //
  // Ora usa i pacchetti veri (15 lingue) e la stessa funzione degli
  // altri componenti fuori dal contesto. E una classe, quindi non puo
  // usare useApp(): la lingua la legge al momento del disegno.
  getErrorText(key) {
    let lang = 'en';
    try {
      lang = linguaInterfacciaFuoriContesto();
      preloadLang(lang);   // se il pacchetto non c'e ancora, t() ripiega su en
    } catch (e) { console.warn('[ErrorBoundary] Language detection failed:', e?.message); }
    return t(lang, key);
  }

  render() {
    if (this.state.hasError) {
      const { fallback } = this.props;
      if (fallback) return fallback;

      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh', padding: 32, textAlign: 'center',
          background: 'linear-gradient(160deg, #09090b 0%, #111113 30%, #18181b 60%, #09090b 100%)',
          color: '#e0e0e0', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{'\u26A0\uFE0F'}</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px', color: '#fff' }}>
            {this.getErrorText('errorTitle')}
          </h2>
          <p style={{ fontSize: 14, color: '#aaa', maxWidth: 400, lineHeight: 1.5, margin: '0 0 24px' }}>
            {this.getErrorText('errorDesc')}
          </p>
          {this.state.error && (
            <pre style={{
              fontSize: 11, color: PALETTE.coral, background: 'rgba(255,107,107,0.1)',
              padding: '8px 16px', borderRadius: 8, maxWidth: '90vw', overflow: 'auto',
              marginBottom: 24, textAlign: 'left', maxHeight: 120,
            }}>
              {this.state.error.toString()}
            </pre>
          )}
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={this.handleReset} style={{
              padding: '10px 24px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 14,
              fontWeight: 600, cursor: 'pointer',
            }}>
              {this.getErrorText('retryWord')}
            </button>
            <button onClick={this.handleReload} style={{
              padding: '10px 24px', borderRadius: 12, border: 'none',
              background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)', color: '#fff',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>
              {this.getErrorText('reloadPage')}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
