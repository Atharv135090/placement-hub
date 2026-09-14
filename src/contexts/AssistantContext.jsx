import { createContext, useContext, useState, useRef, useCallback, useEffect, useMemo } from "react";

const AssistantContext = createContext(null);

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000; // §11: 12-hour conversation cleanup
const MAX_CONTEXT_MESSAGES = 40; // §20: Context compression limit

function createWelcomeMessage() {
  return {
    role: "assistant",
    text: "Hi! I'm your Placement Assistant. Ask me anything — coding, career, general questions, or just chat.",
    ts: Date.now(),
  };
}

/**
 * Check if two timestamps are more than 12 hours apart.
 * §11, §12: If inactive >= 12 hours, reset conversation.
 */
function isExpired(lastActivityAt) {
  if (!lastActivityAt) return true;
  return Date.now() - lastActivityAt >= TWELVE_HOURS_MS;
}

/**
 * Compress messages to stay within context limits.
 * §20: Keep recent messages, preserve important context.
 */
function compressMessages(messages) {
  if (messages.length <= MAX_CONTEXT_MESSAGES) return messages;

  // Keep the welcome message + last N messages
  const welcome = messages[0]?.role === "assistant" ? [messages[0]] : [];
  const recent = messages.slice(-MAX_CONTEXT_MESSAGES);
  return [...welcome, ...recent];
}

export function AssistantProvider({ children }) {
  const [messages, setMessages] = useState(() => [createWelcomeMessage()]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamingText, setStreamingText] = useState(null);
  const [lastActivityAt, setLastActivityAt] = useState(() => Date.now());
  const bottomRef = useRef(null);
  const abortRef = useRef(null);

  // §15: Duplicate send protection
  const generationInProgress = useRef(false);

  /**
   * §11: Check for 12-hour expiry on mount and periodically.
   */
  useEffect(() => {
    const checkExpiry = () => {
      if (isExpired(lastActivityAt) && messages.length > 1) {
        // §11: Clear/reset old Assistant context after 12+ hours of inactivity
        setMessages([createWelcomeMessage()]);
        setStreamingText(null);
        setBusy(false);
        setLastActivityAt(Date.now());
      }
    };

    // Check immediately on mount
    checkExpiry();

    // Check every 5 minutes
    const timer = setInterval(checkExpiry, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [lastActivityAt, messages.length]);

  /**
   * §13: Update lastActivityAt when user sends a message.
   */
  const updateActivity = useCallback(() => {
    setLastActivityAt(Date.now());
  }, []);

  /**
   * Add a message to the conversation.
   * §20: Applies context compression when messages exceed limit.
   */
  const addMsg = useCallback((role, text, extra = {}) => {
    setMessages((prev) => {
      const updated = [...prev, { role, text, ts: Date.now(), ...extra }];
      return compressMessages(updated);
    });
  }, []);

  /**
   * §11: Clear/reset conversation.
   */
  const clearConversation = useCallback(() => {
    setStreamingText(null);
    setBusy(false);
    generationInProgress.current = false;
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setMessages([createWelcomeMessage()]);
    setLastActivityAt(Date.now());
  }, []);

  /**
   * §15: Check if generation is already in progress (duplicate send protection).
   */
  const isGenerationInProgress = useCallback(() => {
    return generationInProgress.current;
  }, []);

  /**
   * §15: Mark generation as started.
   */
  const startGeneration = useCallback(() => {
    generationInProgress.current = true;
  }, []);

  /**
   * §15: Mark generation as finished.
   */
  const endGeneration = useCallback(() => {
    generationInProgress.current = false;
  }, []);

  const value = useMemo(() => ({
    messages,
    setMessages,
    input,
    setInput,
    busy,
    setBusy,
    streamingText,
    setStreamingText,
    abortRef,
    clearConversation,
    bottomRef,
    addMsg,
    lastActivityAt,
    updateActivity,
    isGenerationInProgress,
    startGeneration,
    endGeneration,
  }), [messages, input, busy, streamingText, lastActivityAt, addMsg, updateActivity, clearConversation, isGenerationInProgress, startGeneration, endGeneration]);

  return (
    <AssistantContext.Provider value={value}>
      {children}
    </AssistantContext.Provider>
  );
}

export function useAssistant() {
  const ctx = useContext(AssistantContext);
  if (!ctx) throw new Error("useAssistant must be used within AssistantProvider");
  return ctx;
}
