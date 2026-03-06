import CookieConsent from './components/CookieConsent.js';
import SkipToContent from './components/SkipToContent.js';

export const metadata = {
  title: 'VoiceTranslate — Real-time AI Voice Translation',
  description: 'Real-time voice translation with AI. Speak in your language, hear in theirs. 15+ languages, voice cloning, classroom mode. Free to start.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'VoiceTranslate',
  },
  openGraph: {
    title: 'VoiceTranslate — Real-time Voice Translation',
    description: 'Speak in your language, hear in theirs. AI-powered voice translation for 15+ languages.',
    type: 'website',
    url: 'https://www.voicetranslate.app',
    images: [{ url: '/api/og', width: 1200, height: 630, alt: 'VoiceTranslate — Real-time AI Voice Translation' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VoiceTranslate — Real-time Voice Translation',
    description: 'AI-powered voice translation for 15+ languages. Free to start.',
    images: ['/api/og'],
  },
};
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#0B0D1A" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-96x96.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-72x72.png" />
        {/* Enhanced SEO Meta Tags */}
        <meta name="description" content="Real-time voice translation with AI. Speak in your language, hear in theirs. 15+ languages, voice cloning, classroom mode. Free to start." />
        <meta property="og:title" content="VoiceTranslate — Real-time Voice Translation" />
        <meta property="og:description" content="Speak in your language, hear in theirs. AI-powered voice translation for 15+ languages." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.voicetranslate.app" />
        <meta property="og:image" content="/api/og" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="VoiceTranslate — Real-time Voice Translation" />
        <meta name="twitter:description" content="AI-powered voice translation for 15+ languages. Free to start." />
        <meta name="twitter:image" content="/api/og" />
        {/* OAuth: inject client IDs from env vars + preload SDKs */}
        <script dangerouslySetInnerHTML={{__html: `
          window.__VT_GOOGLE_CLIENT_ID = "${process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''}";
          window.__VT_APPLE_CLIENT_ID = "${process.env.NEXT_PUBLIC_APPLE_CLIENT_ID || ''}";
        `}} />
        {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
          <script src="https://accounts.google.com/gsi/client" async defer />
        )}
        {/* Apple Sign-In meta tags — only rendered when Apple client ID is configured */}
        {process.env.NEXT_PUBLIC_APPLE_CLIENT_ID && (
          <>
            <meta name="appleid-signin-client-id" content={process.env.NEXT_PUBLIC_APPLE_CLIENT_ID} />
            <meta name="appleid-signin-scope" content="name email" />
            <meta name="appleid-signin-redirect-uri" content={process.env.NEXT_PUBLIC_URL || 'https://www.voicetranslate.app'} />
            <meta name="appleid-signin-use-popup" content="true" />
          </>
        )}
        {/* Plausible Analytics — privacy-first, no cookies, GDPR compliant */}
        {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && (
          <script
            defer
            data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
            src="https://plausible.io/js/script.js"
          />
        )}
        {/* JSON-LD Structured Data for SEO */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'VoiceTranslate',
              description: 'Real-time voice translation app with AI-powered speech recognition and synthesis in 15+ languages',
              url: 'https://www.voicetranslate.app',
              applicationCategory: 'CommunicationApplication',
              operatingSystem: 'Any',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'EUR',
                description: 'Free tier with basic translation features',
              },
              featureList: [
                'Real-time voice translation',
                'Support for 15+ languages',
                'AI-powered speech synthesis',
                'Voice cloning',
                'Classroom mode',
                'P2P video calls',
              ],
            }),
          }}
        />
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
