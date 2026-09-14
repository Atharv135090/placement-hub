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
  encryptMessage,
  decryptMessage,
  getStudentProfile,
  getOrCreateAdminConversation,
  sendAdminChatMessage,
  subscribeToAdminConversations,
  subscribeToAdminMessages,
  markAdminConversationRead,
  reEncryptConversationMessages,
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
  const unsubMsgRef = useRef(null);
  const ecdhReadyRef = useRef(null);
  const rawMessagesRef = useRef([]);
  const [keyVersion, setKeyVersion] = useState(0);
  // Track clearedAt per active conversation so Clear Chat updates messages instantly
  const clearedAtRefGlobal = useRef(null);

  useEffect(() => {
    if (!uid) {
      setConversations([]);
      return;
    }
    // Ensure ECDH keys exist for this user (generates on first login)
    // and publish public key to Firestore for cross-user E2EE.
    // IMPORTANT: ensureECDHKeys never overwrites an existing key pair.
    ecdhReadyRef.current = ensureECDHKeys(uid)
      .then(() => { setKeyVersion((v) => v + 1); })
      .catch((err) => {
        console.warn("ECDH key init failed, will use legacy encryption:", err);
      });

    // Subscribe to BOTH regular and admin conversations, merge into one list
    const unsubRegular = subscribeToConversations(uid, (regularConvs) => {
      const tagged = (regularConvs || []).map((c) => ({ ...c, isAdmin: false }));
      setConversations((prev) => {
        const adminConvs = prev.filter((c) => c.isAdmin);
        const merged = [...tagged, ...adminConvs];
        merged.sort((a, b) => {
          const aTime = a.lastMessageAt?.toMillis?.() || (a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0);
          const bTime = b.lastMessageAt?.toMillis?.() || (b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0);
          return bTime - aTime;
        });
        return merged;
      });
    });

    const unsubAdmin = subscribeToAdminConversations(uid, (adminConvs) => {
      const tagged = (adminConvs || []).map((c) => ({ ...c, isAdmin: true }));
      setConversations((prev) => {
        const regularConvs = prev.filter((c) => !c.isAdmin);
        const merged = [...regularConvs, ...tagged];
        merged.sort((a, b) => {
          const aTime = a.lastMessageAt?.toMillis?.() || (a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0);
          const bTime = b.lastMessageAt?.toMillis?.() || (b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0);
          return bTime - aTime;
        });
        return merged;
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
      rawMessagesRef.current = [];
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

    // Regular conversations: E2EE
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
          // Per-user clear: read clearedAt timestamp for current user
          if (data.clearedAt && data.clearedAt[uid]) {
            clearedAtRef.current = data.clearedAt[uid];
            clearedAtRefGlobal.current = data.clearedAt[uid];
          }
        }
      } catch {}
    })();

    unsubMsgRef.current = subscribeToMessages(activeConversation.id, async (rawMessages) => {
      // Store raw messages for retry when keys become available
      rawMessagesRef.current = rawMessages;

      // IMPORTANT: Wait for ECDH key initialization before attempting decryption.
      // This prevents race conditions where the subscription fires before keys are ready.
      if (ecdhReadyRef.current) await ecdhReadyRef.current;

      const otherId = activeConversation.participants?.find((p) => p !== uid);

      const decrypted = await Promise.all(
        rawMessages.map(async (m) => {
          try {
            // Pass embedded public key metadata from the message document.
            // This is the primary decryption path — it does not depend on
            // Firestore key lookups and works indefinitely regardless of message age.
            const text = await decryptMessage(
              m.encryptedText,
              uid,
              otherId,
              m.messageVersion,
              m.senderPubKey || null,
              m.recipientPubKey || null
            );
            return { ...m, text };
          } catch {
            return { ...m, text: "Unable to decrypt this message." };
          }
        })
      );

      let filtered = decrypted;

      // Per-user clear: filter out messages sent before the user explicitly cleared.
      // This uses a timestamp set by the user's Clear Chat action — NOT automatic.
      const clearedAt = clearedAtRef.current ?? clearedAtRefGlobal.current;
      if (clearedAt) {
        filtered = filtered.filter((m) => {
          const msgTime = m.createdAt?.toDate ? m.createdAt.toDate().getTime() : new Date(m.createdAt).getTime();
          return msgTime > clearedAt;
        });
      }

      // Filter out expired disappearing messages (user-opted-in feature only)
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

      // Background cleanup: delete expired disappearing messages from Firestore (best-effort, non-blocking)
      // NOTE: This ONLY fires for user-opted-in disappearing messages, NOT for normal messages.
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

  // Retry decryption when ECDH keys become available (handles the case where
  // the subscription fires before keys are fully initialized — existing fix preserved).
  useEffect(() => {
    if (keyVersion < 1 || !activeConversation?.id || activeConversation?.isAdmin || !uid) return;
    const rawMessages = rawMessagesRef.current;
    if (!rawMessages || rawMessages.length === 0) return;

    (async () => {
      // Only retry if current state has "Unable to decrypt" messages
      const currentMessages = rawMessages;
      const otherId = activeConversation.participants?.find((p) => p !== uid);

      const decrypted = await Promise.all(
        currentMessages.map(async (m) => {
          try {
            const text = await decryptMessage(
              m.encryptedText,
              uid,
              otherId,
              m.messageVersion,
              m.senderPubKey || null,
              m.recipientPubKey || null
            );
            return { ...m, text };
          } catch {
            return { ...m, text: "Unable to decrypt this message." };
          }
        })
      );

      setMessages((prev) => {
        const hasFailures = prev.some((m) => m.text === "Unable to decrypt this message.");
        if (!hasFailures) return prev; // Nothing to fix

        const prevMap = new Map(prev.map((m) => [m.id, m]));
        let changed = false;
        const result = decrypted.map((m) => {
          const prevMsg = prevMap.get(m.id);
          if (prevMsg?.text === "Unable to decrypt this message." && m.text !== "Unable to decrypt this message.") {
            changed = true;
            return m;
          }
          return prevMsg || m;
        });
        return changed ? result : prev;
      });
    })();
  }, [keyVersion, activeConversation?.id, activeConversation?.isAdmin, uid]);

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

      // Admin conversations: plaintext (no E2EE)
      const isAdmin = activeConversation?.isAdmin || conversationId?.startsWith("admin_");
      if (isAdmin) {
        const result = await sendAdminChatMessage(conversationId, uid, text, participants);
        if (result?.error) throw new Error(result.error);
        return;
      }

      // Regular conversations: E2EE
      // encryptMessage now returns senderPubKey and recipientPubKey for persistent metadata
      const { encryptedText, messageVersion, senderPubKey, recipientPubKey } = await encryptMessage(text, uid, otherId);
      const result = await sendMessage(conversationId, uid, encryptedText, participants, messageVersion, senderPubKey, recipientPubKey);
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

  const reEncryptOldMessages = useCallback(async (conversationId) => {
    if (!uid || !conversationId) return 0;
    const otherId = activeConversation?.participants?.find((p) => p !== uid);
    if (!otherId) return 0;
    return reEncryptConversationMessages(conversationId, uid, otherId);
  }, [uid, activeConversation?.participants]);

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
    reEncryptOldMessages,
  }), [conversations, activeConversation, messages, sending, startConversation, sendChatMessage, markRead, clearChat, totalUnread, reEncryptOldMessages]);

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}
