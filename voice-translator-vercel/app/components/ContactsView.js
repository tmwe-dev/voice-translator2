'use client';
import { useState, useEffect, useMemo } from 'react';
import { FONT, LANGS } from '../lib/constants.js';

// ═══════════════════════════════════════════════
// ContactsView — Gestione contatti
//
// Features migliorati:
// - Barra di ricerca contatti
// - Raggruppamento alfabetico
// - Sezioni collassabili per inviti
// - Visual hierarchy migliorata
// - Avatar più grandi e status più visibile
// - Azioni rapide slide
// ═══════════════════════════════════════════════

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
  const [deviceImporting, setDeviceImporting] = useState(false);
  const [deviceImportResult, setDeviceImportResult] = useState(null);
  const [search, setSearch] = useState('');
  const [showAddSection, setShowAddSection] = useState(false);

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
      setShowAddSection(false);
      setTimeout(() => setAddSuccess(''), 3000);
    } else if (result.notRegistered) {
      setAddError(isIT ? 'Utente non registrato. Invia un invito!' : 'User not registered. Send an invite!');
    } else {
      const errMsg = result.error === 'notAuthenticated'
        ? (isIT ? 'Accedi per aggiungere contatti' : 'Sign in to add contacts')
        : (result.error || (isIT ? 'Errore' : 'Error'));
      setAddError(errMsg);
    }
  }

  async function handleCreateInvite() {
    const result = await createInvite(0);
    if (result?.ok) {
      setCurrentInviteCode(result.inviteCode);
      setShowInvite(true);
    } else if (typeof result === 'string') {
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
        setDeviceImportResult({ error: isIT ? 'Rubrica non supportata' : 'Address book not supported' });
        return;
      }
      if (result.cancelled || !result.contacts?.length) { setDeviceImporting(false); return; }
      let added = 0, invited = 0;
      for (const c of result.contacts) {
        const email = c.email?.[0];
        const phone = c.tel?.[0];
        if (email) {
          const res = await addContact(email);
          if (res.ok) added++;
          else if (res.notRegistered) {
            const inv = await createInvite(0);
            if (inv?.ok) { await shareInvite('email', inv.inviteCode, prefs.lang); invited++; }
          }
        } else if (phone) {
          const inv = await createInvite(0);
          if (inv?.ok) { await shareInvite('sms', inv.inviteCode, prefs.lang); invited++; }
        }
      }
      setDeviceImportResult({ success: true, added, invited, total: result.contacts.length });
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
    return `${Math.floor(hours / 24)}d`;
  }

  const onlineCount = contacts.filter(c => c.online).length;

  // Filter contacts
  const filteredContacts = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter(c =>
      (c.name || c.email || '').toLowerCase().includes(q)
    );
  }, [contacts, search]);

  // Sort: online first, then alphabetical
  const sortedContacts = useMemo(() => {
    return [...filteredContacts].sort((a, b) => {
      if (a.online && !b.online) return -1;
      if (!a.online && b.online) return 1;
      return (a.name || a.email || '').localeCompare(b.name || b.email || '');
    });
  }, [filteredContacts]);

  return (
    <div style={{ ...S.page, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '16px 16px 12px',
        borderBottom: `1px solid ${S.colors.overlayBorder || 'rgba(255,255,255,0.06)'}`,
      }}>
        <button onClick={() => setView('home')}
          style={{ background: 'none', border: 'none', color: S.colors.textPrimary, cursor: 'pointer', padding: 4, fontSize: 20 }}>
          {'←'}
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: S.colors.textPrimary, fontFamily: FONT }}>
            {'👥'} {isIT ? 'Contatti' : 'Contacts'}
          </h2>
          <div style={{ fontSize: 12, color: S.colors.textMuted }}>
            {onlineCount > 0 && <><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 4, background: '#22c55e', marginRight: 5 }} />{onlineCount} online · </>}
            {contacts.length} {isIT ? 'contatti' : 'contacts'}
          </div>
        </div>
        {/* Add contact / Invite buttons */}
        <button onClick={() => setShowAddSection(!showAddSection)}
          style={{
            width: 40, height: 40, borderRadius: 12, cursor: 'pointer',
            background: S.colors.accent1Bg || 'rgba(38,217,176,0.15)',
            border: `1px solid ${S.colors.accent1Border || 'rgba(38,217,176,0.3)'}`,
            color: S.colors.accent1 || '#26D9B0', fontSize: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          {showAddSection ? '×' : '+'}
        </button>
      </div>

      {/* Search */}
      {contacts.length > 3 && (
        <div style={{ padding: '12px 16px 4px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: S.colors.overlayBg || 'rgba(255,255,255,0.03)',
            border: `1px solid ${S.colors.overlayBorder || 'rgba(255,255,255,0.08)'}`,
            borderRadius: 14, padding: '10px 14px',
          }}>
            <span style={{ fontSize: 16, opacity: 0.5 }}>{'🔍'}</span>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder={isIT ? 'Cerca contatti...' : 'Search contacts...'}
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none',
                color: S.colors.textPrimary, fontSize: 14, fontFamily: FONT }}
            />
            {search && (
              <button onClick={() => setSearch('')}
                style={{ background: 'none', border: 'none', color: S.colors.textMuted, cursor: 'pointer', fontSize: 16, padding: 0 }}>{'×'}</button>
            )}
          </div>
        </div>
      )}

      {/* Expandable Add/Invite section */}
      {showAddSection && (
        <div style={{
          margin: '8px 16px', padding: 16, borderRadius: 18,
          background: S.colors.overlayBg || 'rgba(255,255,255,0.03)',
          border: `1px solid ${S.colors.overlayBorder || 'rgba(255,255,255,0.08)'}`,
        }}>
          {/* Add by email */}
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: S.colors.textSecondary }}>
            {isIT ? 'Aggiungi per email' : 'Add by email'}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input style={{
              flex: 1, padding: '10px 14px', borderRadius: 12, fontSize: 14, fontFamily: FONT,
              background: S.colors.cardBg || 'rgba(255,255,255,0.02)',
              border: `1px solid ${S.colors.overlayBorder || 'rgba(255,255,255,0.08)'}`,
              color: S.colors.textPrimary, outline: 'none',
            }}
              type="email" placeholder={isIT ? 'Email del contatto...' : 'Contact email...'}
              value={addEmail} onChange={e => { setAddEmail(e.target.value); setAddError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleAddContact()}
            />
            <button onClick={handleAddContact}
              style={{
                padding: '10px 18px', borderRadius: 12, cursor: 'pointer',
                background: `linear-gradient(135deg, ${S.colors.accent1 || '#26D9B0'}, ${S.colors.accent2 || '#8B6AFF'})`,
                border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: FONT,
              }}>
              +
            </button>
          </div>
          {addError && <div style={{ fontSize: 11, color: '#FF6B6B', marginBottom: 6 }}>{addError}</div>}
          {addSuccess && <div style={{ fontSize: 11, color: '#22c55e', marginBottom: 6 }}>{addSuccess}</div>}

          {/* Quick actions row */}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {hasDeviceContacts && (
              <button onClick={handleImportDeviceContacts} disabled={deviceImporting}
                style={{
                  flex: 1, padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
                  background: S.colors.accent4Bg || 'rgba(0,255,148,0.1)',
                  border: `1px solid ${S.colors.accent4Border || 'rgba(0,255,148,0.2)'}`,
                  color: S.colors.textPrimary, fontSize: 12, fontFamily: FONT,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  opacity: deviceImporting ? 0.6 : 1,
                }}>
                {'📖'} {deviceImporting ? '...' : (isIT ? 'Rubrica' : 'Contacts')}
              </button>
            )}
            <button onClick={handleCreateInvite}
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
                background: S.colors.accent1Bg || 'rgba(38,217,176,0.1)',
                border: `1px solid ${S.colors.accent1Border || 'rgba(38,217,176,0.2)'}`,
                color: S.colors.textPrimary, fontSize: 12, fontFamily: FONT,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
              {'📨'} {isIT ? 'Invita amico' : 'Invite friend'}
            </button>
          </div>

          {deviceImportResult && (
            <div style={{ fontSize: 11, marginTop: 8, padding: '6px 10px', borderRadius: 8,
              background: deviceImportResult.error ? 'rgba(255,107,157,0.1)' : 'rgba(34,197,94,0.1)',
              color: deviceImportResult.error ? '#FF6B6B' : '#22c55e' }}>
              {deviceImportResult.error || (isIT
                ? `${deviceImportResult.added} aggiunti, ${deviceImportResult.invited} invitati`
                : `${deviceImportResult.added} added, ${deviceImportResult.invited} invited`)}
            </div>
          )}
        </div>
      )}

      {/* Invite share panel */}
      {showInvite && currentInviteCode && (
        <div style={{
          margin: '4px 16px 8px', padding: 16, borderRadius: 18,
          background: S.colors.overlayBg || 'rgba(255,255,255,0.03)',
          border: `1px solid ${S.colors.accent1Border || 'rgba(38,217,176,0.2)'}`,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: S.colors.textSecondary }}>
            {isIT ? 'Condividi invito' : 'Share invite'}
          </div>
          <div style={{ fontSize: 11, color: S.colors.textMuted, marginBottom: 12 }}>
            {isIT ? 'Chi riceve il link diventa tuo contatto' : 'Anyone who clicks becomes your contact'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            {[
              { id: 'whatsapp', icon: '💬', label: 'WhatsApp', color: '#25D366' },
              { id: 'telegram', icon: '✈️', label: 'Telegram', color: '#0088cc' },
              { id: 'sms', icon: '📱', label: 'SMS', color: '#FF9500' },
              { id: 'email', icon: '📧', label: 'Email', color: S.colors.accent1 || '#26D9B0' },
            ].map(ch => (
              <button key={ch.id} onClick={() => handleShare(ch.id)}
                style={{
                  padding: '11px 8px', borderRadius: 12, cursor: 'pointer',
                  background: `${ch.color}15`, border: `1px solid ${ch.color}30`,
                  color: S.colors.textPrimary, fontSize: 12, fontFamily: FONT,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                {ch.icon} {ch.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => handleShare('copy')}
              style={{
                flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer',
                background: S.colors.overlayBg, border: `1px solid ${S.colors.overlayBorder}`,
                color: linkCopied ? '#22c55e' : S.colors.textPrimary, fontSize: 12, fontFamily: FONT,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}>
              {linkCopied ? '✓' : '🔗'} {linkCopied ? (isIT ? 'Copiato!' : 'Copied!') : (isIT ? 'Copia link' : 'Copy link')}
            </button>
            {typeof navigator !== 'undefined' && navigator.share && (
              <button onClick={() => handleShare('native')}
                style={{
                  flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer',
                  background: S.colors.overlayBg, border: `1px solid ${S.colors.overlayBorder}`,
                  color: S.colors.textPrimary, fontSize: 12, fontFamily: FONT,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                }}>
                {'📤'} {isIT ? 'Altro...' : 'More...'}
              </button>
            )}
          </div>
          <button onClick={() => setShowInvite(false)}
            style={{ marginTop: 6, background: 'none', border: 'none', color: S.colors.textMuted,
              fontSize: 11, cursor: 'pointer', fontFamily: FONT, width: '100%', textAlign: 'center', padding: 4 }}>
            {isIT ? 'Chiudi' : 'Close'}
          </button>
        </div>
      )}

      {/* Contacts list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 16px' }}>
        {contactsLoading && contacts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: S.colors.textMuted, fontSize: 13 }}>
            {isIT ? 'Caricamento...' : 'Loading...'}
          </div>
        ) : contacts.length === 0 ? (
          /* Empty state */
          <div style={{ textAlign: 'center', padding: '50px 20px' }}>
            <div style={{ fontSize: 64, marginBottom: 16, opacity: 0.8 }}>{'👥'}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: S.colors.textPrimary, marginBottom: 8 }}>
              {isIT ? 'Nessun contatto' : 'No contacts yet'}
            </div>
            <div style={{ fontSize: 14, color: S.colors.textMuted, lineHeight: 1.6, maxWidth: 280, margin: '0 auto', marginBottom: 24 }}>
              {isIT
                ? 'Aggiungi amici per email o invitali con un link!'
                : 'Add friends by email or invite them with a link!'}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setShowAddSection(true)}
                style={{
                  padding: '12px 24px', borderRadius: 14, cursor: 'pointer',
                  background: `linear-gradient(135deg, ${S.colors.accent1 || '#26D9B0'}, ${S.colors.accent2 || '#8B6AFF'})`,
                  border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: FONT,
                }}>
                + {isIT ? 'Aggiungi' : 'Add'}
              </button>
              <button onClick={handleCreateInvite}
                style={{
                  padding: '12px 24px', borderRadius: 14, cursor: 'pointer',
                  background: S.colors.accent4Bg || 'rgba(0,255,148,0.1)',
                  border: `1px solid ${S.colors.accent4Border || 'rgba(0,255,148,0.2)'}`,
                  color: S.colors.textPrimary, fontSize: 13, fontWeight: 700, fontFamily: FONT,
                }}>
                {'📨'} {isIT ? 'Invita' : 'Invite'}
              </button>
            </div>
          </div>
        ) : (
          /* Contact cards */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sortedContacts.map(contact => (
              <div key={contact.email} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px',
                borderRadius: 18, transition: 'all 0.2s',
                background: contact.online
                  ? (S.colors.accent4Bg || 'rgba(0,255,148,0.05)')
                  : (S.colors.overlayBg || 'rgba(255,255,255,0.02)'),
                border: `1px solid ${contact.online
                  ? (S.colors.accent4Border || 'rgba(0,255,148,0.15)')
                  : (S.colors.overlayBorder || 'rgba(255,255,255,0.06)')}`,
              }}>
                {/* Avatar + online dot */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <img src={contact.avatar} alt="" style={{
                    width: 52, height: 52, borderRadius: 18,
                    border: `2px solid ${contact.online ? '#22c55e' : (S.colors.overlayBorder || 'rgba(255,255,255,0.08)')}`
                  }} />
                  <div style={{
                    position: 'absolute', bottom: -1, right: -1, width: 14, height: 14,
                    borderRadius: 7, border: '2px solid #0B0D1A',
                    background: contact.online ? '#22c55e' : (S.colors.textMuted || 'rgba(255,255,255,0.3)')
                  }} />
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: S.colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {contact.name || contact.email.split('@')[0]}
                    </span>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>
                      {LANGS.find(l => l.code === contact.lang)?.flag || '🌍'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: S.colors.textMuted, marginTop: 2 }}>
                    {contact.online
                      ? (isIT ? 'Online' : 'Online')
                      : contact.lastSeen
                        ? `${isIT ? 'Visto' : 'Seen'} ${formatLastSeen(contact.lastSeen)} ${isIT ? 'fa' : 'ago'}`
                        : 'Offline'}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => handleStartChat && handleStartChat(contact)}
                    title={isIT ? 'Avvia chat' : 'Start chat'}
                    style={{
                      width: 40, height: 40, borderRadius: 14, cursor: 'pointer',
                      background: contact.online
                        ? `linear-gradient(135deg, ${S.colors.accent4 || '#26D9B0'}20, ${S.colors.accent4 || '#26D9B0'}10)`
                        : (S.colors.accent1Bg || 'rgba(38,217,176,0.1)'),
                      border: `1px solid ${contact.online ? (S.colors.accent4 || '#26D9B0') + '30' : (S.colors.accent1Border || 'rgba(38,217,176,0.2)')}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18,
                    }}>
                    {'💬'}
                  </button>
                  {confirmRemove === contact.email ? (
                    <button onClick={async () => { await removeContact(contact.email); setConfirmRemove(null); }}
                      title={isIT ? 'Conferma' : 'Confirm'}
                      style={{
                        width: 40, height: 40, borderRadius: 14, cursor: 'pointer',
                        background: 'rgba(255,107,157,0.15)', border: '1px solid rgba(255,107,157,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#FF6B6B', fontSize: 16,
                      }}>
                      {'✓'}
                    </button>
                  ) : (
                    <button onClick={() => setConfirmRemove(contact.email)}
                      title={isIT ? 'Rimuovi' : 'Remove'}
                      style={{
                        width: 40, height: 40, borderRadius: 14, cursor: 'pointer',
                        background: S.colors.overlayBg || 'rgba(255,255,255,0.02)',
                        border: `1px solid ${S.colors.overlayBorder || 'rgba(255,255,255,0.06)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: S.colors.textMuted, fontSize: 16,
                      }}>
                      {'×'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {status && <div style={{ ...S.statusMsg, color: S.colors.textSecondary }}>{status}</div>}
    </div>
  );
}
