'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { APP_URL } from '../lib/constants.js';

const HEARTBEAT_INTERVAL = 60000; // 60 seconds

export default function useContacts({ userTokenRef }) {
  const [contacts, setContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState(null);
  const heartbeatRef = useRef(null);

  // Heartbeat: keep presence alive
  useEffect(() => {
    const token = userTokenRef?.current;
    if (!token) return;

    async function sendHeartbeat() {
      try {
        await fetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'heartbeat', token: userTokenRef.current })
        });
      } catch {}
    }

    sendHeartbeat();
    heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    // Go offline on unload
    const handleUnload = () => {
      try {
        navigator.sendBeacon('/api/contacts', JSON.stringify({
          action: 'offline',
          token: userTokenRef.current
        }));
      } catch {}
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(heartbeatRef.current);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [userTokenRef?.current]);

  // Fetch contacts list
  const fetchContacts = useCallback(async () => {
    const token = userTokenRef?.current;
    if (!token) return;
    setContactsLoading(true);
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list', token })
      });
      const data = await res.json();
      if (data.contacts) setContacts(data.contacts);
    } catch (e) {
      console.error('Fetch contacts error:', e);
    } finally {
      setContactsLoading(false);
    }
  }, [userTokenRef]);

  // Auto-refresh contacts every 30s when list is visible
  const startPolling = useCallback(() => {
    fetchContacts();
    const interval = setInterval(fetchContacts, 30000);
    return () => clearInterval(interval);
  }, [fetchContacts]);

  // Add contact by email
  const addContact = useCallback(async (contactEmail) => {
    const token = userTokenRef?.current;
    if (!token) return { ok: false, error: 'Not authenticated' };
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', token, contactEmail })
      });
      const data = await res.json();
      if (data.ok) {
        await fetchContacts();
        return { ok: true, contact: data.contact };
      }
      return { ok: false, error: data.error, notRegistered: data.notRegistered };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }, [userTokenRef, fetchContacts]);

  // Remove contact
  const removeContact = useCallback(async (contactEmail) => {
    const token = userTokenRef?.current;
    if (!token) return false;
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', token, contactEmail })
      });
      const data = await res.json();
      if (data.ok) {
        setContacts(prev => prev.filter(c => c.email !== contactEmail));
        return true;
      }
    } catch {}
    return false;
  }, [userTokenRef]);

  // Generate invite link
  const createInvite = useCallback(async () => {
    const token = userTokenRef?.current;
    if (!token) return null;
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-invite', token })
      });
      const data = await res.json();
      if (data.inviteCode) {
        setInviteCode(data.inviteCode);
        return data.inviteCode;
      }
    } catch {}
    return null;
  }, [userTokenRef]);

  // Accept invite
  const acceptInvite = useCallback(async (code) => {
    const token = userTokenRef?.current;
    if (!token) return { ok: false };
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept-invite', token, inviteCode: code })
      });
      const data = await res.json();
      if (data.ok) {
        await fetchContacts();
        return { ok: true, inviter: data.inviter };
      }
      return { ok: false, error: data.error };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }, [userTokenRef, fetchContacts]);

  // Share invite via different channels
  const shareInvite = useCallback(async (channel, code, lang = 'it') => {
    const inviteUrl = `${APP_URL}?invite=${code}`;
    const isIT = lang === 'it';
    const text = isIT
      ? `Ciao! Ti invito a usare VoiceTranslate, il traduttore vocale in tempo reale. Unisciti qui: ${inviteUrl}`
      : `Hi! I invite you to use VoiceTranslate, the real-time voice translator. Join here: ${inviteUrl}`;

    switch (channel) {
      case 'whatsapp':
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
        break;
      case 'telegram':
        window.open(`https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(text)}`, '_blank');
        break;
      case 'sms':
        window.open(`sms:?body=${encodeURIComponent(text)}`, '_blank');
        break;
      case 'email': {
        const subject = isIT ? 'Ti invito su VoiceTranslate' : 'VoiceTranslate invitation';
        window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`, '_blank');
        break;
      }
      case 'copy':
        try {
          await navigator.clipboard.writeText(inviteUrl);
          return { ok: true, copied: true };
        } catch {}
        break;
      case 'native':
        if (navigator.share) {
          try {
            await navigator.share({ title: 'VoiceTranslate', text, url: inviteUrl });
          } catch {}
        }
        break;
      default:
        break;
    }
    return { ok: true };
  }, []);

  // Check if a contact is online
  const isContactOnline = useCallback((contactEmail) => {
    return contacts.find(c => c.email === contactEmail)?.online || false;
  }, [contacts]);

  return {
    contacts,
    contactsLoading,
    inviteCode,
    fetchContacts,
    startPolling,
    addContact,
    removeContact,
    createInvite,
    acceptInvite,
    shareInvite,
    isContactOnline,
  };
}
