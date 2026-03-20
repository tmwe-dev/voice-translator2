'use client';
// ═══════════════════════════════════════════════
// useLocalChat — React hook for IndexedDB chat persistence
//
// Manages local chat storage (WhatsApp model).
// Auto-syncs incoming messages from room polling.
// Supports lazy loading via scroll pagination.
// ═══════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  saveChat, saveMessage, saveMessages, getChat, getMessages,
  getAllChats, deleteChat, exportChat, importChat, getStorageUsage,
} from '../lib/chatStorage.js';

const PAGE_SIZE = 50;

/**
 * @param {object} opts
 * @param {string} opts.roomId - Current room ID
 * @param {string} opts.myName - Current user name
 * @param {object[]} opts.members - Room members array
 * @param {string} opts.mode - Room mode
 * @param {string} opts.context - Room context
 */
export default function useLocalChat({ roomId, myName, members, mode, context }) {
  const [chats, setChats] = useState([]);
  const [currentMessages, setCurrentMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [storageInfo, setStorageInfo] = useState(null);
  const savedMsgIdsRef = useRef(new Set());
  const chatIdRef = useRef(null);

  // Chat ID is the room ID (persistent across reconnects)
  const chatId = roomId?.toUpperCase() || null;
  chatIdRef.current = chatId;

  // ── Load all chats on mount ──
  useEffect(() => {
    getAllChats()
      .then(setChats)
      .catch(err => console.warn('[useLocalChat] Failed to load chats:', err));
  }, []);

  // ── Create/update chat metadata when room changes ──
  useEffect(() => {
    if (!chatId || !members?.length) return;

    const chatMeta = {
      id: chatId,
      roomId: chatId,
      members: members.map(m => ({ name: m.name, lang: m.lang, role: m.role })),
      mode: mode || 'conversation',
      context: context || 'general',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      msgCount: 0,
    };

    getChat(chatId).then(existing => {
      if (existing) {
        // Update members and timestamp, keep creation date
        saveChat({ ...existing, members: chatMeta.members, updatedAt: Date.now() });
      } else {
        saveChat(chatMeta);
      }
    }).catch(() => saveChat(chatMeta));
  }, [chatId, members, mode, context]);

  // ── Load messages for current chat ──
  useEffect(() => {
    if (!chatId) return;
    setLoading(true);
    setHasMore(true);
    savedMsgIdsRef.current.clear();

    getMessages(chatId, { limit: PAGE_SIZE })
      .then(msgs => {
        setCurrentMessages(msgs);
        msgs.forEach(m => savedMsgIdsRef.current.add(m.id));
        setHasMore(msgs.length >= PAGE_SIZE);
        setLoading(false);
      })
      .catch(err => {
        console.warn('[useLocalChat] Failed to load messages:', err);
        setLoading(false);
      });
  }, [chatId]);

  // ── Save incoming messages (called from room polling) ──
  const persistMessages = useCallback(async (newMessages) => {
    if (!chatId || !newMessages?.length) return;

    const unsaved = newMessages.filter(m => m.id && !savedMsgIdsRef.current.has(m.id));
    if (!unsaved.length) return;

    try {
      await saveMessages(chatId, unsaved);
      unsaved.forEach(m => savedMsgIdsRef.current.add(m.id));

      // Update local state
      setCurrentMessages(prev => {
        const ids = new Set(prev.map(m => m.id));
        const merged = [...prev, ...unsaved.filter(m => !ids.has(m.id))];
        merged.sort((a, b) => a.timestamp - b.timestamp);
        return merged;
      });

      // Update chat metadata
      const last = unsaved[unsaved.length - 1];
      const chat = await getChat(chatId);
      if (chat) {
        await saveChat({
          ...chat,
          updatedAt: Date.now(),
          lastMessage: last.original || last.text || '',
          lastSender: last.sender,
          msgCount: (chat.msgCount || 0) + unsaved.length,
        });
      }
    } catch (err) {
      console.warn('[useLocalChat] Failed to persist messages:', err);
    }
  }, [chatId]);

  // ── Load older messages (scroll pagination) ──
  const loadMore = useCallback(async () => {
    if (!chatId || loading || !hasMore) return;
    setLoading(true);

    const oldest = currentMessages[0]?.timestamp || Infinity;
    try {
      const older = await getMessages(chatId, { limit: PAGE_SIZE, before: oldest });
      if (older.length < PAGE_SIZE) setHasMore(false);
      older.forEach(m => savedMsgIdsRef.current.add(m.id));
      setCurrentMessages(prev => {
        const ids = new Set(prev.map(m => m.id));
        return [...older.filter(m => !ids.has(m.id)), ...prev];
      });
    } catch (err) {
      console.warn('[useLocalChat] Failed to load more:', err);
    }
    setLoading(false);
  }, [chatId, loading, hasMore, currentMessages]);

  // ── Delete a chat ──
  const removeChat = useCallback(async (id) => {
    try {
      await deleteChat(id);
      setChats(prev => prev.filter(c => c.id !== id));
      if (id === chatId) setCurrentMessages([]);
    } catch (err) {
      console.warn('[useLocalChat] Failed to delete chat:', err);
    }
  }, [chatId]);

  // ── Export current chat ──
  const doExport = useCallback(async (format = 'json') => {
    if (!chatId) return null;
    try {
      return await exportChat(chatId, format);
    } catch (err) {
      console.warn('[useLocalChat] Export failed:', err);
      return null;
    }
  }, [chatId]);

  // ── Import a chat ──
  const doImport = useCallback(async (jsonString) => {
    try {
      const chat = await importChat(jsonString);
      setChats(prev => [chat, ...prev.filter(c => c.id !== chat.id)]);
      return chat;
    } catch (err) {
      console.warn('[useLocalChat] Import failed:', err);
      return null;
    }
  }, []);

  // ── Check storage usage ──
  const checkStorage = useCallback(async () => {
    const info = await getStorageUsage();
    setStorageInfo(info);
    return info;
  }, []);

  return {
    // State
    chats,
    currentMessages,
    loading,
    hasMore,
    storageInfo,
    // Actions
    persistMessages,
    loadMore,
    removeChat,
    exportChat: doExport,
    importChat: doImport,
    checkStorage,
  };
}
