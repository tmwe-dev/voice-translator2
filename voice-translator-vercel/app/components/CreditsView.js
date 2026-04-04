'use client';
import { CREDIT_PACKAGES, FONT, formatCredits } from '../lib/constants.js';
import Icon from './Icon.js';

// Inline perk descriptions (IT + EN fallback)
const PERKS = {
  it: {
    creditPerksStarter1: '~900 msg testo o ~180 msg voce AI',
    creditPerksStarter2: '6 voci AI OpenAI incluse',
    creditPerks2_1: '~2000 msg testo o ~400 msg voce AI',
    creditPerks2_2: 'Tutti i 12 contesti disponibili',
    creditPerks5_1: '~5500 msg testo o ~1100 msg voce AI',
    creditPerks5_2: 'Bonus +10% crediti extra (550 crediti)',
    creditPerks5_3: 'Ideale per viaggi e riunioni',
    creditPerks10_1: '~12000 msg testo o ~2400 msg voce AI',
    creditPerks10_2: 'Bonus +20% crediti extra (1200 crediti)',
    creditPerks10_3: '20 messaggi con voce TOP PRO inclusi',
    creditPerks20_1: '~26000 msg testo o ~5200 msg voce AI',
    creditPerks20_2: 'Bonus +30% crediti extra (2600 crediti)',
    creditPerks20_3: '50 messaggi con voce TOP PRO inclusi',
    creditsNoExpiry: 'I tuoi crediti non scadono per 24 mesi',
    creditsGuarantee: 'Nessun abbonamento, nessun rinnovo automatico. Paghi solo quello che vuoi, quando vuoi. I crediti restano tuoi.',
    securePayment: 'Pagamento sicuro via Stripe',
    topProBonus: 'msg voce TOP PRO inclusi',
    popularLabel: 'Più scelto',
    bestValue: 'Miglior rapporto',
    costBreakdown: 'Testo: ~0.1¢/msg \u2022 Voce AI: ~0.5¢/msg',
  },
  en: {
    creditPerksStarter1: '~900 text msgs or ~180 AI voice msgs',
    creditPerksStarter2: '6 OpenAI AI voices included',
    creditPerks2_1: '~2000 text msgs or ~400 AI voice msgs',
    creditPerks2_2: 'All 12 contexts available',
    creditPerks5_1: '~5500 text msgs or ~1100 AI voice msgs',
    creditPerks5_2: '+10% bonus credits (550 credits)',
    creditPerks5_3: 'Ideal for trips and meetings',
    creditPerks10_1: '~12000 text msgs or ~2400 AI voice msgs',
    creditPerks10_2: '+20% bonus credits (1200 credits)',
    creditPerks10_3: '20 TOP PRO voice messages included',
    creditPerks20_1: '~26000 text msgs or ~5200 AI voice msgs',
    creditPerks20_2: '+30% bonus credits (2600 credits)',
    creditPerks20_3: '50 TOP PRO voice messages included',
    creditsNoExpiry: 'Your credits never expire for 24 months',
    creditsGuarantee: 'No subscription, no automatic renewal. Pay only what you want, when you want. Credits stay yours.',
    securePayment: 'Secure payment via Stripe',
    topProBonus: 'TOP PRO voice msgs included',
    popularLabel: 'Most popular',
    bestValue: 'Best value',
    costBreakdown: 'Text: ~0.1¢/msg \u2022 AI Voice: ~0.5¢/msg',
  }
};

function getPerk(lang, key) {
  return PERKS[lang]?.[key] || PERKS.en[key] || key;
}

