import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { doc, getDoc, writeBatch } from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "./AuthContext";
import {
  subscribeToConversations,
  getOrCreateConversation,
  sendMessage,
  subscribeToMessages,
  markConversationRead,
  encryptMessage,
  decryptMessage,
  getStudentProfile,
} from "../services/social";
import { ensureECDHKeys } from "../utils/crypto";

const ChatContext = createContext(null);

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}

export function ChatProvider({ children }) {
  const { user } = useAuth();
  const uid = user?.uid || null;

  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const unsubConvRef = useRef(null);
  const unsubMsgRef = useRef(null);

  useEffect(() => {
    if (!uid) {
      setConversations([]);
      return;
    }
    // Ensure ECDH keys exist for this user (generates on first login)
    ensureECDHKeys(uid).catch((err) => {
      console.warn("ECDH key init failed, will use legacy encryption:", err);
    });
    unsubConvRef.current = subscribeToConversations(uid, setConversations);
    return () => { unsubConvRef.current?.(); };
  }, [uid]);

  // Duration mapping for disappearing messages (ms)
  const DISAPPEARING_DURATIONS = {
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
  };

  useEffect(() => {
    if (!activeConversation?.id || !uid) {
      setMessages([]);
      return;
    }

    let disappearingSettingRef = { current: null };

    // Fetch disappearing messages setting for this conversation
    (async () => {
      try {
        const convSnap = await getDoc(doc(db, "conversations", activeConversation.id));
        if (convSnap.exists()) {
          const dm = convSnap.data().disappearingMessages;
          if (dm?.enabled && dm.duration && DISAPPEARING_DURATIONS[dm.duration]) {
            disappearingSettingRef.current = dm.duration;
          }
        }
      } catch {}
    })();

    unsubMsgRef.current = subscribeToMessages(activeConversation.id, async (rawMessages) => {
      const otherId = activeConversation.participants.find((p) => p !== uid);
      const decrypted = await Promise.all(
        rawMessages.map(async (m) => {
          try {
            const text = await decryptMessage(m.encryptedText, uid, otherId, m.messageVersion);
            return { ...m, text };
          } catch {
            return { ...m, text: "Unable to decrypt this message." };
          }
        })
      );

      // Filter out expired disappearing messages
      let filtered = decrypted;
      const expiredIds = [];
      const duration = disappearingSettingRef.current;
      if (duration) {
        const durationMs = DISAPPEARING_DURATIONS[duration];
        const now = Date.now();
        filtered = decrypted.filter((m) => {
          const msgTime = m.createdAt?.toDate ? m.createdAt.toDate().getTime() : new Date(m.createdAt).getTime();
          const age = now - msgTime;
          if (age > durationMs) {
            expiredIds.push(m.id);
            return false;
          }
          return true;
        });
      }

      setMessages(filtered);

      // Background cleanup: delete expired messages from Firestore (best-effort, non-blocking)
      if (expiredIds.length > 0) {
        (async () => {
          try {
            const batch = writeBatch(db);
            expiredIds.forEach((id) => {
              batch.delete(doc(db, "messages", id));
            });
            await batch.commit();
          } catch {}
        })();
      }
    });
    return () => { unsubMsgRef.current?.(); };
  }, [activeConversation?.id, uid]);

  const startConversation = useCallback(async (otherUserId) => {
    if (!uid) return null;
    const res = await getOrCreateConversation(uid, otherUserId);
    if (res.error) return null;
    const convId = res.data.id;
    let otherUser = { id: otherUserId };
    try {
      const profileRes = await getStudentProfile(otherUserId);
      if (profileRes.data) otherUser = { id: otherUserId, ...profileRes.data };
    } catch {}
    const convData = {
      id: convId,
      participants: [uid, otherUserId],
      lastMessage: null,
      lastMessageAt: null,
      unread1: 0,
      unread2: 0,
      otherUser,
    };
    setActiveConversation(convData);
    return convData;
  }, [uid]);

  const sendChatMessage = useCallback(async (conversationId, text) => {
    if (!uid || !text.trim()) return;
    setSending(true);
    try {
      const otherId = activeConversation?.participants?.find((p) => p !== uid)
        || activeConversation?.otherUser?.id;
      if (!otherId) return;
      const { encryptedText, messageVersion } = await encryptMessage(text, uid, otherId);
      await sendMessage(conversationId, uid, encryptedText, activeConversation?.participants, messageVersion);
    } finally {
      setSending(false);
    }
  }, [uid, activeConversation?.participants, activeConversation?.otherUser?.id]);

  const markRead = useCallback(async (conversationId) => {
    if (!uid) return;
    await markConversationRead(conversationId, uid, activeConversation?.participants);
  }, [uid, activeConversation?.participants]);

  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0),
    [conversations]
  );

  const value = useMemo(() => ({
    conversations,
    activeConversation,
    setActiveConversation,
    messages,
    sending,
    startConversation,
    sendChatMessage,
    markRead,
    totalUnread,
  }), [conversations, activeConversation, messages, sending, startConversation, sendChatMessage, markRead, totalUnread]);

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}
