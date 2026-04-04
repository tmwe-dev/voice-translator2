'use client';

import Link from 'next/link';

export default function Terms() {
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
          <h1 style={titleStyle}>Terms of Service</h1>
          <p style={dateStyle}>Effective Date: March 2026</p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingFirstStyle}>1. Service Description</h2>
          <p style={paragraphStyle}>
            BarTalk is a real-time voice translation web application that enables users to translate spoken words and text across 31+ languages. The service is provided on an as-is basis and is subject to these Terms of Service.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>2. Account Registration & Access</h2>
          <p style={paragraphStyle}>
            BarTalk offers both account registration (with email or social login) and guest access without creating an account. Guest users may have limitations on storage, history, and feature access compared to registered users.
          </p>
          <p style={paragraphStyle}>
            By registering, you agree to provide accurate information and maintain the confidentiality of your credentials.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>3. Acceptable Use Policy</h2>
          <p style={paragraphStyle}>
            You agree not to use BarTalk for:
          </p>
          <ul style={listStyle}>
            <li style={listItemStyle}>Hate speech, discrimination, or harassment</li>
            <li style={listItemStyle}>Illegal content or activities</li>
            <li style={listItemStyle}>Abuse of the translation service (e.g., spam, automated abuse)</li>
            <li style={listItemStyle}>Reverse-engineering or attempting to circumvent access controls</li>
            <li style={listItemStyle}>Violating third-party intellectual property rights</li>
            <li style={listItemStyle}>Any use that violates applicable laws and regulations</li>
          </ul>
          <p style={paragraphStyle}>
            Violations may result in service suspension or permanent termination without refund.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>4. Subscription Tiers & Billing</h2>
          <p style={paragraphStyle}>
            BarTalk offers the following subscription tiers:
          </p>
          <ul style={listStyle}>
            <li style={listItemStyle}><strong>FREE</strong> — Limited daily translations, community features</li>
            <li style={listItemStyle}><strong>STARTER</strong> — Monthly subscription with increased limits</li>
            <li style={listItemStyle}><strong>PRO</strong> — Premium features, unlimited translations, API access</li>
          </ul>
          <p style={paragraphStyle}>
            Billing is processed through Stripe. All charges are in EUR. Subscription renewals are automatic and charged at the beginning of each billing cycle. You may cancel at any time through your account settings.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>5. API Keys & Third-Party Services</h2>
          <p style={paragraphStyle}>
            BarTalk supports the use of your own API keys from third-party AI providers (OpenAI, Anthropic, Google, ElevenLabs). You are responsible for:
          </p>
          <ul style={listStyle}>
            <li style={listItemStyle}>Obtaining valid API keys from these services</li>
            <li style={listItemStyle}>Maintaining the confidentiality of your API keys</li>
            <li style={listItemStyle}>All charges incurred through your API keys</li>
            <li style={listItemStyle}>Compliance with each provider's terms of service</li>
          </ul>
          <p style={paragraphStyle}>
            BarTalk is not responsible for any misuse of your API keys or charges incurred. You assume all risk by providing your API keys.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>6. Intellectual Property</h2>
          <p style={paragraphStyle}>
            All translations are generated by AI services (OpenAI, Anthropic, Google, ElevenLabs) and are not stored permanently on our servers unless you explicitly opt-in to save them. Translation history is encrypted and retained only for your account access.
          </p>
          <p style={paragraphStyle}>
            You retain ownership of the content you provide for translation. BarTalk retains no exclusive rights to translations generated through the service.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>7. Disclaimers</h2>
          <p style={paragraphStyle}>
            AI-powered translation may not be 100% accurate. We recommend human review for critical documents, legal contracts, or sensitive communications. BarTalk is not responsible for:
          </p>
          <ul style={listStyle}>
            <li style={listItemStyle}>Translation errors or inaccuracies</li>
            <li style={listItemStyle}>Misinterpretation of translations</li>
            <li style={listItemStyle}>Service interruptions or downtime</li>
            <li style={listItemStyle}>Loss of data or translation history</li>
            <li style={listItemStyle}>Performance issues in any particular language or dialect</li>
          </ul>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>8. Limitation of Liability</h2>
          <p style={paragraphStyle}>
            To the fullest extent permitted by Italian law, BarTalk and its creators are not liable for indirect, incidental, special, consequential, or punitive damages, even if advised of the possibility of such damages.
          </p>
          <p style={paragraphStyle}>
            Our total liability for any claim shall not exceed the amount you paid for the service in the past 12 months, or 50 EUR if no payment was made.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>9. Termination</h2>
          <p style={paragraphStyle}>
            We may terminate your account without notice if you violate these Terms of Service. You may terminate your account at any time by contacting support@voicetranslate.app. Upon termination, your data will be deleted in accordance with our Privacy Policy.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>10. Changes to These Terms</h2>
          <p style={paragraphStyle}>
            We may update these Terms of Service at any time. Material changes will be communicated to users via email or a prominent notice on the website. Your continued use of BarTalk constitutes acceptance of the updated terms.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>11. Governing Law & Jurisdiction</h2>
          <p style={paragraphStyle}>
            These Terms of Service are governed by and construed in accordance with the laws of Italy and the European Union, particularly GDPR regulations. Any disputes shall be resolved in the courts of Italy.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>12. Contact</h2>
          <p style={paragraphStyle}>
            For questions or concerns regarding these Terms of Service, please contact:
          </p>
          <p style={paragraphStyle}>
            <strong>Email:</strong> support@voicetranslate.app
          </p>
          <p style={paragraphStyle}>
            <strong>Privacy Policy:</strong> <Link href="/privacy" style={{color: '#f97316', textDecoration: 'none', cursor: 'pointer', borderBottom: '1px solid #f97316'}}>View Privacy Policy</Link>
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