export default function CreditsView({ L, S, creditBalance, buyCredits, authLoading, userAccount, setView, status, theme, setTheme }) {
  // Direct language detection from L function
  const pLang = L('createRoom') === 'Crea Stanza' ? 'it' : 'en';
  const colors = S.colors;

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
            background:`linear-gradient(135deg, ${colors.accent1Bg}, ${colors.accent2Bg})`,
            border:`1px solid ${colors.accent1Border}`, textAlign:'center'}}>
            <div style={{fontSize:10, color:colors.textSecondary, marginBottom:3, fontWeight:600, textTransform:'uppercase', letterSpacing:1}}>
              {L('currentBalance')}
            </div>
            <div style={{fontSize:28, fontWeight:800, background:colors.btnGradient,
              WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent'}}>{formatCredits(creditBalance)}</div>
          </div>
        )}

        {/* 24-month guarantee banner */}
        <div style={{width:'100%', maxWidth:380, marginBottom:16, padding:'14px 16px', borderRadius:16,
          background:`linear-gradient(135deg, ${colors.accent4Bg}, ${colors.accent2Bg})`,
          border:`1.5px solid ${colors.accent4Border}`}}>
          <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:6}}>
            <div style={{width:36, height:36, borderRadius:10, background:colors.accent4Bg,
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
              <Icon name="lock" size={18} color={colors.accent4} />
            </div>
            <div style={{fontSize:14, fontWeight:800, color:colors.accent4}}>
              {getPerk(pLang, 'creditsNoExpiry')}
            </div>
          </div>
          <div style={{fontSize:11, color:colors.textSecondary, lineHeight:1.5, paddingLeft:46}}>
            {getPerk(pLang, 'creditsGuarantee')}
          </div>
        </div>

        {/* Cost breakdown */}
        <div style={{width:'100%', maxWidth:380, marginBottom:16, padding:'10px 14px', borderRadius:12,
          background:colors.accent1Bg, border:`1px solid ${colors.accent1Border}`, textAlign:'center'}}>
          <div style={{fontSize:11, color:colors.textTertiary, fontWeight:600}}>
            {getPerk(pLang, 'costBreakdown')}
          </div>
          <div style={{fontSize:10, color:colors.textMuted, marginTop:4}}>
            {pLang === 'it' ? '1 credito = 1 euro-centesimo' : '1 credit = 1 euro-cent'}
          </div>
          <div style={{fontSize:9, color:colors.goldAccent, marginTop:4}}>
            {pLang === 'it'
              ? '\u26A1 Voce standard: ~0.5 crediti/msg \u2022 Voce ElevenLabs: ~5 crediti/msg'
              : '\u26A1 Standard voice: ~0.5 credits/msg \u2022 ElevenLabs voice: ~5 credits/msg'}
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
                    ? `linear-gradient(135deg, ${colors.accent1Bg}, ${colors.accent2Bg})`
                    : pkg.starter
                      ? `linear-gradient(135deg, ${colors.accent4Bg}, ${colors.accent2Bg})`
                      : colors.overlayBg,
                  border: isPopular
                    ? `2px solid ${colors.accent1Border}`
                    : pkg.starter
                      ? `1.5px solid ${colors.accent4Border}`
                      : `1px solid ${colors.overlayBorder}`,
                  color:colors.textPrimary, cursor:'pointer', fontFamily:FONT, WebkitTapHighlightColor:'transparent',
                  transition:'all 0.15s', position:'relative', textAlign:'left',
                  display:'block'}}>

                {/* Badge */}
                {(pkg.starter || isPopular || isBig) && (
                  <div style={{position:'absolute', top:-10, right:16, padding:'3px 10px', borderRadius:8,
                    background: pkg.starter
                      ? `linear-gradient(135deg, ${colors.accent4}, ${colors.accent2})`
                      : isPopular
                        ? colors.btnGradient
                        : `linear-gradient(135deg, ${colors.accent3}, ${colors.accent1})`,
                    color:colors.textPrimary, fontSize:9, fontWeight:800, letterSpacing:0.5, textTransform:'uppercase'}}>
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
                        <span style={{fontSize:12, fontWeight:700, color:colors.accent2,
                          padding:'2px 8px', borderRadius:8, background:colors.accent2Bg}}>
                          {pkg.bonus}
                        </span>
                      )}
                    </div>
                    <div style={{fontSize:12, color:colors.textSecondary, marginTop:2}}>{pkg.messages}</div>
                  </div>
                  <div style={{width:40, height:40, borderRadius:12,
                    background: isPopular ? colors.accent1Bg : colors.overlayBg,
                    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
                    <Icon name="zap" size={20} color={isPopular ? colors.accent1 : colors.textSecondary} />
                  </div>
                </div>

                {/* Perks list */}
                <div style={{marginTop:10, paddingLeft:58, display:'flex', flexDirection:'column', gap:4}}>
                  {pkg.perks.map((perkKey, i) => (
                    <div key={i} style={{display:'flex', alignItems:'center', gap:6}}>
                      <span style={{color:colors.accent4, fontSize:10, fontWeight:800}}>{'\u2713'}</span>
                      <span style={{fontSize:11, color:colors.textTertiary}}>{getPerk(pLang, perkKey)}</span>
                    </div>
                  ))}
                  {pkg.topProTrial && (
                    <div style={{display:'flex', alignItems:'center', gap:6, marginTop:2}}>
                      <span style={{fontSize:10, color:colors.goldAccent}}>{'\u2B50'}</span>
                      <span style={{fontSize:11, fontWeight:700, color:colors.goldAccent}}>
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
          background:colors.overlayBg, border:`1px solid ${colors.overlayBorder}`,
          display:'flex', alignItems:'center', gap:8}}>
          <Icon name="lock" size={14} color={colors.textSecondary} />
          <div style={{fontSize:10, color:colors.textMuted, lineHeight:1.4}}>
            {getPerk(pLang, 'securePayment')} {'\u2022'} Visa, Mastercard, Apple Pay, Google Pay
          </div>
        </div>

        {status && <div style={S.statusMsg}>{status}</div>}
      </div>
    </div>
  );
}
