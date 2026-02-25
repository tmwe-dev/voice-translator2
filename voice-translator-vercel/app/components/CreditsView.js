'use client';
import { CREDIT_PACKAGES, FONT, formatCredits } from '../lib/constants.js';
import Icon from './Icon.js';

// Inline perk descriptions (IT + EN fallback)
const PERKS = {
  it: {
    creditPerksStarter1: 'Perfetto per provare il servizio',
    creditPerksStarter2: 'Voce AI OpenAI inclusa',
    creditPerks2_1: '~400 messaggi tradotti',
    creditPerks2_2: 'Tutti i contesti disponibili',
    creditPerks5_1: '~1100 messaggi tradotti',
    creditPerks5_2: 'Bonus +10% crediti extra',
    creditPerks5_3: 'Ideale per viaggi e riunioni',
    creditPerks10_1: '~2400 messaggi tradotti',
    creditPerks10_2: 'Bonus +20% crediti extra',
    creditPerks10_3: '20 messaggi con voce TOP PRO inclusi',
    creditPerks20_1: '~5200 messaggi tradotti',
    creditPerks20_2: 'Bonus +30% crediti extra',
    creditPerks20_3: '50 messaggi con voce TOP PRO inclusi',
    creditsNoExpiry: 'I tuoi crediti non scadono per 24 mesi',
    creditsGuarantee: 'Nessun abbonamento, nessun rinnovo automatico. Paghi solo quello che vuoi, quando vuoi. I crediti restano tuoi.',
    securePayment: 'Pagamento sicuro via Stripe',
    topProBonus: 'msg voce TOP PRO inclusi',
    popularLabel: 'Più scelto',
    bestValue: 'Miglior rapporto',
  },
  en: {
    creditPerksStarter1: 'Perfect to try the service',
    creditPerksStarter2: 'OpenAI AI voice included',
    creditPerks2_1: '~400 translated messages',
    creditPerks2_2: 'All contexts available',
    creditPerks5_1: '~1100 translated messages',
    creditPerks5_2: '+10% bonus credits',
    creditPerks5_3: 'Ideal for trips and meetings',
    creditPerks10_1: '~2400 translated messages',
    creditPerks10_2: '+20% bonus credits',
    creditPerks10_3: '20 TOP PRO voice messages included',
    creditPerks20_1: '~5200 translated messages',
    creditPerks20_2: '+30% bonus credits',
    creditPerks20_3: '50 TOP PRO voice messages included',
    creditsNoExpiry: 'Your credits never expire for 24 months',
    creditsGuarantee: 'No subscription, no automatic renewal. Pay only what you want, when you want. Credits stay yours.',
    securePayment: 'Secure payment via Stripe',
    topProBonus: 'TOP PRO voice msgs included',
    popularLabel: 'Most popular',
    bestValue: 'Best value',
  }
};

function getPerk(lang, key) {
  return PERKS[lang]?.[key] || PERKS.en[key] || key;
}

