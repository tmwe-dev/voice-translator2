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
        <meta name="theme-color" content="#0a0a0f" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body style={{margin:0, padding:0, paddingTop:'env(safe-area-inset-top)', paddingBottom:'env(safe-area-inset-bottom)', overflow:'hidden', background:'#0a0a0f'}}>{children}</body>
    </html>
  );
}
