import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { doc, getDoc, updateDoc, writeBatch, collection, query, where, orderBy, getDocs, onSnapshot } from "firebase/firestore";
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
  clearAllConversationMessages,
  deleteExpiredMessages,
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
  // Store raw messages for re-filtering when disappearing setting changes
  const rawMessagesRef = useRef([]);

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
    let disposed = false;
    rawMessagesRef.current = [];
    const disappearingRef = { current: null };
    const clearedAtVal = { current: null };

    function applyFilters() {
      if (disposed) return;
      let filtered = rawMessagesRef.current;

      const cat = clearedAtVal.current ?? clearedAtRefGlobal.current;
      if (cat) {
        filtered = filtered.filter((m) => {
          const msgTime = m.createdAt?.toDate ? m.createdAt.toDate().getTime() : new Date(m.createdAt).getTime();
          return msgTime > cat;
        });
      }

      const expiredIds = [];
      const dur = disappearingRef.current;
      if (dur) {
        const durationMs = DISAPPEARING_DURATIONS[dur];
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
    }

    // 1. Listen to conversation doc in real-time for setting changes
    const unsubConv = onSnapshot(doc(db, "conversations", activeConversation.id), (snap) => {
      if (disposed || !snap.exists()) return;
      const data = snap.data();
      const dm = data.disappearingMessages;
      const prevDur = disappearingRef.current;
      if (dm?.enabled && dm.duration && DISAPPEARING_DURATIONS[dm.duration]) {
        disappearingRef.current = dm.duration;
      } else {
        disappearingRef.current = null;
      }
      if (data.clearedAt && data.clearedAt[uid]) {
        clearedAtVal.current = data.clearedAt[uid];
        clearedAtRefGlobal.current = data.clearedAt[uid];
      }
      // Re-filter if disappearing setting changed
      if (prevDur !== disappearingRef.current) {
        applyFilters();
      }
    }, () => {});

    // 2. Subscribe to messages
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

      rawMessagesRef.current = withText;
      applyFilters();
    });

    return () => {
      disposed = true;
      unsubConv();
      unsubMsgRef.current?.();
    };
  }, [activeConversation?.id, activeConversation?.isAdmin, uid]);

  // ─── BACKGROUND DISAPPEARING MESSAGES EXPIRY ─────────────────
  // Periodically checks all conversations for expired messages and deletes them
  // from Firebase so both participants see them disappear in realtime.
  useEffect(() => {
    if (!uid) return;

    let disposed = false;
    const intervalId = setInterval(async () => {
      if (disposed) return;
      try {
        const convQ = query(
          collection(db, "conversations"),
          where("participants", "array-contains", uid)
        );
        const convSnap = await getDocs(convQ);
        for (const convDoc of convSnap.docs) {
          if (disposed) return;
          const convData = convDoc.data();
          const dm = convData.disappearingMessages;
          if (dm?.enabled && dm.duration) {
            await deleteExpiredMessages(convDoc.id, dm.duration);
          }
        }
      } catch (err) {
        console.warn("Background disappearing messages check failed:", err);
      }
    }, 60 * 1000); // Every 60 seconds

    return () => {
      disposed = true;
      clearInterval(intervalId);
    };
  }, [uid]);

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
   * Clear Chat — permanently deletes ALL message documents belonging to the
   * conversation from Firebase. The conversation itself is preserved.
   * Both sender and recipient see the cleared state via realtime listener.
   */
  const clearChat = useCallback(async (conversationId) => {
    if (!uid || !conversationId) return;
    const now = Date.now();
    try {
      // 1. Permanently delete all messages from Firebase
      const result = await clearAllConversationMessages(conversationId);
      if (result.error) throw new Error(result.error);

      // 2. Set clearedAt timestamp so recipient's view also clears immediately
      //    (in case they have messages older than what we just deleted)
      await updateDoc(doc(db, "conversations", conversationId), {
        [`clearedAt.${uid}`]: now,
      });

      // 3. Update local state
      clearedAtRefGlobal.current = now;
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
