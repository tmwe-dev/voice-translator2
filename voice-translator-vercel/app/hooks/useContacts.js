'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { APP_URL } from '../lib/constants.js';
import { t } from '../lib/i18n.js';
import { subscribeTick } from '../lib/ticker.js';

const HEARTBEAT_INTERVAL = 60000; // 60 seconds

export default function useContacts({ userTokenRef }) {
  const [contacts, setContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState(null);
  const heartbeatRef = useRef(null);

  // Heartbeat: keep presence alive — reads token from ref each tick
  useEffect(() => {
    async function sendHeartbeat() {
      const token = userTokenRef?.current;
      if (!token) return;
      try {
        await fetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'heartbeat', token }),
          // b.363 — prima questa chiamata non aveva scadenza: se la rete
          // restava appesa il battito non tornava piu e la presenza si
          // bloccava senza che nessuno se ne accorgesse.
          signal: AbortSignal.timeout(10000)
        });
      } catch { /* la rete puo mancare: chi chiama decide cosa fare del vuoto */ }
    }

    const unsubHeartbeat = subscribeTick(HEARTBEAT_INTERVAL, sendHeartbeat, { immediate: true });
    heartbeatRef.current = unsubHeartbeat;

    // Go offline on unload
    const handleUnload = () => {
      const token = userTokenRef?.current;
      if (!token) return;
      try {
        navigator.sendBeacon('/api/contacts', JSON.stringify({
          action: 'offline', token
        }));
      } catch { /* avviso di uscita mandato mentre la pagina si chiude: se non parte, il server se ne accorge dal silenzio */ }
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      if (typeof heartbeatRef.current === 'function') heartbeatRef.current();
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- reads from ref

  // Fetch contacts list
  const fetchContacts = useCallback(async () => {
    const token = userTokenRef?.current;
    if (!token) return;
    setContactsLoading(true);
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list', token }),
        // b.363 — senza scadenza una rete appesa lasciava la rubrica in
        // caricamento per sempre.
        signal: AbortSignal.timeout(10000)
      });
      // b.363 — prima si leggeva il corpo come JSON senza rete di
      // sicurezza: quando il guardiano risponde 429 con una pagina HTML,
      // la lettura esplodeva e l'elenco restava vuoto senza spiegazione.
      const data = await res.json().catch(() => ({}));
      if (data.contacts) setContacts(data.contacts);
      else if (!res.ok) console.warn('[contatti] elenco non leggibile, stato', res.status);
    } catch (e) {
      console.error('Fetch contacts error:', e);
    } finally {
      setContactsLoading(false);
    }
  }, [userTokenRef]);

  // Auto-refresh contacts every 30s when list is visible
  const startPolling = useCallback(() => {
    // Shared ticker: pauses automatically when tab is hidden
    return subscribeTick(30000, fetchContacts, { immediate: true });
  }, [fetchContacts]);

  // Add contact by email
  const addContact = useCallback(async (contactEmail) => {
    const token = userTokenRef?.current;
    if (!token) return { ok: false, error: 'notAuthenticated' };
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', token, contactEmail }),
        // b.363 — aggiunta contatto: chiamata breve, 10s bastano.
        signal: AbortSignal.timeout(10000)
      });
      // b.363 — la risposta poteva non essere JSON (pagina d'errore del
      // guardiano): prima esplodeva e l'utente vedeva solo il messaggio
      // tecnico dell'eccezione. Ora si ripiega su un errore di rete.
      const data = await res.json().catch(() => ({}));
      if (data.ok) {
        await fetchContacts();
        return { ok: true, contact: data.contact };
      }
      return { ok: false, error: data.error || 'networkError', notRegistered: data.notRegistered };
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
        body: JSON.stringify({ action: 'remove', token, contactEmail }),
        // b.363 — rimozione contatto: chiamata breve, 10s bastano.
        signal: AbortSignal.timeout(10000)
      });
      // b.363 — vedi sopra: risposta non-JSON non deve far esplodere la
      // rimozione, che deve solo restituire "non fatto".
      const data = await res.json().catch(() => ({}));
      if (data.ok) {
        setContacts(prev => prev.filter(c => c.email !== contactEmail));
        return true;
      }
    } catch { /* la rete puo mancare: chi chiama decide cosa fare del vuoto */ }
    return false;
  }, [userTokenRef]);

  // Generate invite link (with optional gift)
  const createInvite = useCallback(async (giftAmount = 0) => {
    const token = userTokenRef?.current;
    if (!token) return null;
    try {
      const body = { action: 'create-invite', token };
      if (giftAmount > 0) body.giftAmount = giftAmount;
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        // b.363 — creazione invito: chiamata breve, 10s bastano.
        signal: AbortSignal.timeout(10000)
      });
      // b.363 — se il corpo non era JSON la creazione dell'invito
      // esplodeva e l'utente non riceveva ne link ne motivo.
      const data = await res.json().catch(() => ({}));
      if (data.error) return { ok: false, error: data.error };
      if (!res.ok) return { ok: false, error: 'networkError' };
      if (data.inviteCode) {
        setInviteCode(data.inviteCode);
        return { ok: true, inviteCode: data.inviteCode, giftApplied: data.giftApplied, newBalance: data.newBalance };
      }
    } catch (e) {
      return { ok: false, error: e.message };
    }
    return null;
  }, [userTokenRef]);

  // Accept invite (may include gift credits)
  const acceptInvite = useCallback(async (code) => {
    const token = userTokenRef?.current;
    if (!token) return { ok: false };
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept-invite', token, inviteCode: code }),
        // b.363 — accettazione invito: chiamata breve, 10s bastano.
        signal: AbortSignal.timeout(10000)
      });
      // b.363 — con una pagina d'errore al posto del JSON l'invito
      // risultava "accettato male": nessun esito, nessun motivo.
      const data = await res.json().catch(() => ({}));
      if (data.ok) {
        await fetchContacts();
        return {
          ok: true,
          inviter: data.inviter,
          giftReceived: data.giftReceived || 0,
          giftFromName: data.giftFromName || ''
        };
      }
      return { ok: false, error: data.error || 'networkError' };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }, [userTokenRef, fetchContacts]);

  // Share invite via different channels
  const shareInvite = useCallback(async (channel, code, lang = 'it', giftAmount = 0) => {
    const inviteUrl = `${APP_URL}?invite=${code}`;
    // b.136 — QUI L'INVITO PARLAVA DUE LINGUE SU QUINDICI.
    //
    //     const isIT = lang === 'it';
    //
    // e chi invitava un tailandese o un russo gli mandava un messaggio
    // in inglese. Peggio: il ramo inglese diceva "the real-time
    // BarTalk", frase priva di senso nata da una sostituzione
    // automatica del nome del prodotto sul testo "the real-time voice
    // translator". E' rimasta li a lungo perche nessuno legge il ramo
    // che non e il proprio.
    const T = (chiave) => t(lang, chiave);
    const giftText = giftAmount > 0
      ? ` ${T('inviteGiftPrefix')} ${(giftAmount / 100).toFixed(2)}€ ${T('inviteGiftSuffix')}`
      : '';
    const text = `${T('inviteShareIntro')}${giftText} ${T('inviteJoinHere')} ${inviteUrl}`;

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
        const subject = T('inviteEmailSubject');
        window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`, '_blank');
        break;
      }
      case 'copy':
        try {
          await navigator.clipboard.writeText(inviteUrl);
          return { ok: true, copied: true };
        } catch { /* l utente ha annullato, o il permesso non c e */ }
        break;
      case 'native':
        if (navigator.share) {
          try {
            await navigator.share({ title: 'BarTalk', text, url: inviteUrl });
          } catch { /* l utente ha annullato, o il permesso non c e */ }
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

  // Pick contacts from device address book (navigator.contacts API)
  const pickDeviceContacts = useCallback(async () => {
    if (typeof navigator === 'undefined' || !('contacts' in navigator) || !('ContactsManager' in window)) {
      return { supported: false };
    }
    try {
      const picked = await navigator.contacts.select(
        ['name', 'email', 'tel'],
        { multiple: true }
      );
      return { supported: true, contacts: picked };
    } catch (e) {
      if (e.name === 'TypeError') return { supported: false };
      return { supported: true, contacts: [], cancelled: true };
    }
  }, []);

  // Check if device contacts API is available
  const hasDeviceContacts = typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in (typeof window !== 'undefined' ? window : {});

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
    pickDeviceContacts,
    hasDeviceContacts,
  };
}
