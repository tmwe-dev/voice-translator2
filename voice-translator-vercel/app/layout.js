export const metadata = {
  title: 'VoiceTranslate - Traduttore Vocale',
  description: 'Real-time voice translator for two people',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'VoiceTranslate',
  },
  openGraph: {
    title: 'VoiceTranslate',
    description: 'Real-time voice translator - Traduttore vocale in tempo reale',
    type: 'website',
    url: 'https://voice-translator2.vercel.app',
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
        {/* OAuth: inject client IDs from env vars + preload SDKs */}
        <script dangerouslySetInnerHTML={{__html: `
          window.__VT_GOOGLE_CLIENT_ID = "${process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''}";
          window.__VT_APPLE_CLIENT_ID = "${process.env.NEXT_PUBLIC_APPLE_CLIENT_ID || ''}";
        `}} />
        {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
          <script src="https://accounts.google.com/gsi/client" async defer />
        )}
        <meta name="appleid-signin-client-id" content={process.env.NEXT_PUBLIC_APPLE_CLIENT_ID || ''} />
        <meta name="appleid-signin-scope" content="name email" />
        <meta name="appleid-signin-redirect-uri" content="https://voice-translator2.vercel.app" />
        <meta name="appleid-signin-use-popup" content="true" />
      </head>
      <body style={{margin:0, padding:0, paddingTop:'env(safe-area-inset-top)', paddingBottom:'env(safe-area-inset-bottom)', overflow:'hidden', background:'transparent'}}>{children}</body>
    </html>
  );
}
