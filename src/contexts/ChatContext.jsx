import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from "react";
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

  useEffect(() => {
    if (!activeConversation?.id || !uid) {
      setMessages([]);
      return;
    }
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
      setMessages(decrypted);
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
