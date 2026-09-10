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
  const unsubConvRef = useRef(null);
  const unsubMsgRef = useRef(null);

  useEffect(() => {
    if (!uid) {
      setConversations([]);
      return;
    }
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
            const text = await decryptMessage(m.encryptedText, uid, otherId);
            return { ...m, text };
          } catch {
            return { ...m, text: "[decryption failed]" };
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
    const convSnap = await import("firebase/firestore").then((mod) =>
      import("../config/firebase").then((fb) =>
        mod.getDoc(mod.doc(fb.db, "conversations", convId))
      )
    );
    if (convSnap.exists()) {
      const convData = { id: convSnap.id, ...convSnap.data() };
      setActiveConversation(convData);
      return convData;
    }
    return null;
  }, [uid]);

  const sendChatMessage = useCallback(async (conversationId, text) => {
    if (!uid || !text.trim()) return;
    setSending(true);
    try {
      const convSnap = await import("firebase/firestore").then((mod) =>
        import("../config/firebase").then((fb) =>
          mod.getDoc(mod.doc(fb.db, "conversations", conversationId))
        )
      );
      if (!convSnap.exists()) return;
      const conv = convSnap.data();
      const otherId = conv.participants.find((p) => p !== uid);
      const encrypted = await encryptMessage(text, uid, otherId);
      await sendMessage(conversationId, uid, encrypted);
    } finally {
      setSending(false);
    }
  }, [uid]);

  const markRead = useCallback(async (conversationId) => {
    if (!uid) return;
    await markConversationRead(conversationId, uid);
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
    totalUnread,
  }), [conversations, activeConversation, messages, sending, startConversation, sendChatMessage, markRead, totalUnread]);

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}