export default function CreditsView({ L, S, creditBalance, buyCredits, authLoading, userAccount, setView, status, theme, setTheme }) {
  const lang = ['it','en'].includes(L('appName') === 'VoiceTranslate' ? 'en' : 'it') ? 'it' : 'en';
  // Simple language detection from L function
  const pLang = L('createRoom') === 'Crea Stanza' ? 'it' : 'en';

  return (
    <div style={S.page}>
      <div style={S.scrollCenter}>
        <div style={S.topBar}>
          <button style={S.backBtn} onClick={() => setView(userAccount ? 'home' : 'account')}>{'\u2190'}</button>
          <span style={{fontWeight:700, fontSize:17}}>{L('rechargeCredits')}</span>
        </div>

        {/* Current balance */}
        {creditBalance > 0 && (
          <div style={{width:'100%', maxWidth:380, marginBottom:14, padding:'12px 16px', borderRadius:16,
            background:'linear-gradient(135deg, rgba(108,99,255,0.08), rgba(0,210,255,0.05))',
            border:'1px solid rgba(108,99,255,0.15)', textAlign:'center'}}>
            <div style={{fontSize:10, color:'rgba(232,234,255,0.4)', marginBottom:3, fontWeight:600, textTransform:'uppercase', letterSpacing:1}}>
              {L('currentBalance')}
            </div>
            <div style={{fontSize:28, fontWeight:800, background:'linear-gradient(135deg, #6C63FF, #00D2FF)',
              WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent'}}>{formatCredits(creditBalance)}</div>
          </div>
        )}

        {/* 24-month guarantee banner */}
        <div style={{width:'100%', maxWidth:380, marginBottom:16, padding:'14px 16px', borderRadius:16,
          background:'linear-gradient(135deg, rgba(0,255,148,0.06), rgba(0,210,255,0.04))',
          border:'1.5px solid rgba(0,255,148,0.15)'}}>
          <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:6}}>
            <div style={{width:36, height:36, borderRadius:10, background:'rgba(0,255,148,0.12)',
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
              <Icon name="lock" size={18} color="#00FF94" />
            </div>
            <div style={{fontSize:14, fontWeight:800, color:'#00FF94'}}>
              {getPerk(pLang, 'creditsNoExpiry')}
            </div>
          </div>
          <div style={{fontSize:11, color:'rgba(232,234,255,0.45)', lineHeight:1.5, paddingLeft:46}}>
            {getPerk(pLang, 'creditsGuarantee')}
          </div>
        </div>

        {/* Packages */}
        <div style={{width:'100%', maxWidth:380}}>
          {CREDIT_PACKAGES.map(pkg => {
            const isPopular = pkg.popular;
            const isBig = pkg.topProTrial;
            return (
              <button key={pkg.id} onClick={() => buyCredits(pkg.id)}
                style={{width:'100%', padding: isPopular ? '20px 16px' : '16px 16px', marginBottom:10, borderRadius:18,
                  background: isPopular
                    ? 'linear-gradient(135deg, rgba(108,99,255,0.12), rgba(0,210,255,0.08))'
                    : pkg.starter
                      ? 'linear-gradient(135deg, rgba(0,255,148,0.06), rgba(0,210,255,0.04))'
                      : 'rgba(232,234,255,0.03)',
                  border: isPopular
                    ? '2px solid rgba(108,99,255,0.35)'
                    : pkg.starter
                      ? '1.5px solid rgba(0,255,148,0.18)'
                      : '1px solid rgba(232,234,255,0.08)',
                  color:'#E8EAFF', cursor:'pointer', fontFamily:FONT, WebkitTapHighlightColor:'transparent',
                  transition:'all 0.15s', position:'relative', textAlign:'left',
                  display:'block'}}>

                {/* Badge */}
                {(pkg.starter || isPopular || isBig) && (
                  <div style={{position:'absolute', top:-10, right:16, padding:'3px 10px', borderRadius:8,
                    background: pkg.starter
                      ? 'linear-gradient(135deg, #00FF94, #00D2FF)'
                      : isPopular
                        ? 'linear-gradient(135deg, #6C63FF, #00D2FF)'
                        : 'linear-gradient(135deg, #FF6B9D, #6C63FF)',
                    color:'#fff', fontSize:9, fontWeight:800, letterSpacing:0.5, textTransform:'uppercase'}}>
                    {pkg.starter ? (L('starterPack')) : isPopular ? getPerk(pLang, 'popularLabel') : getPerk(pLang, 'bestValue')}
                  </div>
                )}

                {/* Main row: icon + price + info */}
                <div style={{display:'flex', alignItems:'center', gap:14}}>
                  <div style={{fontSize:32, width:44, textAlign:'center', flexShrink:0}}>{pkg.icon}</div>
                  <div style={{flex:1}}>
                    <div style={{display:'flex', alignItems:'baseline', gap:8}}>
                      <span style={{fontSize:24, fontWeight:800}}>{pkg.label}</span>
                      {pkg.bonus && (
                        <span style={{fontSize:12, fontWeight:700, color:'#00D2FF',
                          padding:'2px 8px', borderRadius:8, background:'rgba(0,210,255,0.1)'}}>
                          {pkg.bonus}
                        </span>
                      )}
                    </div>
                    <div style={{fontSize:12, color:'rgba(232,234,255,0.45)', marginTop:2}}>{pkg.messages}</div>
                  </div>
                  <div style={{width:40, height:40, borderRadius:12,
                    background: isPopular ? 'rgba(108,99,255,0.15)' : 'rgba(232,234,255,0.06)',
                    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
                    <Icon name="zap" size={20} color={isPopular ? '#6C63FF' : 'rgba(232,234,255,0.35)'} />
                  </div>
                </div>

                {/* Perks list */}
                <div style={{marginTop:10, paddingLeft:58, display:'flex', flexDirection:'column', gap:4}}>
                  {pkg.perks.map((perkKey, i) => (
                    <div key={i} style={{display:'flex', alignItems:'center', gap:6}}>
                      <span style={{color:'#00FF94', fontSize:10, fontWeight:800}}>{'\u2713'}</span>
                      <span style={{fontSize:11, color:'rgba(232,234,255,0.55)'}}>{getPerk(pLang, perkKey)}</span>
                    </div>
                  ))}
                  {pkg.topProTrial && (
                    <div style={{display:'flex', alignItems:'center', gap:6, marginTop:2}}>
                      <span style={{fontSize:10, color:'#FFD700'}}>{'\u2B50'}</span>
                      <span style={{fontSize:11, fontWeight:700, color:'#FFD700'}}>
                        {pkg.topProTrial} {getPerk(pLang, 'topProBonus')}
                      </span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Payment info footer */}
        <div style={{width:'100%', maxWidth:380, marginTop:8, padding:'10px 14px', borderRadius:12,
          background:'rgba(232,234,255,0.02)', border:'1px solid rgba(232,234,255,0.05)',
          display:'flex', alignItems:'center', gap:8}}>
          <Icon name="lock" size={14} color="rgba(232,234,255,0.3)" />
          <div style={{fontSize:10, color:'rgba(232,234,255,0.30)', lineHeight:1.4}}>
            {getPerk(pLang, 'securePayment')} {'\u2022'} Visa, Mastercard, Apple Pay, Google Pay
          </div>
        </div>

        {status && <div style={S.statusMsg}>{status}</div>}
      </div>
    </div>
  );
}
