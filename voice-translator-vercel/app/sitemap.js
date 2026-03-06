export default function sitemap() {
  const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://voicetranslate.app';

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/landing`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date('2026-03-06'),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date('2026-03-06'),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];
}
