import CookieConsent from './components/CookieConsent.js';
import SkipToContent from './components/SkipToContent.js';
import { LANGS } from './lib/constants.js';

// ═══════════════════════════════════════════════════════════════
// LAYOUT — una sola fonte per i tag della testata.
//
// Prima gli stessi 14 meta erano scritti DUE volte: una dall'oggetto
// `metadata` (che Next inserisce da solo) e una a mano dentro <head>.
// React 19 sposta da solo meta, link e title nella testata, e il doppio
// elenco arrivava in ordine diverso fra server e browser: da lì l'errore
// di idratazione #418 ad ogni avvio, che costringeva React a buttare via
// l'albero e ridisegnare tutto da capo.
//
// Regola: i meta stanno SOLO in `metadata` e `viewport`. Dentro <head>
// restano solo gli script e i preconnect, che quell'API non copre.
// ═══════════════════════════════════════════════════════════════

const DESCRIZIONE = `Traduzione vocale in tempo reale con l'IA: parli nella tua lingua, l'altro ti sente nella sua. ${LANGS.length} lingue, voci naturali, 30 minuti in regalo.`;
const SITO = 'https://voice-translator2.vercel.app';

export const metadata = {
  metadataBase: new URL(SITO),
  title: 'BarTalk — Traduzione vocale in tempo reale',
  description: DESCRIZIONE,
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/icon-96x96.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-72x72.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'BarTalk',
  },
  openGraph: {
    title: 'BarTalk — Traduzione vocale in tempo reale',
    description: DESCRIZIONE,
    type: 'website',
    url: SITO,
    images: [{ url: '/api/og', width: 1200, height: 630, alt: 'BarTalk — traduzione vocale in tempo reale' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BarTalk — Traduzione vocale in tempo reale',
    description: DESCRIZIONE,
    images: ['/api/og'],
  },
  // I meta di Apple Sign-In non hanno un posto dedicato nell'API: vanno qui,
  // non a mano nel <head>, altrimenti si torna al doppio elenco.
  ...(process.env.NEXT_PUBLIC_APPLE_CLIENT_ID ? {
    other: {
      'appleid-signin-client-id': process.env.NEXT_PUBLIC_APPLE_CLIENT_ID,
      'appleid-signin-scope': 'name email',
      'appleid-signin-redirect-uri': process.env.NEXT_PUBLIC_URL || SITO,
      'appleid-signin-use-popup': 'true',
    },
  } : {}),
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#060810' },
    { media: '(prefers-color-scheme: light)', color: '#F0F4F8' },
  ],
};

// Dati strutturati per i motori di ricerca: descrivono il modello VERO
// (ricariche prepagate + regalo di benvenuto), non un piano gratuito.
const DATI_STRUTTURATI = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'BarTalk',
  description: DESCRIZIONE,
  url: SITO,
  applicationCategory: 'CommunicationApplication',
  operatingSystem: 'Any',
  offers: {
    '@type': 'Offer',
    price: '4.99',
    priceCurrency: 'EUR',
    description: 'Ricariche prepagate di minuti, senza abbonamento. 30 minuti in regalo alla registrazione.',
  },
  featureList: [
    'Traduzione vocale in tempo reale',
    `${LANGS.length} lingue`,
    'Voci naturali di sintesi',
    'Clonazione della voce',
    'Modalità aula',
    'Videochiamate dirette fra i due dispositivi',
  ],
};

// b.363 — "it" qui sotto e solo il valore di PARTENZA del guscio: questo file
// gira sul server e non conosce la lingua scelta dalla persona. Appena l'app
// parte, il contesto lo corregge con quella vera (AppContext.js).
export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <head>
        {/* Solo cose che l'API dei metadati non copre: script e preconnect. */}
        <link rel="preconnect" href="https://api.openai.com" />
        <link rel="dns-prefetch" href="https://api.openai.com" />
        <link rel="preconnect" href="https://api.deepgram.com" />
        <link rel="dns-prefetch" href="https://api.deepgram.com" />

        {/* Identificativi OAuth dalle variabili d'ambiente */}
        <script dangerouslySetInnerHTML={{__html: `
          window.__VT_GOOGLE_CLIENT_ID = "${process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''}";
          window.__VT_APPLE_CLIENT_ID = "${process.env.NEXT_PUBLIC_APPLE_CLIENT_ID || ''}";
          window.__VT_TESTING_MODE = ${process.env.NEXT_PUBLIC_TESTING_MODE === 'true' ? 'true' : 'false'};
        `}} />
        {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
          <script src="https://accounts.google.com/gsi/client" async defer />
        )}
        {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && (
          <script
            defer
            data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
            src="https://plausible.io/js/script.js"
          />
        )}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(DATI_STRUTTURATI) }}
        />
        {/* b.146 — Luca: "elimina quella barra laterale". Su macOS con
            "mostra sempre le barre di scorrimento" ogni colonna interna
            (scrollCenter, chatArea) disegnava una barra grigia spessa
            accanto al contenuto. L'app ha l'aspetto di un telefono: lo
            scorrimento resta (rotella, trackpad, touch), sparisce solo
            l'indicatore. */}
        <style dangerouslySetInnerHTML={{ __html:
          `*{scrollbar-width:none;-ms-overflow-style:none}*::-webkit-scrollbar{width:0;height:0;display:none}`
        }} />
        {/* b.361 — UN SOLO FONT in tutta l'app, quello di Apple (collaudo di
            Luca: «stai usando un font vecchio che sembra un Times, usa solo un
            font apple»). Forzato su tutto, cosi nessun elemento cade sul serif
            di sistema. */}
        <style dangerouslySetInnerHTML={{ __html:
          `html,body,button,input,textarea,select,h1,h2,h3,h4,h5,h6,p,span,div,a,label{font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','SF Pro Display','Helvetica Neue',Arial,sans-serif}`
        }} />
      </head>
      <body style={{margin:0, padding:0, paddingTop:'env(safe-area-inset-top)', paddingBottom:'env(safe-area-inset-bottom)', overflow:'hidden', background:'transparent'}}>
        <SkipToContent />
        <main id="main-content">
          {children}
        </main>
        <CookieConsent />
      </body>
    </html>
  );
}
