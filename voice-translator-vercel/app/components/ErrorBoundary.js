'use client';
import { Component } from 'react';
import { t, mapLang } from '../lib/i18n.js';

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

  /** Detect browser language and return localized error strings */
  getErrorText(key) {
    const TEXTS = {
      en: { title: 'Something went wrong', desc: 'An unexpected error occurred. Try again or reload the page.', retry: 'Try Again', reload: 'Reload Page' },
      it: { title: 'Qualcosa è andato storto', desc: 'Si è verificato un errore imprevisto. Riprova o ricarica la pagina.', retry: 'Riprova', reload: 'Ricarica' },
      es: { title: 'Algo salió mal', desc: 'Ocurrió un error inesperado. Inténtalo de nuevo o recarga la página.', retry: 'Reintentar', reload: 'Recargar' },
      fr: { title: 'Une erreur est survenue', desc: 'Une erreur inattendue s\'est produite. Réessayez ou rechargez la page.', retry: 'Réessayer', reload: 'Recharger' },
      de: { title: 'Etwas ist schiefgelaufen', desc: 'Ein unerwarteter Fehler ist aufgetreten. Versuchen Sie es erneut oder laden Sie die Seite neu.', retry: 'Erneut versuchen', reload: 'Neu laden' },
      pt: { title: 'Algo deu errado', desc: 'Ocorreu um erro inesperado. Tente novamente ou recarregue a página.', retry: 'Tentar novamente', reload: 'Recarregar' },
      ja: { title: 'エラーが発生しました', desc: '予期しないエラーが発生しました。もう一度お試しいただくか、ページを再読み込みしてください。', retry: '再試行', reload: '再読み込み' },
      zh: { title: '出现错误', desc: '发生了意外错误。请重试或刷新页面。', retry: '重试', reload: '刷新页面' },
      ko: { title: '오류가 발생했습니다', desc: '예기치 않은 오류가 발생했습니다. 다시 시도하거나 페이지를 새로고침하세요.', retry: '다시 시도', reload: '새로고침' },
      ar: { title: 'حدث خطأ', desc: 'حدث خطأ غير متوقع. حاول مرة أخرى أو أعد تحميل الصفحة.', retry: 'إعادة المحاولة', reload: 'إعادة التحميل' },
    };
    let lang = 'en';
    try {
      const nav = typeof navigator !== 'undefined' ? (navigator.language || '').slice(0, 2).toLowerCase() : 'en';
      lang = TEXTS[nav] ? nav : mapLang(nav);
    } catch (e) { console.warn('[ErrorBoundary] Language detection failed:', e?.message); }
    const strings = TEXTS[lang] || TEXTS.en;
    return strings[key] || TEXTS.en[key] || key;
  }

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
            {this.getErrorText('title')}
          </h2>
          <p style={{ fontSize: 14, color: '#aaa', maxWidth: 400, lineHeight: 1.5, margin: '0 0 24px' }}>
            {this.getErrorText('desc')}
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
              {this.getErrorText('retry')}
            </button>
            <button onClick={this.handleReload} style={{
              padding: '10px 24px', borderRadius: 12, border: 'none',
              background: 'linear-gradient(135deg, #26D9B0, #8B6AFF)', color: '#fff',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>
              {this.getErrorText('reload')}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
