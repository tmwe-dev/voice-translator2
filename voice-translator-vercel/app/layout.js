export const metadata = {
  title: 'VoiceTranslate - Traduttore Vocale',
  description: 'Real-time voice translator for two people',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
};
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#0a0a0f" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body style={{margin:0, padding:0, overflow:'hidden'}}>{children}</body>
    </html>
  );
}
