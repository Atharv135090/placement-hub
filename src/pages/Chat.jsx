import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useChat } from "../contexts/ChatContext";
import UserAvatar from "../components/UserAvatar";
import "./Chat.css";

export default function Chat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    conversations,
    activeConversation,
    setActiveConversation,
    messages,
    sending,
    sendChatMessage,
    markRead,
  } = useChat();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (activeConversation) {
      markRead(activeConversation.id);
    }
  }, [activeConversation?.id, messages.length, markRead]);

  async function handleSend() {
    if (!input.trim() || sending) return;
    await sendChatMessage(activeConversation.id, input.trim());
    setInput("");
    inputRef.current?.focus();
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function formatTime(date) {
    if (!date) return "";
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="chat-page animate-fade-in">
      <div className="chat-layout">
        <div className={`chat-sidebar glass ${activeConversation ? "chat-sidebar-hidden-mobile" : ""}`}>
          <div className="chat-sidebar-header">
            <h2 className="chat-sidebar-title">Messages</h2>
          </div>
          <div className="chat-conv-list">
            {conversations.length === 0 ? (
              <div className="chat-empty-sidebar">
                <p>No conversations yet.</p>
                <p>Visit a student's profile to start chatting.</p>
              </div>
            ) : (
              conversations.map((c) => (
                <div
                  key={c.id}
                  className={`chat-conv-item ${activeConversation?.id === c.id ? "chat-conv-active" : ""}`}
                  onClick={() => {
                    setActiveConversation(c);
                    markRead(c.id);
                  }}
                >
                  <UserAvatar user={{ uid: c.otherUser?.id }} profile={c.otherUser} style={{ width: 40, height: 40 }} />
                  <div className="chat-conv-info">
                    <div className="chat-conv-name">{c.otherUser?.displayName || "Student"}</div>
                    <div className="chat-conv-preview">{c.lastMessage ? "[encrypted]" : "Start a conversation"}</div>
                  </div>
                  {c.unreadCount > 0 && (
                    <span className="chat-unread-badge">{c.unreadCount}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className={`chat-main ${!activeConversation ? "chat-main-empty" : ""}`}>
          {!activeConversation ? (
            <div className="chat-main-placeholder">
              <div className="chat-placeholder-icon">💬</div>
              <h3>Select a conversation</h3>
              <p>Choose a conversation from the sidebar or visit a student's profile to start chatting.</p>
            </div>
          ) : (
            <>
              <div className="chat-header glass">
                <button className="chat-back-btn" onClick={() => setActiveConversation(null)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <UserAvatar user={{ uid: activeConversation.otherUser?.id }} profile={activeConversation.otherUser} style={{ width: 36, height: 36 }} />
                <div className="chat-header-info">
                  <div className="chat-header-name">{activeConversation.otherUser?.displayName || "Student"}</div>
                  <div className="chat-header-status">Online</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/students/${activeConversation.otherUser?.id}`)}>
                  View Profile
                </button>
              </div>

              <div className="chat-messages">
                {messages.length === 0 ? (
                  <div className="chat-no-messages">
                    <p>Send the first message to start the conversation.</p>
                  </div>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className={`chat-msg ${m.senderId === user.uid ? "chat-msg-sent" : "chat-msg-received"}`}>
                      <div className="chat-msg-bubble">
                        <p className="chat-msg-text">{m.text}</p>
                        <span className="chat-msg-time">{formatTime(m.createdAt)}</span>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="chat-input-bar glass">
                <input
                  ref={inputRef}
                  type="text"
                  className="chat-input"
                  placeholder="Type a message..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={sending}
                />
                <button className="chat-send-btn btn btn-primary" onClick={handleSend} disabled={!input.trim() || sending}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
