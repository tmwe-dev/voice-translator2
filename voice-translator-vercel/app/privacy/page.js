'use client';

import Link from 'next/link';

export default function Privacy() {
  const handleBack = () => {
    if (typeof window !== 'undefined') {
      window.history.back();
    }
  };

  const containerStyle = {
    background: '#09090b',
    color: '#e4e4e7',
    minHeight: '100vh',
    padding: '20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  };

  const contentStyle = {
    maxWidth: '900px',
    margin: '0 auto',
    paddingBottom: '60px',
  };

  const headerStyle = {
    marginBottom: '40px',
    paddingBottom: '20px',
    borderBottom: '1px solid #27272a',
  };

  const titleStyle = {
    fontSize: '32px',
    fontWeight: 'bold',
    marginBottom: '10px',
    color: '#f97316',
  };

  const dateStyle = {
    fontSize: '13px',
    color: '#71717a',
    marginTop: '10px',
  };

  const sectionStyle = {
    marginBottom: '30px',
  };

  const headingStyle = {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '12px',
    color: '#f97316',
    marginTop: '25px',
  };

  const headingFirstStyle = {
    ...headingStyle,
    marginTop: '0',
  };

  const paragraphStyle = {
    fontSize: '14px',
    lineHeight: '1.6',
    color: '#e4e4e7',
    marginBottom: '12px',
  };

  const listStyle = {
    fontSize: '14px',
    lineHeight: '1.6',
    color: '#e4e4e7',
    marginLeft: '20px',
    marginBottom: '12px',
  };

  const listItemStyle = {
    marginBottom: '8px',
  };

  const buttonStyle = {
    padding: '10px 16px',
    marginTop: '30px',
    background: 'transparent',
    border: '1px solid #f97316',
    color: '#f97316',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
  };

  return (
    <div style={containerStyle}>
      <div style={contentStyle}>
        <div style={headerStyle}>
          <h1 style={titleStyle}>Privacy Policy</h1>
          <p style={dateStyle}>Effective Date: March 2026</p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingFirstStyle}>1. Introduction</h2>
          <p style={paragraphStyle}>
            BarTalk (we, us, our) is committed to protecting your privacy and ensuring transparency about how we collect, use, and protect your personal data. This Privacy Policy explains our practices in accordance with the General Data Protection Regulation (GDPR) and other applicable data protection laws.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>2. Data We Collect</h2>
          <p style={paragraphStyle}>
            <strong>Account Information:</strong>
          </p>
          <ul style={listStyle}>
            <li style={listItemStyle}>Email address</li>
            <li style={listItemStyle}>Display name (optional)</li>
            <li style={listItemStyle}>Avatar choice (optional)</li>
            <li style={listItemStyle}>Language preferences</li>
          </ul>

          <p style={paragraphStyle}>
            <strong>Usage Data:</strong>
          </p>
          <ul style={listStyle}>
            <li style={listItemStyle}>Voice recordings — processed in real-time for translation, not permanently stored</li>
            <li style={listItemStyle}>Translation text — processed transiently, not archived by default</li>
            <li style={listItemStyle}>Translation history (if you opt-in) — encrypted and stored per your preferences</li>
            <li style={listItemStyle}>API usage logs — for billing and service analytics</li>
          </ul>

          <p style={paragraphStyle}>
            <strong>Technical Data:</strong>
          </p>
          <ul style={listStyle}>
            <li style={listItemStyle}>IP address (for security and abuse prevention)</li>
            <li style={listItemStyle}>Browser type and version</li>
            <li style={listItemStyle}>Device information</li>
            <li style={listItemStyle}>Cookies and localStorage data</li>
          </ul>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>3. How We Use Your Data</h2>
          <p style={paragraphStyle}>
            We use your data to:
          </p>
          <ul style={listStyle}>
            <li style={listItemStyle}>Provide, improve, and personalize the translation service</li>
            <li style={listItemStyle}>Authenticate users and manage accounts</li>
            <li style={listItemStyle}>Process payments and billing through Stripe</li>
            <li style={listItemStyle}>Monitor service quality, security, and performance</li>
            <li style={listItemStyle}>Detect and prevent abuse or fraudulent activity</li>
            <li style={listItemStyle}>Communicate with you about service updates and support</li>
            <li style={listItemStyle}>Comply with legal obligations</li>
          </ul>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>4. Third-Party Services & Data Sharing</h2>
          <p style={paragraphStyle}>
            BarTalk integrates with the following third-party services. Your content is shared only for processing the translation service:
          </p>
          <ul style={listStyle}>
            <li style={listItemStyle}><strong>OpenAI</strong> — Language translation via GPT models</li>
            <li style={listItemStyle}><strong>Anthropic</strong> — Language translation via Claude models</li>
            <li style={listItemStyle}><strong>Google</strong> — Language translation and speech-to-text services</li>
            <li style={listItemStyle}><strong>ElevenLabs</strong> — Text-to-speech synthesis</li>
            <li style={listItemStyle}><strong>Stripe</strong> — Payment processing (PCI-DSS compliant)</li>
            <li style={listItemStyle}><strong>Supabase</strong> — User data storage (EU data centers)</li>
            <li style={listItemStyle}><strong>Vercel</strong> — Application hosting</li>
          </ul>
          <p style={paragraphStyle}>
            Each service has its own privacy policy. We recommend reviewing them to understand their data practices. We do not sell or rent your personal data to third parties.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>5. Data Storage & Security</h2>
          <p style={paragraphStyle}>
            <strong>Storage Location:</strong> User data is stored on Supabase EU data centers, subject to EU data protection laws.
          </p>
          <p style={paragraphStyle}>
            <strong>Encryption:</strong> Sensitive data (API keys, payment info) is encrypted at rest using AES-256 encryption. Data in transit is encrypted using TLS/SSL.
          </p>
          <p style={paragraphStyle}>
            <strong>Voice & Translation Content:</strong> Real-time processing means voice and translation content is typically not permanently retained by BarTalk. If you enable history saving, your translations are encrypted and stored in your account.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>6. Cookies & localStorage</h2>
          <p style={paragraphStyle}>
            BarTalk uses:
          </p>
          <ul style={listStyle}>
            <li style={listItemStyle}><strong>Session cookies</strong> — Authentication and session management</li>
            <li style={listItemStyle}><strong>localStorage</strong> — Language preferences, UI settings, cookie consent choice</li>
            <li style={listItemStyle}><strong>Analytics cookies</strong> — Service usage tracking (via Vercel Analytics)</li>
          </ul>
          <p style={paragraphStyle}>
            You can manage cookie preferences through our Cookie Consent banner. Declining non-essential cookies may affect some functionality.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>7. Your Privacy Rights (GDPR)</h2>
          <p style={paragraphStyle}>
            Under GDPR, you have the right to:
          </p>
          <ul style={listStyle}>
            <li style={listItemStyle}><strong>Access (Art. 15):</strong> Request a copy of your personal data</li>
            <li style={listItemStyle}><strong>Rectification (Art. 16):</strong> Correct inaccurate data</li>
            <li style={listItemStyle}><strong>Erasure (Art. 17):</strong> Request deletion of your data (right to be forgotten)</li>
            <li style={listItemStyle}><strong>Data Portability (Art. 20):</strong> Download your data in machine-readable format</li>
            <li style={listItemStyle}><strong>Object (Art. 21):</strong> Opt-out of processing for specific purposes</li>
            <li style={listItemStyle}><strong>Withdraw Consent:</strong> Withdraw consent for data processing at any time</li>
          </ul>
          <p style={paragraphStyle}>
            To exercise these rights, email privacy@voicetranslate.app with your request. We will respond within 30 days.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>8. Data Retention</h2>
          <p style={paragraphStyle}>
            <strong>Account Data:</strong> Retained until you request deletion. After deletion, data is permanently removed from all systems.
          </p>
          <p style={paragraphStyle}>
            <strong>Translation Content:</strong> Real-time translations are not permanently stored. History (if enabled) is retained with your account and deleted upon account deletion.
          </p>
          <p style={paragraphStyle}>
            <strong>Billing Records:</strong> Retained for 7 years to comply with tax and accounting regulations.
          </p>
          <p style={paragraphStyle}>
            <strong>Logs:</strong> Server logs are retained for 90 days for security and debugging purposes.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>9. Children's Privacy</h2>
          <p style={paragraphStyle}>
            BarTalk is not intended for users under 16 years of age. We do not knowingly collect data from children under 16. If we become aware of such collection, we will delete the data promptly.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>10. International Data Transfers</h2>
          <p style={paragraphStyle}>
            BarTalk primarily stores data in the EU. When data is transferred to the US or other countries (e.g., for AI processing), we rely on appropriate safeguards such as Standard Contractual Clauses and/or adequacy decisions.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>11. Policy Updates</h2>
          <p style={paragraphStyle}>
            We may update this Privacy Policy periodically. Material changes will be communicated via email or a prominent notice. Your continued use of BarTalk constitutes acceptance of updated terms.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>12. Data Protection Officer & Contact</h2>
          <p style={paragraphStyle}>
            <strong>Data Protection Officer (DPO):</strong> privacy@voicetranslate.app
          </p>
          <p style={paragraphStyle}>
            <strong>Support:</strong> support@voicetranslate.app
          </p>
          <p style={paragraphStyle}>
            For GDPR-related requests, data export, or privacy concerns, contact the DPO immediately. We will respond within 30 days.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>13. Your GDPR Rights Summary</h2>
          <p style={paragraphStyle}>
            <strong>Download Your Data (Data Portability):</strong> You can request a machine-readable export of your account data and usage history via <Link href="/" style={{color: '#f97316', textDecoration: 'none', cursor: 'pointer'}}>your account settings</Link>.
          </p>
          <p style={paragraphStyle}>
            <strong>Delete Your Data (Right to Erasure):</strong> Request permanent deletion of all account data, translation history, and usage logs.
          </p>
          <p style={paragraphStyle}>
            <strong>Access Your Data (Right to Access):</strong> Receive a copy of all personal data we hold about you in a structured, commonly-used format.
          </p>
        </div>

        <button
          style={buttonStyle}
          onClick={handleBack}
          onMouseEnter={(e) => {
            e.target.style.background = 'rgba(249, 115, 22, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'transparent';
          }}
        >
          ← Back
        </button>
      </div>
    </div>
  );
}
