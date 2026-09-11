import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  getOrCreateAdminConversation,
  sendAdminChatMessage,
  getAdminConversations,
  subscribeToAdminMessages,
  subscribeToAdminConversations,
  markAdminConversationRead,
} from "../../services/social";
import UserAvatar from "../../components/UserAvatar";
import "./AdminChat.css";

export default function AdminChat() {
  const { studentId } = useParams();
  const { user } = require("../../contexts/AuthContext").useAuth();
  const adminId = user?.uid;

  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!adminId) return;
    setLoading(true);
    const unsub = subscribeToAdminConversations(adminId, (convList) => {
      setConversations(convList);
      setLoading(false);
    });
    return () => unsub();
  }, [adminId]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!studentId || !adminId) return;
    async function openStudentChat() {
      const { data } = await getOrCreateAdminConversation(adminId, studentId);
      if (data) {
        setActiveConv({ id: data.id, otherUser: { id: studentId } });
      }
    }
    openStudentChat();
  }, [studentId, adminId]);

  useEffect(() => {
    if (!activeConv?.id) {
      setMessages([]);
      return;
    }
    markAdminConversationRead(activeConv.id, adminId);
    const unsub = subscribeToAdminMessages(activeConv.id, (msgs) => {
      setMessages(msgs);
    });
    return () => unsub();
  }, [activeConv?.id, adminId]);

  function selectConversation(conv) {
    setActiveConv(conv);
  }

  async function handleSend() {
    if (!newMessage.trim() || !activeConv || sending) return;
    setSending(true);
    const otherId = activeConv.otherUser?.id || activeConv.participants?.find((p) => p !== adminId);
    const participants = [adminId, otherId];
    const { error } = await sendAdminChatMessage(
      activeConv.id,
      adminId,
      newMessage.trim(),
      participants
    );
    if (!error) {
      setNewMessage("");
      inputRef.current?.focus();
    }
    setSending(false);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function formatTime(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatConvTime(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    if (diff < 86400000 && d.getDate() === now.getDate()) {
      return d.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    if (diff < 604800000) {
      return d.toLocaleDateString("en-IN", { weekday: "short" });
    }
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
    });
  }

  return (
    <div className="ac">
      <div className="ac-sidebar">
        <div className="ac-sidebar-header">
          <h2 className="ac-sidebar-title">Messages</h2>
        </div>
        <div className="ac-sidebar-list">
          {loading ? (
            <div className="ac-sidebar-loading">
              {[1, 2, 3].map((i) => (
                <div key={i} className="ac-conv-skeleton">
                  <div className="ac-skel-avatar" />
                  <div className="ac-skel-lines">
                    <div className="ac-skel-line" />
                    <div className="ac-skel-line ac-skel-line--short" />
                  </div>
                </div>
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="ac-sidebar-empty">
              <p>No conversations yet</p>
              <span>Send a message from Reports to start</span>
            </div>
          ) : (
            conversations.map((conv) => {
              const isActive = activeConv?.id === conv.id;
              const other = conv.otherUser || {};
              return (
                <div
                  key={conv.id}
                  className={`ac-conv-item ${isActive ? "ac-conv-item--active" : ""}`}
                  onClick={() => selectConversation(conv)}
                >
                  <div className="ac-conv-avatar">
                    <UserAvatar
                      user={{ uid: other.id }}
                      profile={other}
                      className="ac-conv-avatar-img"
                    />
                    {conv.unreadCount > 0 && (
                      <span className="ac-conv-badge">{conv.unreadCount}</span>
                    )}
                  </div>
                  <div className="ac-conv-info">
                    <div className="ac-conv-top">
                      <span className="ac-conv-name">
                        {other.displayName || "Student"}
                      </span>
                      <span className="ac-conv-time">
                        {formatConvTime(conv.lastMessageAt)}
                      </span>
                    </div>
                    <span className="ac-conv-preview">
                      {conv.lastMessage || "No messages yet"}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="ac-main">
        {activeConv ? (
          <>
            <div className="ac-chat-header">
              <div className="ac-chat-user">
                <UserAvatar
                  user={{ uid: activeConv.otherUser?.id }}
                  profile={activeConv.otherUser}
                  style={{ width: 32, height: 32 }}
                />
                <div>
                  <span className="ac-chat-name">
                    {activeConv.otherUser?.displayName || "Student"}
                  </span>
                  <span className="ac-chat-sub">Placement Hub Admin</span>
                </div>
              </div>
            </div>

            <div className="ac-messages">
              {messages.length === 0 && (
                <div className="ac-messages-empty">
                  <p>No messages yet. Start the conversation.</p>
                </div>
              )}
              {messages.map((msg) => {
                const isMine = msg.senderId === adminId;
                return (
                  <div
                    key={msg.id}
                    className={`ac-msg ${isMine ? "ac-msg--mine" : "ac-msg--theirs"}`}
                  >
                    <div className="ac-msg-bubble">
                      <p className="ac-msg-text">{msg.text}</p>
                      <span className="ac-msg-time">{formatTime(msg.createdAt)}</span>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="ac-input-bar">
              <textarea
                ref={inputRef}
                className="ac-input"
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
              />
              <button
                className="ac-send-btn"
                onClick={handleSend}
                disabled={!newMessage.trim() || sending}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </>
        ) : (
          <div className="ac-main-empty">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p>Select a conversation</p>
            <span>Start messaging from the Reports panel</span>
          </div>
        )}
      </div>
    </div>
  );
}
