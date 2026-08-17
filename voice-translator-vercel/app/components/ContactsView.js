'use client';
import { useState, useEffect, useMemo } from 'react';
import { FONT, LANGS } from '../lib/constants.js';
import getStyles from '../lib/styles.js';
import PageHeader from './ui/PageHeader.js';
import { PALETTE } from '../lib/palette.js';
import { useApp } from '../contexts/AppContext.js';

// ═══════════════════════════════════════════════
// ContactsView — Redesigned with glassmorphism
//
// Search, online-first sort, invite share panel,
// device import, remove confirm, ambient orb.
//
// ── b.138 · la rubrica parlava italiano a tutti ──
//
// Ogni testo di questa pagina era cablato in italiano: "Nessun
// contatto", "Cerca contatti...", "Visto 5m fa", perfino l'errore
// "Inserisci un'email valida". Chi aveva l'interfaccia in tedesco o
// in arabo vedeva la rubrica in italiano, e con l'arabo il risultato
// era anche illeggibile per direzione del testo. Ora passa tutto da
// L(), che segue prefs.uiLang come nel resto dell'app.
// ═══════════════════════════════════════════════

export default function ContactsView({
  contacts, contactsLoading, inviteCode, creditBalance = 0,
  fetchContacts, addContact, removeContact, createInvite, shareInvite,
  acceptInvite, startPolling, handleStartChat,
  pickDeviceContacts, hasDeviceContacts
}) {
  const { L, S, prefs, setView, status, theme } = useApp();
  const _S = getStyles(theme);
  const col = _S.colors || {};
  const C = {
    bg: col.bg || '#09090b',
    textPrimary: col.textPrimary || '#fafafa',
    textSecondary: col.textSecondary || 'rgba(250,250,250,0.90)',
    textMuted: col.textMuted || 'rgba(250,250,250,0.60)',
    card: col.glassCard || 'rgba(17,17,19,0.65)',
    cardBorder: col.cardBorder || 'rgba(250,250,250,0.05)',
    input: col.inputBg || 'rgba(17,17,19,0.6)',
    inputBorder: col.inputBorder || 'rgba(250,250,250,0.07)',
    accent: col.accent1 || PALETTE.purple,
    purple: col.accent2 || PALETTE.cyan,
    red: col.accent3 || PALETTE.red,
    green: col.onlineColor || col.accent4 || PALETTE.green,
    headerBg: col.headerBg || 'rgba(9,9,11,0.85)',
    headerBorder: col.headerBorder || 'rgba(250,250,250,0.04)',
  };

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

  useEffect(() => { const cleanup = startPolling(); return cleanup; }, [startPolling]);

  async function handleAddContact() {
    if (!addEmail.trim() || !addEmail.includes('@')) { setAddError(L('invalidEmail')); return; }
    setAddError(''); setAddSuccess('');
    const result = await addContact(addEmail.trim());
    if (result.ok) {
      setAddSuccess(`${result.contact.name || addEmail} ${L('contactAddedOk')}`);
      setAddEmail(''); setShowAddSection(false);
      setTimeout(() => setAddSuccess(''), 3000);
    } else if (result.notRegistered) {
      setAddError(L('userNotRegistered'));
    } else {
      setAddError(result.error === 'notAuthenticated' ? L('signInToAddContacts') : (result.error || L('genericError')));
    }
  }

  async function handleCreateInvite() {
    const result = await createInvite(0);
    if (result?.ok) { setCurrentInviteCode(result.inviteCode); setShowInvite(true); }
    else if (typeof result === 'string') { setCurrentInviteCode(result); setShowInvite(true); }
  }

  async function handleShare(channel) {
    const code = currentInviteCode || inviteCode;
    if (!code) return;
    const result = await shareInvite(channel, code, prefs.lang);
    if (result?.copied) { setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }
  }

  async function handleImportDeviceContacts() {
    if (!pickDeviceContacts) return;
    setDeviceImporting(true); setDeviceImportResult(null);
    try {
      const result = await pickDeviceContacts();
      if (!result.supported) { setDeviceImportResult({ error: L('addressBookUnsupported') }); return; }
      if (result.cancelled || !result.contacts?.length) { setDeviceImporting(false); return; }
      let added = 0, invited = 0;
      for (const c of result.contacts) {
        try {
          const email = c.email?.[0];
          const phone = c.tel?.[0];
          if (email) {
            const res = await addContact(email);
            if (res.ok) added++;
            else if (res.notRegistered) { const inv = await createInvite(0); if (inv?.ok) { await shareInvite('email', inv.inviteCode, prefs.lang); invited++; } }
          } else if (phone) {
            const inv = await createInvite(0);
            if (inv?.ok) { await shareInvite('sms', inv.inviteCode, prefs.lang); invited++; }
          }
          await new Promise(r => setTimeout(r, 100)); // Rate limit
        } catch (err) {
          console.warn('[Contacts] Import failed for', c, err);
        }
      }
      setDeviceImportResult({ success: true, added, invited, total: result.contacts.length });
    } catch (e) { setDeviceImportResult({ error: e.message }); }
    finally { setDeviceImporting(false); }
  }

  function formatLastSeen(timestamp) {
    if (!timestamp) return '';
    const mins = Math.floor((Date.now() - timestamp) / 60000);
    if (mins < 1) return L('timeNow');
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  }

  const onlineCount = contacts.filter(c => c.online).length;

  const filteredContacts = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter(c => (c.name || c.email || '').toLowerCase().includes(q));
  }, [contacts, search]);

  const sortedContacts = useMemo(() => {
    return [...filteredContacts].sort((a, b) => {
      if (a.online && !b.online) return -1;
      if (!a.online && b.online) return 1;
      return (a.name || a.email || '').localeCompare(b.name || b.email || '');
    });
  }, [filteredContacts]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100dvh',
      background: C.bg, fontFamily: FONT, position: 'relative', overflow: 'hidden',
    }}>
      {/* Ambient orb */}
      <div style={{
        position: 'absolute', top: '-15%', left: '-25%', width: '60vw', height: '60vw',
        borderRadius: '50%', background: `radial-gradient(circle, ${C.green}08 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* ═══ HEADER ═══ */}
      <PageHeader
        title={L('contactsRow')}
        subtitle={`${contacts.length} ${L('contactsCount')}${onlineCount > 0 ? ` · ${onlineCount} ${L('onlineWord').toLowerCase()}` : ''}`}
        onBack={() => setView('settings')}
        S={{ colors: C }}
        rightAction={
          <button onClick={() => setShowAddSection(!showAddSection)} aria-label={showAddSection ? L('closeWord') : L('addContactAria')} style={{
            width: 38, height: 38, borderRadius: 12, cursor: 'pointer',
            background: showAddSection ? `${C.accent}15` : C.card,
            border: `1px solid ${showAddSection ? `${C.accent}25` : C.cardBorder}`,
            color: showAddSection ? C.accent : C.textMuted, fontSize: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {showAddSection ? '×' : '+'}
          </button>
        }
      />

      {/* ═══ SEARCH ═══ */}
      {contacts.length > 3 && (
        <div style={{ padding: '0 16px 6px', flexShrink: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: C.card, border: `1px solid ${C.cardBorder}`,
            backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
            borderRadius: 14, padding: '10px 14px',
          }}>
            <span style={{ fontSize: 14, opacity: 0.4 }}></span>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder={L('searchContacts')}
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: C.textPrimary, fontSize: 13, fontFamily: FONT }} />
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 16, padding: 0 }}>×</button>}
          </div>
        </div>
      )}

      {/* ═══ ADD / INVITE SECTION ═══ */}
      {showAddSection && (
        <div style={{
          margin: '0 16px 8px', padding: 14, borderRadius: 16,
          background: C.card, border: `1px solid ${C.cardBorder}`,
          backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          animation: 'vtSlideUp 0.2s ease-out',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: C.textSecondary }}>
            {L('addByEmail')}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <input style={{
              flex: 1, padding: '10px 14px', borderRadius: 12, fontSize: 13, fontFamily: FONT,
              background: C.input, border: `1px solid ${C.inputBorder}`, color: C.textPrimary, outline: 'none',
            }} type="email" placeholder={L('contactEmailPlaceholder')}
              value={addEmail} onChange={e => { setAddEmail(e.target.value); setAddError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleAddContact()} />
            <button onClick={handleAddContact} style={{
              padding: '10px 16px', borderRadius: 12, cursor: 'pointer',
              background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
              border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: FONT,
            }}>+</button>
          </div>
          {addError && <div style={{ fontSize: 10, color: C.red, marginBottom: 4 }}>{addError}</div>}
          {addSuccess && <div style={{ fontSize: 10, color: C.green, marginBottom: 4 }}>{addSuccess}</div>}

          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            {hasDeviceContacts && (
              <button onClick={handleImportDeviceContacts} disabled={deviceImporting} style={{
                flex: 1, padding: '9px 10px', borderRadius: 12, cursor: 'pointer',
                background: `${C.accent}10`, border: `1px solid ${C.accent}20`,
                color: C.textPrimary, fontSize: 11, fontFamily: FONT,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                opacity: deviceImporting ? 0.5 : 1,
              }}>
                {deviceImporting ? '...' : L('addressBook')}
              </button>
            )}
            <button onClick={handleCreateInvite} style={{
              flex: 1, padding: '9px 10px', borderRadius: 12, cursor: 'pointer',
              background: `${C.purple}10`, border: `1px solid ${C.purple}20`,
              color: C.textPrimary, fontSize: 11, fontFamily: FONT,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}>
              {L('inviteFriend')}
            </button>
          </div>

          {deviceImportResult && (
            <div style={{
              fontSize: 10, marginTop: 6, padding: '5px 8px', borderRadius: 8,
              background: deviceImportResult.error ? `${C.red}10` : `${C.green}10`,
              color: deviceImportResult.error ? C.red : C.green,
            }}>
              {deviceImportResult.error || `${deviceImportResult.added} ${L('importedAdded')}, ${deviceImportResult.invited} ${L('importedInvited')}`}
            </div>
          )}
        </div>
      )}

      {/* ═══ INVITE SHARE PANEL ═══ */}
      {showInvite && currentInviteCode && (
        <div style={{
          margin: '0 16px 8px', padding: 14, borderRadius: 16,
          background: C.card, border: `1px solid ${C.accent}20`,
          backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          animation: 'vtSlideUp 0.2s ease-out',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, color: C.textSecondary }}>{L('shareInvite')}</div>
          <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 10 }}>{L('shareInviteDesc')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
            {[
              { id: 'whatsapp', icon: '', label: 'WhatsApp', color: '#25D366' },
              { id: 'telegram', icon: '', label: 'Telegram', color: '#0088cc' },
              { id: 'sms', icon: '', label: 'SMS', color: '#FF9500' },
              { id: 'email', icon: '', label: 'Email', color: C.accent },
            ].map(ch => (
              <button key={ch.id} onClick={() => handleShare(ch.id)} style={{
                padding: '9px 8px', borderRadius: 12, cursor: 'pointer',
                background: `${ch.color}12`, border: `1px solid ${ch.color}25`,
                color: C.textPrimary, fontSize: 11, fontFamily: FONT,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                WebkitTapHighlightColor: 'transparent',
              }}>
                {ch.icon} {ch.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => handleShare('copy')} style={{
              flex: 1, padding: '8px', borderRadius: 10, cursor: 'pointer',
              background: `rgba(255,255,255,0.03)`, border: `1px solid ${C.cardBorder}`,
              color: linkCopied ? C.green : C.textPrimary, fontSize: 11, fontFamily: FONT,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}>
              {linkCopied ? `✓ ${L('copiedShort')}` : L('copyLink')}
            </button>
            {typeof navigator !== 'undefined' && navigator.share && (
              <button onClick={() => handleShare('native')} style={{
                flex: 1, padding: '8px', borderRadius: 10, cursor: 'pointer',
                background: `rgba(255,255,255,0.03)`, border: `1px solid ${C.cardBorder}`,
                color: C.textPrimary, fontSize: 11, fontFamily: FONT,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}>
                {L('moreDots')}
              </button>
            )}
          </div>
          <button onClick={() => setShowInvite(false)} style={{
            marginTop: 4, background: 'none', border: 'none', color: C.textMuted,
            fontSize: 10, cursor: 'pointer', fontFamily: FONT, width: '100%', textAlign: 'center', padding: 3,
          }}>{L('closeWord')}</button>
        </div>
      )}

      {/* ═══ CONTACTS LIST ═══ */}
      {/* b.206 — bottom alzato: gli ultimi contatti finivano sotto la BottomNav */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px calc(88px + env(safe-area-inset-bottom))', scrollbarWidth: 'none' }}>
        {contactsLoading && contacts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: C.textMuted, fontSize: 12 }}>{L('loading')}</div>
        ) : contacts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px' }}>
            <div style={{
              width: 80, height: 80, borderRadius: 24, margin: '0 auto 16px',
              background: `linear-gradient(135deg, ${C.accent}15, ${C.purple}15)`,
              border: `1px solid ${C.accent}15`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36,
            }}></div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary, marginBottom: 6 }}>{L('noContacts')}</div>
            <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.6, maxWidth: 260, margin: '0 auto 20px' }}>
              {L('noContactsDesc')}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button onClick={() => setShowAddSection(true)} style={{
                padding: '10px 22px', borderRadius: 14, cursor: 'pointer',
                background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
                border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: FONT,
                boxShadow: `0 4px 16px ${C.accent}30`,
              }}>+ {L('addShort')}</button>
              <button onClick={handleCreateInvite} style={{
                padding: '10px 22px', borderRadius: 14, cursor: 'pointer',
                background: `${C.purple}12`, border: `1px solid ${C.purple}20`,
                color: C.textPrimary, fontSize: 12, fontWeight: 700, fontFamily: FONT,
              }}>{L('inviteShort')}</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sortedContacts.map((contact, idx) => (
              <div key={contact.email} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                borderRadius: 18,
                background: contact.online ? `${C.green}06` : C.card,
                border: `1px solid ${contact.online ? `${C.green}18` : C.cardBorder}`,
                backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                animation: `vtSlideUp 0.25s ease-out ${idx * 0.03}s both`,
              }}>
                {/* Avatar + online dot */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <img src={contact.avatar} alt="" style={{
                    width: 48, height: 48, borderRadius: 16,
                    border: `2px solid ${contact.online ? C.green : C.cardBorder}`,
                  }} />
                  <div style={{
                    position: 'absolute', bottom: -1, right: -1, width: 13, height: 13,
                    borderRadius: 7, border: `2px solid ${C.bg}`,
                    background: contact.online ? C.green : C.textMuted,
                  }} />
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {contact.name || contact.email.split('@')[0]}
                    </span>
                    <span style={{ fontSize: 15, flexShrink: 0 }}>{LANGS.find(l => l.code === contact.lang)?.flag || ''}</span>
                  </div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                    {contact.online ? L('onlineWord') : contact.lastSeen ? `${L('lastSeenPrefix')} ${formatLastSeen(contact.lastSeen)} ${L('agoWord')}` : L('offlineWord')}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                  <button onClick={() => handleStartChat && handleStartChat(contact)} style={{
                    width: 38, height: 38, borderRadius: 12, cursor: 'pointer',
                    background: contact.online ? `${C.green}15` : `${C.accent}10`,
                    border: `1px solid ${contact.online ? `${C.green}25` : `${C.accent}18`}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                    WebkitTapHighlightColor: 'transparent',
                  }}></button>
                  {confirmRemove === contact.email ? (
                    <button onClick={async () => { await removeContact(contact.email); setConfirmRemove(null); }} style={{
                      width: 38, height: 38, borderRadius: 12, cursor: 'pointer',
                      background: `${C.red}15`, border: `1px solid ${C.red}25`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.red, fontSize: 14,
                      WebkitTapHighlightColor: 'transparent',
                    }}>✓</button>
                  ) : (
                    <button onClick={() => setConfirmRemove(contact.email)} style={{
                      width: 38, height: 38, borderRadius: 12, cursor: 'pointer',
                      background: `rgba(255,255,255,0.03)`, border: `1px solid ${C.cardBorder}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textMuted, fontSize: 14,
                      WebkitTapHighlightColor: 'transparent',
                    }}>×</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {status && <div style={{ textAlign: 'center', padding: '6px 16px', fontSize: 11, color: C.accent }}>{status}</div>}

      <style>{`@keyframes vtSlideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
