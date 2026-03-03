'use client';
import { Component } from 'react';

/**
 * ErrorBoundary — catches React render errors gracefully
 * Shows a friendly fallback UI instead of a white screen
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
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const { fallback } = this.props;
      if (fallback) return fallback;

      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh', padding: 32, textAlign: 'center',
          background: 'linear-gradient(135deg, #0a0a1a 0%, #1a1a2e 100%)',
          color: '#e0e0e0', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{'\u26A0\uFE0F'}</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px', color: '#fff' }}>
            Oops! Qualcosa non ha funzionato
          </h2>
          <p style={{ fontSize: 14, color: '#aaa', maxWidth: 400, lineHeight: 1.5, margin: '0 0 24px' }}>
            Si è verificato un errore imprevisto. Puoi provare a ripristinare la vista o ricaricare la pagina.
          </p>
          {this.state.error && (
            <pre style={{
              fontSize: 11, color: '#FF6B6B', background: 'rgba(255,107,107,0.1)',
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
              Riprova
            </button>
            <button onClick={this.handleReload} style={{
              padding: '10px 24px', borderRadius: 12, border: 'none',
              background: 'linear-gradient(135deg, #6C63FF, #8B5CF6)', color: '#fff',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>
              Ricarica pagina
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
