import { createContext, useContext, useState, useRef } from "react";

const AssistantContext = createContext(null);

export function AssistantProvider({ children }) {
  const [messages, setMessages] = useState(() => [
    {
      role: "assistant",
      text: "Hi! I'm your Placement Assistant. Ask me anything — coding, career, general questions, or just chat.",
      ts: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef(null);

  function addMsg(role, text, extra = {}) {
    setMessages((prev) => [
      ...prev,
      { role, text, ts: Date.now(), ...extra },
    ]);
  }

  function clearConversation() {
    setMessages([
      {
        role: "assistant",
        text: "Hi! I'm your Placement Assistant. Ask me anything — coding, career, general questions, or just chat.",
        ts: Date.now(),
      },
    ]);
  }

  return (
    <AssistantContext.Provider
      value={{
        messages,
        setMessages,
        input,
        setInput,
        busy,
        setBusy,
        clearConversation,
        bottomRef,
        addMsg,
      }}
    >
      {children}
    </AssistantContext.Provider>
  );
}

export function useAssistant() {
  const ctx = useContext(AssistantContext);
  if (!ctx) throw new Error("useAssistant must be used within AssistantProvider");
  return ctx;
}
