import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { doc, getDoc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "./AuthContext";
import {
  subscribeToConversations,
  getOrCreateConversation,
  sendMessage,
  subscribeToMessages,
  markConversationRead,
  readMessageText,
  getStudentProfile,
  getOrCreateAdminConversation,
  sendAdminChatMessage,
  subscribeToAdminConversations,
  subscribeToAdminMessages,
  markAdminConversationRead,
} from "../services/social";

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
  const unsubMsgRef = useRef(null);
  // Track clearedAt per active conversation so Clear Chat updates messages instantly
  const clearedAtRefGlobal = useRef(null);

  useEffect(() => {
    if (!uid) {
      setConversations([]);
      return;
    }

    function mergeAndDeduplicateConvs(convList, currentUid) {
      const sorted = [...convList].sort((a, b) => {
        const aTime = a.lastMessageAt?.toMillis?.() || (a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0);
        const bTime = b.lastMessageAt?.toMillis?.() || (b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0);
        return bTime - aTime;
      });

      const seenPartnerUids = new Set();
      const deduplicated = [];
      for (const c of sorted) {
        const partnerId = c.otherUser?.id || c.participants?.find((p) => p !== currentUid);
        if (partnerId) {
          if (!seenPartnerUids.has(partnerId)) {
            seenPartnerUids.add(partnerId);
            deduplicated.push(c);
          }
        } else {
          deduplicated.push(c);
        }
      }
      return deduplicated;
    }

    // Subscribe to BOTH regular and admin conversations, merge and deduplicate by partner UID
    const unsubRegular = subscribeToConversations(uid, (regularConvs) => {
      const tagged = (regularConvs || []).map((c) => ({ ...c, isAdmin: false }));
      setConversations((prev) => {
        const adminConvs = prev.filter((c) => c.isAdmin);
        return mergeAndDeduplicateConvs([...tagged, ...adminConvs], uid);
      });
    });

    const unsubAdmin = subscribeToAdminConversations(uid, (adminConvs) => {
      const tagged = (adminConvs || []).map((c) => ({ ...c, isAdmin: true }));
      setConversations((prev) => {
        const regularConvs = prev.filter((c) => !c.isAdmin);
        return mergeAndDeduplicateConvs([...regularConvs, ...tagged], uid);
      });
    });

    return () => { unsubRegular?.(); unsubAdmin?.(); };
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
      clearedAtRefGlobal.current = null;
      return;
    }

    const isAdmin = activeConversation.isAdmin || activeConversation.id?.startsWith("admin_");

    // Admin conversations: plaintext, no E2EE
    if (isAdmin) {
      unsubMsgRef.current = subscribeToAdminMessages(activeConversation.id, (rawMessages) => {
        const mapped = (rawMessages || []).map((m) => ({
          id: m.id,
          text: m.text || "",
          senderId: m.senderId,
          createdAt: m.createdAt,
          read: m.read,
          isAdminMessage: true,
        }));
        setMessages(mapped);
      });
      return () => { unsubMsgRef.current?.(); };
    }

    // Regular conversations: read plaintext + legacy graceful handling
    let disappearingSettingRef = { current: null };
    let clearedAtRef = { current: null };

    // Fetch disappearing messages setting and clearedAt for this conversation
    (async () => {
      try {
        const convSnap = await getDoc(doc(db, "conversations", activeConversation.id));
        if (convSnap.exists()) {
          const data = convSnap.data();
          const dm = data.disappearingMessages;
          if (dm?.enabled && dm.duration && DISAPPEARING_DURATIONS[dm.duration]) {
            disappearingSettingRef.current = dm.duration;
          }
          if (data.clearedAt && data.clearedAt[uid]) {
            clearedAtRef.current = data.clearedAt[uid];
            clearedAtRefGlobal.current = data.clearedAt[uid];
          }
        }
      } catch {}
    })();

    unsubMsgRef.current = subscribeToMessages(activeConversation.id, async (rawMessages) => {
      const otherId = activeConversation.participants?.find((p) => p !== uid);

      const withText = await Promise.all(
        rawMessages.map(async (m) => {
          try {
            const text = await readMessageText(m, uid, otherId);
            return { ...m, text };
          } catch {
            return { ...m, text: "Unable to read this message." };
          }
        })
      );

      let filtered = withText;

      const clearedAt = clearedAtRef.current ?? clearedAtRefGlobal.current;
      if (clearedAt) {
        filtered = filtered.filter((m) => {
          const msgTime = m.createdAt?.toDate ? m.createdAt.toDate().getTime() : new Date(m.createdAt).getTime();
          return msgTime > clearedAt;
        });
      }

      const expiredIds = [];
      const duration = disappearingSettingRef.current;
      if (duration) {
        const durationMs = DISAPPEARING_DURATIONS[duration];
        const now = Date.now();
        filtered = filtered.filter((m) => {
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
  }, [activeConversation?.id, activeConversation?.isAdmin, uid]);

  const startConversation = useCallback(async (otherUserId, isAdminTarget = false) => {
    if (!uid) return null;

    // Admin conversations: use admin messaging path
    if (isAdminTarget) {
      const res = await getOrCreateAdminConversation(uid, otherUserId);
      if (res.error) return null;
      const convId = res.data.id;
      let otherUser = { id: otherUserId };
      try {
        const profileRes = await getStudentProfile(otherUserId);
        if (profileRes.data) otherUser = { id: otherUserId, ...profileRes.data };
      } catch {}
      return {
        id: convId,
        participants: [uid, otherUserId],
        lastMessage: null,
        lastMessageAt: null,
        unread1: 0,
        unread2: 0,
        otherUser,
        isAdmin: true,
      };
    }

    // Regular conversations
    const res = await getOrCreateConversation(uid, otherUserId);
    if (res.error) return null;
    const convId = res.data.id;
    let otherUser = { id: otherUserId };
    try {
      const profileRes = await getStudentProfile(otherUserId);
      if (profileRes.data) otherUser = { id: otherUserId, ...profileRes.data };
    } catch {}
    // Read real conversation data from Firestore instead of hardcoding nulls
    let convData = {
      id: convId,
      participants: [uid, otherUserId],
      lastMessage: null,
      lastMessageAt: null,
      unread1: 0,
      unread2: 0,
      otherUser,
    };
    try {
      const convSnap = await getDoc(doc(db, "conversations", convId));
      if (convSnap.exists()) {
        const firestore = convSnap.data();
        convData = {
          ...convData,
          lastMessage: firestore.lastMessage || null,
          lastMessageAt: firestore.lastMessageAt || null,
          unread1: firestore.unread1 || 0,
          unread2: firestore.unread2 || 0,
          clearedAt: firestore.clearedAt || {},
        };
      }
    } catch {}
    return convData;
  }, [uid]);

  const sendChatMessage = useCallback(async (conversationId, text, recipientIdOverride = null, participantsOverride = null) => {
    if (!uid || !text.trim()) return;
    setSending(true);
    try {
      const otherId = recipientIdOverride || participantsOverride?.find?.((p) => p !== uid) || null;
      if (!otherId) {
        console.error("sendChatMessage: Could not determine recipient user ID", { recipientIdOverride, participantsOverride });
        throw new Error("Could not determine recipient user ID");
      }
      const participants = participantsOverride || [uid, otherId];

      // Admin conversations: use admin messaging path
      const isAdmin = activeConversation?.isAdmin || conversationId?.startsWith("admin_");
      if (isAdmin) {
        const result = await sendAdminChatMessage(conversationId, uid, text, participants);
        if (result?.error) throw new Error(result.error);
        return;
      }

      // Regular conversations: plaintext (no E2EE)
      const result = await sendMessage(conversationId, uid, text, participants);
      if (result?.error) {
        throw new Error(result.error);
      }
    } catch (err) {
      console.error("sendChatMessage failed:", err);
      throw err;
    } finally {
      setSending(false);
    }
  }, [uid, activeConversation?.isAdmin]);

  const markRead = useCallback(async (conversationId) => {
    if (!uid) return;
    const isAdmin = activeConversation?.isAdmin || conversationId?.startsWith("admin_");
    if (isAdmin) {
      await markAdminConversationRead(conversationId, uid);
    } else {
      await markConversationRead(conversationId, uid, activeConversation?.participants);
    }
  }, [uid, activeConversation?.isAdmin, activeConversation?.participants]);

  /**
   * Clear Chat — sets a per-user clearedAt timestamp in Firestore so that
   * messages before this point are hidden for THIS user only.
   * The conversation relationship and messages remain intact for the other user.
   * Messages are NOT deleted from Firestore.
   */
  const clearChat = useCallback(async (conversationId) => {
    if (!uid || !conversationId) return;
    const now = Date.now();
    try {
      await updateDoc(doc(db, "conversations", conversationId), {
        [`clearedAt.${uid}`]: now,
      });
      // Update the global ref so the current message subscription immediately
      // applies the filter without waiting for Firestore round-trip
      clearedAtRefGlobal.current = now;
      // Immediately clear messages in React state for this user
      setMessages([]);
    } catch (err) {
      console.error("clearChat error:", err);
      throw err;
    }
  }, [uid]);

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
    clearChat,
    totalUnread,
  }), [conversations, activeConversation, messages, sending, startConversation, sendChatMessage, markRead, clearChat, totalUnread]);

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}
