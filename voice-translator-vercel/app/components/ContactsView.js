'use client';
import { useState, useEffect } from 'react';
import { FONT, LANGS } from '../lib/constants.js';
import Icon from './Icon.js';

export default function ContactsView({
  L, S, prefs, contacts, contactsLoading, inviteCode, creditBalance = 0,
  fetchContacts, addContact, removeContact, createInvite, shareInvite,
  acceptInvite, startPolling, handleStartChat, setView, status, theme,
  pickDeviceContacts, hasDeviceContacts
}) {
  const isIT = L('createRoom') === 'Crea Stanza';
  const [addEmail, setAddEmail] = useState('');
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [currentInviteCode, setCurrentInviteCode] = useState(inviteCode);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [giftAmount, setGiftAmount] = useState(0);
  const [giftError, setGiftError] = useState('');
  const [inviteGiftAmount, setInviteGiftAmount] = useState(0); // amount attached to current invite
  const [deviceImporting, setDeviceImporting] = useState(false);
  const [deviceImportResult, setDeviceImportResult] = useState(null);
  const maxGift = Math.floor(creditBalance * 0.5);

  // Start polling contacts when view mounts
  useEffect(() => {
    const cleanup = startPolling();
    return cleanup;
  }, [startPolling]);

  async function handleAddContact() {
    if (!addEmail.trim() || !addEmail.includes('@')) {
      setAddError(isIT ? 'Inserisci un\'email valida' : 'Enter a valid email');
      return;
    }
    setAddError('');
    setAddSuccess('');
    const result = await addContact(addEmail.trim());
    if (result.ok) {
      setAddSuccess(isIT ? `${result.contact.name || addEmail} aggiunto!` : `${result.contact.name || addEmail} added!`);
      setAddEmail('');
      setTimeout(() => setAddSuccess(''), 3000);
    } else if (result.notRegistered) {
      setAddError(isIT ? 'Utente non registrato. Invia un invito!' : 'User not registered. Send an invite!');
    } else {
      setAddError(result.error || 'Error');
    }
  }

  async function handleCreateInvite() {
    setGiftError('');
    const result = await createInvite(giftAmount > 0 ? giftAmount : 0);
    if (result?.ok) {
      setCurrentInviteCode(result.inviteCode);
      setInviteGiftAmount(giftAmount);
      setShowInvite(true);
      setGiftAmount(0);
    } else if (result?.error) {
      setGiftError(result.error);
    } else if (typeof result === 'string') {
      // backward compat: old createInvite returned string
      setCurrentInviteCode(result);
      setShowInvite(true);
    }
  }

  async function handleShare(channel) {
    const code = currentInviteCode || inviteCode;
    if (!code) return;
    const result = await shareInvite(channel, code, prefs.lang);
    if (result?.copied) {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  }

  async function handleImportDeviceContacts() {
    if (!pickDeviceContacts) return;
    setDeviceImporting(true);
    setDeviceImportResult(null);
    try {
      const result = await pickDeviceContacts();
      if (!result.supported) {
        setDeviceImportResult({ error: isIT ? 'Rubrica non supportata su questo browser' : 'Address book not supported on this browser' });
        return;
      }
      if (result.cancelled || !result.contacts?.length) {
        setDeviceImporting(false);
        return;
      }
      let added = 0, invited = 0, failed = 0;
      for (const c of result.contacts) {
        const email = c.email?.[0];
        const phone = c.tel?.[0];
        const name = c.name?.[0] || '';
        if (email) {
          const res = await addContact(email);
          if (res.ok) { added++; }
          else if (res.notRegistered) {
            // Create invite and share via email
            const inv = await createInvite(0);
            if (inv?.ok) {
              await shareInvite('email', inv.inviteCode, prefs.lang);
              invited++;
            }
          } else { failed++; }
        } else if (phone) {
          // No email — share via SMS
          const inv = await createInvite(0);
          if (inv?.ok) {
            await shareInvite('sms', inv.inviteCode, prefs.lang);
            invited++;
          }
        }
      }
      setDeviceImportResult({
        success: true,
        added,
        invited,
        total: result.contacts.length
      });
    } catch (e) {
      setDeviceImportResult({ error: e.message });
    } finally {
      setDeviceImporting(false);
    }
  }

  function formatLastSeen(timestamp) {
    if (!timestamp) return '';
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return isIT ? 'ora' : 'now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }

  const onlineCount = contacts.filter(c => c.online).length;

  return (
    <div style={S.page}>
      <div style={S.scrollCenter}>
        {/* Header */}
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', maxWidth:400, marginBottom:16}}>
          <button style={{background:'none', border:'none', color:S.colors.textMuted, cursor:'pointer', padding:8, fontFamily:FONT}}
            onClick={() => setView('home')}>
            <Icon name="chevDown" size={20} color={S.colors.textMuted} style={{transform:'rotate(90deg)'}} />
          </button>
          <div style={{fontSize:18, fontWeight:800, color:S.colors.textPrimary}}>
            {isIT ? 'Contatti' : 'Contacts'}
          </div>
          <div style={{width:36}} />
        </div>

        {/* Online count badge */}
        {contacts.length > 0 && (
          <div style={{fontSize:12, color:S.colors.textMuted, marginBottom:16}}>
            <span style={{display:'inline-block', width:8, height:8, borderRadius:4, background:S.colors.onlineColor, marginRight:6}} />
            {onlineCount} {isIT ? 'online' : 'online'}
            {' · '}
            {contacts.length} {isIT ? 'contatti' : 'contacts'}
          </div>
        )}

        {/* Add contact section */}
        <div style={{...S.card, marginBottom:16, width:'100%', maxWidth:400}}>
          <div style={{fontSize:13, fontWeight:700, marginBottom:10, color:S.colors.textSecondary}}>
            {isIT ? 'Aggiungi contatto' : 'Add contact'}
          </div>
          <div style={{display:'flex', gap:8}}>
            <input
              style={{...S.input, flex:1, fontSize:14}}
              type="email"
              placeholder={isIT ? 'Email del contatto...' : 'Contact email...'}
              value={addEmail}
              onChange={e => { setAddEmail(e.target.value); setAddError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleAddContact()}
            />
            <button style={{...S.btn, padding:'10px 16px', fontSize:13, whiteSpace:'nowrap'}}
              onClick={handleAddContact}>
              +
            </button>
          </div>
          {addError && (
            <div style={{fontSize:11, color:S.colors.accent3, marginTop:6}}>{addError}</div>
          )}
          {addSuccess && (
            <div style={{fontSize:11, color:S.colors.onlineColor, marginTop:6}}>{addSuccess}</div>
          )}

          {/* Import from device address book */}
          <div style={{marginTop:12}}>
            {hasDeviceContacts ? (
              <button style={{
                width:'100%', padding:'10px 14px', borderRadius:12,
                background:`linear-gradient(135deg, ${S.colors.accent2Bg || S.colors.accent1Bg}, ${S.colors.accent4Bg || S.colors.accent1Bg})`,
                border:`1px solid ${S.colors.accent2Border || S.colors.accent1Border}`,
                color:S.colors.textPrimary, fontSize:13,
                fontFamily:FONT, cursor:'pointer', display:'flex', alignItems:'center',
                justifyContent:'center', gap:8, opacity: deviceImporting ? 0.6 : 1
              }}
                onClick={handleImportDeviceContacts}
                disabled={deviceImporting}>
                <span style={{fontSize:16}}>{'📖'}</span>
                {deviceImporting
                  ? (isIT ? 'Importazione...' : 'Importing...')
                  : (isIT ? 'Importa dalla Rubrica' : 'Import from Contacts')}
              </button>
            ) : (
              <button style={{
                width:'100%', padding:'10px 14px', borderRadius:12,
                background:S.colors.overlayBg, border:`1px solid ${S.colors.overlayBorder}`,
                color:S.colors.textPrimary, fontSize:13,
                fontFamily:FONT, cursor:'pointer', display:'flex', alignItems:'center',
                justifyContent:'center', gap:8
              }}
                onClick={async () => {
                  const inv = await createInvite(0);
                  if (inv?.ok) {
                    setCurrentInviteCode(inv.inviteCode);
                    setShowInvite(true);
                  }
                }}>
                <span style={{fontSize:16}}>{'🔗'}</span>
                {isIT ? 'Condividi Link di Invito' : 'Share Invite Link'}
              </button>
            )}
            {deviceImportResult && (
              <div style={{fontSize:11, marginTop:6, padding:'6px 10px', borderRadius:8,
                background: deviceImportResult.error ? S.colors.accent3Bg : S.colors.accent4Bg,
                color: deviceImportResult.error ? S.colors.accent3 : S.colors.onlineColor}}>
                {deviceImportResult.error
                  ? deviceImportResult.error
                  : (isIT
                    ? `${deviceImportResult.added} aggiunti, ${deviceImportResult.invited} invitati su ${deviceImportResult.total} contatti`
                    : `${deviceImportResult.added} added, ${deviceImportResult.invited} invited out of ${deviceImportResult.total} contacts`)}
              </div>
            )}
          </div>

          {/* Gift credits section (only if user has credits) */}
          {creditBalance >= 100 && (
            <div style={{marginTop:12, padding:'10px 12px', borderRadius:10,
              background:S.colors.accent4Bg, border:`1px solid ${S.colors.accent4Border}`}}>
              <div style={{fontSize:12, fontWeight:700, color:S.colors.accent4, marginBottom:6, display:'flex', alignItems:'center', gap:4}}>
                {'🎁'} {isIT ? 'Regala crediti con l\'invito' : 'Gift credits with invite'}
              </div>
              <div style={{display:'flex', alignItems:'center', gap:8}}>
                <input
                  type="range"
                  min={0} max={maxGift} step={50}
                  value={giftAmount}
                  onChange={e => setGiftAmount(parseInt(e.target.value))}
                  style={{flex:1, accentColor:S.colors.accent4}}
                />
                <span style={{fontSize:13, fontWeight:700, color:S.colors.textPrimary, minWidth:50, textAlign:'right'}}>
                  {giftAmount > 0 ? `€${(giftAmount / 100).toFixed(2)}` : '—'}
                </span>
              </div>
              {giftAmount > 0 && (
                <div style={{fontSize:10, color:S.colors.textMuted, marginTop:4}}>
                  {isIT
                    ? `Regali ${giftAmount} crediti. Il tuo saldo dopo: ${creditBalance - giftAmount}`
                    : `Gifting ${giftAmount} credits. Your balance after: ${creditBalance - giftAmount}`}
                </div>
              )}
              {giftError && (
                <div style={{fontSize:11, color:S.colors.accent3, marginTop:4}}>{giftError}</div>
              )}
            </div>
          )}

          {/* Invite button */}
          <button style={{
            width:'100%', marginTop:12, padding:'10px 14px', borderRadius:12,
            background: giftAmount > 0
              ? `linear-gradient(135deg, ${S.colors.accent4Bg}, ${S.colors.accent1Bg})`
              : `linear-gradient(135deg, ${S.colors.accent1Bg}, ${S.colors.accent2Bg}33)`,
            border:`1px solid ${giftAmount > 0 ? S.colors.accent4Border : S.colors.accent1Border}`,
            color:S.colors.textPrimary, fontSize:13,
            fontFamily:FONT, cursor:'pointer', display:'flex', alignItems:'center',
            justifyContent:'center', gap:8
          }}
            onClick={handleCreateInvite}>
            <span style={{fontSize:16}}>{giftAmount > 0 ? '🎁' : '📨'}</span>
            {giftAmount > 0
              ? (isIT ? `Invita con regalo (€${(giftAmount/100).toFixed(2)})` : `Invite with gift (€${(giftAmount/100).toFixed(2)})`)
              : (isIT ? 'Invita un amico' : 'Invite a friend')}
          </button>
        </div>

        {/* Invite sharing panel */}
        {showInvite && currentInviteCode && (
          <div style={{...S.card, marginBottom:16, width:'100%', maxWidth:400}}>
            <div style={{fontSize:13, fontWeight:700, marginBottom:10, color:S.colors.textSecondary}}>
              {isIT ? 'Condividi invito' : 'Share invite'}
            </div>
            <div style={{fontSize:11, color:S.colors.textMuted, marginBottom:12}}>
              {inviteGiftAmount > 0
                ? (isIT
                    ? `Chi accetta riceverà €${(inviteGiftAmount/100).toFixed(2)} di crediti in regalo!`
                    : `Recipient will receive €${(inviteGiftAmount/100).toFixed(2)} in gift credits!`)
                : (isIT
                    ? 'Chi riceve il link diventerà automaticamente tuo contatto'
                    : 'Anyone who clicks this link will become your contact')}
            </div>

            {/* Share buttons grid */}
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12}}>
              {[
                { id:'whatsapp', icon:'💬', label:'WhatsApp', color:'#25D366' },
                { id:'telegram', icon:'✈️', label:'Telegram', color:'#0088cc' },
                { id:'sms', icon:'📱', label:'SMS', color:'#FF9500' },
                { id:'email', icon:'📧', label:'Email', color:S.colors.accent1 },
              ].map(ch => {
                const bgColor = ch.id === 'email' ? S.colors.accent1Bg : `${ch.color}26`;
                const borderColor = ch.id === 'email' ? S.colors.accent1Border : `${ch.color}4d`;
                return (
                <button key={ch.id} style={{
                  padding:'12px 8px', borderRadius:12, cursor:'pointer',
                  background:bgColor, border:`1px solid ${borderColor}`,
                  color:S.colors.textPrimary, fontSize:13, fontFamily:FONT,
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6
                }}
                  onClick={() => handleShare(ch.id)}>
                  <span>{ch.icon}</span>
                  <span>{ch.label}</span>
                </button>
              );
              })}
            </div>

            {/* Copy link & native share */}
            <div style={{display:'flex', gap:8}}>
              <button style={{
                flex:1, padding:'10px 12px', borderRadius:10, cursor:'pointer',
                background:S.colors.overlayBg, border:`1px solid ${S.colors.overlayBorder}`,
                color: linkCopied ? S.colors.onlineColor : S.colors.textPrimary, fontSize:12, fontFamily:FONT,
                display:'flex', alignItems:'center', justifyContent:'center', gap:6
              }}
                onClick={() => handleShare('copy')}>
                {linkCopied ? '✓' : '🔗'} {linkCopied ? (isIT ? 'Copiato!' : 'Copied!') : (isIT ? 'Copia link' : 'Copy link')}
              </button>
              {typeof navigator !== 'undefined' && navigator.share && (
                <button style={{
                  flex:1, padding:'10px 12px', borderRadius:10, cursor:'pointer',
                  background:S.colors.overlayBg, border:`1px solid ${S.colors.overlayBorder}`,
                  color:S.colors.textPrimary, fontSize:12, fontFamily:FONT,
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6
                }}
                  onClick={() => handleShare('native')}>
                  {'📤'} {isIT ? 'Altro...' : 'More...'}
                </button>
              )}
            </div>

            <button style={{marginTop:8, background:'none', border:'none', color:S.colors.textMuted,
              fontSize:11, cursor:'pointer', fontFamily:FONT, padding:6, width:'100%', textAlign:'center'}}
              onClick={() => setShowInvite(false)}>
              {isIT ? 'Chiudi' : 'Close'}
            </button>
          </div>
        )}

        {/* Contacts list */}
        {contactsLoading && contacts.length === 0 ? (
          <div style={{fontSize:13, color:S.colors.textMuted, padding:20}}>
            {isIT ? 'Caricamento...' : 'Loading...'}
          </div>
        ) : contacts.length === 0 ? (
          <div style={{textAlign:'center', padding:'30px 20px'}}>
            <div style={{fontSize:40, marginBottom:12}}>{'👥'}</div>
            <div style={{fontSize:14, color:S.colors.textSecondary, marginBottom:6}}>
              {isIT ? 'Nessun contatto ancora' : 'No contacts yet'}
            </div>
            <div style={{fontSize:12, color:S.colors.textMuted}}>
              {isIT
                ? 'Aggiungi contatti per email o invia un invito'
                : 'Add contacts by email or send an invite'}
            </div>
          </div>
        ) : (
          <div style={{width:'100%', maxWidth:400}}>
            {contacts.map(contact => (
              <div key={contact.email} style={{
                display:'flex', alignItems:'center', gap:12, padding:'12px 14px',
                borderRadius:14, marginBottom:6,
                background: contact.online ? S.colors.accent4Bg : S.colors.overlayBg,
                border: `1px solid ${contact.online ? S.colors.accent4Border : S.colors.overlayBorder}`,
              }}>
                {/* Avatar with online indicator */}
                <div style={{position:'relative', flexShrink:0}}>
                  <img src={contact.avatar} alt="" style={{
                    width:72, height:72, borderRadius:20,
                    border: `2px solid ${contact.online ? S.colors.onlineColor : S.colors.overlayBorder}`
                  }} />
                  <div style={{
                    position:'absolute', bottom:-1, right:-1, width:14, height:14,
                    borderRadius:7, border:`2px solid ${S.colors.cardBg}`,
                    background: contact.online ? S.colors.onlineColor : S.colors.textMuted
                  }} />
                </div>

                {/* Info */}
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:14, fontWeight:700, color:S.colors.textPrimary, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                    {contact.name || contact.email.split('@')[0]}
                  </div>
                  <div style={{fontSize:11, color:S.colors.textMuted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                    {contact.online
                      ? (isIT ? '🟢 Online' : '🟢 Online')
                      : contact.lastSeen
                        ? `${isIT ? 'Visto' : 'Seen'} ${formatLastSeen(contact.lastSeen)} ${isIT ? 'fa' : 'ago'}`
                        : (isIT ? 'Offline' : 'Offline')}
                  </div>
                </div>

                {/* Language flag */}
                <div style={{fontSize:16, flexShrink:0}}>
                  {LANGS.find(l => l.code === contact.lang)?.flag || '🌍'}
                </div>

                {/* Action buttons */}
                <div style={{display:'flex', gap:6, flexShrink:0}}>
                  {/* Start chat button */}
                  <button style={{
                    width:36, height:36, borderRadius:12, cursor:'pointer',
                    background: contact.online ? S.colors.accent4Bg : S.colors.accent1Bg,
                    border: `1px solid ${contact.online ? S.colors.accent4Border : S.colors.accent1Border}`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    color: contact.online ? S.colors.onlineColor : S.colors.accent1, fontSize:16
                  }}
                    onClick={() => handleStartChat && handleStartChat(contact)}
                    title={isIT ? 'Avvia chat' : 'Start chat'}>
                    {'💬'}
                  </button>

                  {/* Remove button (with confirm) */}
                  {confirmRemove === contact.email ? (
                    <button style={{
                      width:36, height:36, borderRadius:12, cursor:'pointer',
                      background:S.colors.accent3Bg, border:`1px solid ${S.colors.accent3Border}`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      color:S.colors.accent3, fontSize:14
                    }}
                      onClick={async () => {
                        await removeContact(contact.email);
                        setConfirmRemove(null);
                      }}
                      title={isIT ? 'Conferma rimozione' : 'Confirm removal'}>
                      {'✓'}
                    </button>
                  ) : (
                    <button style={{
                      width:36, height:36, borderRadius:12, cursor:'pointer',
                      background:S.colors.overlayBg, border:`1px solid ${S.colors.overlayBorder}`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      color:S.colors.textMuted, fontSize:14
                    }}
                      onClick={() => setConfirmRemove(contact.email)}
                      title={isIT ? 'Rimuovi' : 'Remove'}>
                      {'×'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {status && <div style={{...S.statusMsg, color:S.colors.textSecondary}}>{status}</div>}
      </div>
    </div>
  );
}
