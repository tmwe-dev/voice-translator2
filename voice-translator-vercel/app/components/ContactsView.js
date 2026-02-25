'use client';
import { useState, useEffect } from 'react';
import { FONT, LANGS } from '../lib/constants.js';
import Icon from './Icon.js';

export default function ContactsView({
  L, S, prefs, contacts, contactsLoading, inviteCode,
  fetchContacts, addContact, removeContact, createInvite, shareInvite,
  acceptInvite, startPolling, handleStartChat, setView, status, theme
}) {
  const isIT = L('createRoom') === 'Crea Stanza';
  const [addEmail, setAddEmail] = useState('');
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [currentInviteCode, setCurrentInviteCode] = useState(inviteCode);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);

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
    const code = await createInvite();
    if (code) {
      setCurrentInviteCode(code);
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
          <button style={{background:'none', border:'none', color:'rgba(255,255,255,0.5)', cursor:'pointer', padding:8, fontFamily:FONT}}
            onClick={() => setView('home')}>
            <Icon name="chevDown" size={20} color="rgba(255,255,255,0.5)" style={{transform:'rotate(90deg)'}} />
          </button>
          <div style={{fontSize:18, fontWeight:800, color:'#fff'}}>
            {isIT ? 'Contatti' : 'Contacts'}
          </div>
          <div style={{width:36}} />
        </div>

        {/* Online count badge */}
        {contacts.length > 0 && (
          <div style={{fontSize:12, color:'rgba(255,255,255,0.4)', marginBottom:16}}>
            <span style={{display:'inline-block', width:8, height:8, borderRadius:4, background:'#00FF94', marginRight:6}} />
            {onlineCount} {isIT ? 'online' : 'online'}
            {' · '}
            {contacts.length} {isIT ? 'contatti' : 'contacts'}
          </div>
        )}

        {/* Add contact section */}
        <div style={{...S.card, marginBottom:16, width:'100%', maxWidth:400}}>
          <div style={{fontSize:13, fontWeight:700, marginBottom:10, color:'rgba(255,255,255,0.7)'}}>
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
            <div style={{fontSize:11, color:'#f5576c', marginTop:6}}>{addError}</div>
          )}
          {addSuccess && (
            <div style={{fontSize:11, color:'#00FF94', marginTop:6}}>{addSuccess}</div>
          )}

          {/* Invite button */}
          <button style={{
            width:'100%', marginTop:12, padding:'10px 14px', borderRadius:12,
            background:'linear-gradient(135deg, rgba(108,99,255,0.15), rgba(0,210,255,0.08))',
            border:'1px solid rgba(108,99,255,0.25)', color:'#fff', fontSize:13,
            fontFamily:FONT, cursor:'pointer', display:'flex', alignItems:'center',
            justifyContent:'center', gap:8
          }}
            onClick={handleCreateInvite}>
            <span style={{fontSize:16}}>{'📨'}</span>
            {isIT ? 'Invita un amico' : 'Invite a friend'}
          </button>
        </div>

        {/* Invite sharing panel */}
        {showInvite && currentInviteCode && (
          <div style={{...S.card, marginBottom:16, width:'100%', maxWidth:400}}>
            <div style={{fontSize:13, fontWeight:700, marginBottom:10, color:'rgba(255,255,255,0.7)'}}>
              {isIT ? 'Condividi invito' : 'Share invite'}
            </div>
            <div style={{fontSize:11, color:'rgba(255,255,255,0.4)', marginBottom:12}}>
              {isIT
                ? 'Chi riceve il link diventerà automaticamente tuo contatto'
                : 'Anyone who clicks this link will become your contact'}
            </div>

            {/* Share buttons grid */}
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12}}>
              {[
                { id:'whatsapp', icon:'💬', label:'WhatsApp', color:'#25D366' },
                { id:'telegram', icon:'✈️', label:'Telegram', color:'#0088cc' },
                { id:'sms', icon:'📱', label:'SMS', color:'#FF9500' },
                { id:'email', icon:'📧', label:'Email', color:'#6C63FF' },
              ].map(ch => (
                <button key={ch.id} style={{
                  padding:'12px 8px', borderRadius:12, cursor:'pointer',
                  background:`${ch.color}15`, border:`1px solid ${ch.color}30`,
                  color:'#fff', fontSize:13, fontFamily:FONT,
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6
                }}
                  onClick={() => handleShare(ch.id)}>
                  <span>{ch.icon}</span>
                  <span>{ch.label}</span>
                </button>
              ))}
            </div>

            {/* Copy link & native share */}
            <div style={{display:'flex', gap:8}}>
              <button style={{
                flex:1, padding:'10px 12px', borderRadius:10, cursor:'pointer',
                background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)',
                color: linkCopied ? '#00FF94' : '#fff', fontSize:12, fontFamily:FONT,
                display:'flex', alignItems:'center', justifyContent:'center', gap:6
              }}
                onClick={() => handleShare('copy')}>
                {linkCopied ? '✓' : '🔗'} {linkCopied ? (isIT ? 'Copiato!' : 'Copied!') : (isIT ? 'Copia link' : 'Copy link')}
              </button>
              {typeof navigator !== 'undefined' && navigator.share && (
                <button style={{
                  flex:1, padding:'10px 12px', borderRadius:10, cursor:'pointer',
                  background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)',
                  color:'#fff', fontSize:12, fontFamily:FONT,
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6
                }}
                  onClick={() => handleShare('native')}>
                  {'📤'} {isIT ? 'Altro...' : 'More...'}
                </button>
              )}
            </div>

            <button style={{marginTop:8, background:'none', border:'none', color:'rgba(255,255,255,0.3)',
              fontSize:11, cursor:'pointer', fontFamily:FONT, padding:6, width:'100%', textAlign:'center'}}
              onClick={() => setShowInvite(false)}>
              {isIT ? 'Chiudi' : 'Close'}
            </button>
          </div>
        )}

        {/* Contacts list */}
        {contactsLoading && contacts.length === 0 ? (
          <div style={{fontSize:13, color:'rgba(255,255,255,0.3)', padding:20}}>
            {isIT ? 'Caricamento...' : 'Loading...'}
          </div>
        ) : contacts.length === 0 ? (
          <div style={{textAlign:'center', padding:'30px 20px'}}>
            <div style={{fontSize:40, marginBottom:12}}>{'👥'}</div>
            <div style={{fontSize:14, color:'rgba(255,255,255,0.5)', marginBottom:6}}>
              {isIT ? 'Nessun contatto ancora' : 'No contacts yet'}
            </div>
            <div style={{fontSize:12, color:'rgba(255,255,255,0.3)'}}>
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
                background: contact.online ? 'rgba(0,255,148,0.04)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${contact.online ? 'rgba(0,255,148,0.12)' : 'rgba(255,255,255,0.06)'}`,
              }}>
                {/* Avatar with online indicator */}
                <div style={{position:'relative', flexShrink:0}}>
                  <img src={contact.avatar} alt="" style={{
                    width:44, height:44, borderRadius:14,
                    border: `2px solid ${contact.online ? '#00FF94' : 'rgba(255,255,255,0.1)'}`
                  }} />
                  <div style={{
                    position:'absolute', bottom:-1, right:-1, width:14, height:14,
                    borderRadius:7, border:'2px solid #0B0D1A',
                    background: contact.online ? '#00FF94' : '#666'
                  }} />
                </div>

                {/* Info */}
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:14, fontWeight:700, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                    {contact.name || contact.email.split('@')[0]}
                  </div>
                  <div style={{fontSize:11, color:'rgba(255,255,255,0.35)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
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
                    background: contact.online ? 'rgba(0,255,148,0.15)' : 'rgba(108,99,255,0.12)',
                    border: `1px solid ${contact.online ? 'rgba(0,255,148,0.3)' : 'rgba(108,99,255,0.2)'}`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    color: contact.online ? '#00FF94' : '#6C63FF', fontSize:16
                  }}
                    onClick={() => handleStartChat && handleStartChat(contact)}
                    title={isIT ? 'Avvia chat' : 'Start chat'}>
                    {'💬'}
                  </button>

                  {/* Remove button (with confirm) */}
                  {confirmRemove === contact.email ? (
                    <button style={{
                      width:36, height:36, borderRadius:12, cursor:'pointer',
                      background:'rgba(245,87,108,0.15)', border:'1px solid rgba(245,87,108,0.3)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      color:'#f5576c', fontSize:14
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
                      background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      color:'rgba(255,255,255,0.25)', fontSize:14
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

        {status && <div style={S.statusMsg}>{status}</div>}
      </div>
    </div>
  );
}
