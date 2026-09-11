import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useChat } from "../contexts/ChatContext";
import { getAllStudents } from "../services/social";
import UserAvatar from "../components/UserAvatar";
import Modal from "../components/Modal";
import "./Chat.css";

// ─── SVG ICONS ──────────────────────────────────────────────
const ChatHeaderIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const PenEditIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </svg>
);

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

const PhoneIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const VideoIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="m22 8-6 4 6 4V8Z" />
    <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
  </svg>
);

const InfoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </svg>
);

const ThreeDotsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="1" />
    <circle cx="12" cy="5" r="1" />
    <circle cx="12" cy="19" r="1" />
  </svg>
);

const PaperclipIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
);

const EmojiIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
    <line x1="9" y1="9" x2="9.01" y2="9" />
    <line x1="15" y1="9" x2="15.01" y2="9" />
  </svg>
);

const SendAirplaneIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" fill="currentColor" />
  </svg>
);

const DoubleCheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 7 17l-5-5" />
    <path d="m22 10-7.5 7.5L13 16" />
  </svg>
);

const BackArrowIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6" />
  </svg>
);

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
    startConversation,
  } = useChat();

  const [input, setInput] = useState("");
  const [filterTab, setFilterTab] = useState("all");
  const [convSearch, setConvSearch] = useState("");

  // New Message Modal State
  const [newMsgModalOpen, setNewMsgModalOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [contactSearch, setContactSearch] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Conversation action state
  const [showConvMenu, setShowConvMenu] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark read when active
  useEffect(() => {
    if (activeConversation?.id) {
      markRead(activeConversation.id);
    }
  }, [activeConversation?.id, messages.length, markRead]);

  // Load available users for the New Message modal (excluding logged-in user)
  useEffect(() => {
    if (!newMsgModalOpen) return;
    async function loadContacts() {
      setLoadingContacts(true);
      try {
        const res = await getAllStudents();
        const myUid = user?.uid;
        const myEmail = user?.email?.toLowerCase();
        const usersList = (res.data || []).filter(
          (u) => u.id !== myUid && (!myEmail || (u.email || "").toLowerCase() !== myEmail)
        );
        setAvailableUsers(usersList);
      } catch (e) {
        console.error("Failed to load contacts:", e);
      }
      setLoadingContacts(false);
    }
    loadContacts();
  }, [newMsgModalOpen, user?.uid, user?.email]);

  // Resolve partner profile for active conversation
  const [partnerProfile, setPartnerProfile] = useState(null);

  useEffect(() => {
    if (!activeConversation) {
      setPartnerProfile(null);
      return;
    }
    if (activeConversation.otherUser) {
      setPartnerProfile(activeConversation.otherUser);
      return;
    }
    const found = conversations.find((c) => c.id === activeConversation.id);
    if (found?.otherUser) {
      setPartnerProfile(found.otherUser);
      return;
    }
    const otherId = activeConversation.participants?.find((p) => p !== user?.uid);
    if (!otherId) return;
    let cancelled = false;
    import("../services/social").then(({ getStudentProfile }) => {
      if (cancelled) return;
      getStudentProfile(otherId).then((res) => {
        if (!cancelled && res.data) setPartnerProfile(res.data);
      });
    });
    return () => { cancelled = true; };
  }, [activeConversation, conversations, user?.uid]);

  const activePartner = partnerProfile || activeConversation?.otherUser;

  // Send message handler
  async function handleSend() {
    if (!input.trim() || sending || !activeConversation?.id) return;
    const textToSend = input.trim();
    setInput("");
    await sendChatMessage(activeConversation.id, textToSend);
    inputRef.current?.focus();
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Format message timestamp: 08:48 PM
  function formatMessageTime(date) {
    if (!date) return "";
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  }

  // Format conversation preview timestamp
  function formatConvTime(date) {
    if (!date) return "";
    const d = date.toDate ? date.toDate() : new Date(date);
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    if (isToday) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();

    if (isYesterday) return "Yesterday";

    return d.toLocaleDateString([], { day: "numeric", month: "short" });
  }

  // Filter conversations based on search and tab
  const filteredConversations = useMemo(() => {
    let result = [...conversations];

    if (convSearch.trim()) {
      const q = convSearch.toLowerCase().trim();
      result = result.filter((c) => {
        const name = (c.otherUser?.displayName || "Student").toLowerCase();
        const role = (c.otherUser?.role || "").toLowerCase();
        return name.includes(q) || role.includes(q);
      });
    }

    if (filterTab === "students") {
      result = result.filter((c) => !c.otherUser?.role || c.otherUser?.role === "student" || c.otherUser?.role === "owner");
    } else if (filterTab === "recruiters") {
      result = result.filter((c) => c.otherUser?.role === "recruiter" || c.otherUser?.role === "admin");
    } else if (filterTab === "companies") {
      result = result.filter((c) => c.isCompany || c.otherUser?.role === "company");
    }

    return result;
  }, [conversations, convSearch, filterTab]);

  // Start new conversation from modal
  async function handleSelectContact(contact) {
    setNewMsgModalOpen(false);
    const otherUserObj = {
      id: contact.id,
      displayName: contact.displayName || contact.name || "Student",
      photoUrl: contact.photoUrl,
      role: contact.role || "student",
      branch: contact.branch,
    };
    try {
      const conv = await startConversation(contact.id);
      if (conv) {
        setActiveConversation({ ...conv, otherUser: otherUserObj });
      } else {
        const fallbackId = [user?.uid, contact.id].sort().join("_");
        setActiveConversation({
          id: fallbackId,
          participants: [user?.uid, contact.id],
          otherUser: otherUserObj,
        });
      }
      setPartnerProfile(otherUserObj);
    } catch (err) {
      console.error("Error starting chat:", err);
    }
  }

  // Filtered contacts for modal
  const filteredContacts = useMemo(() => {
    if (!contactSearch.trim()) return availableUsers;
    const q = contactSearch.toLowerCase().trim();
    return availableUsers.filter((u) => {
      const name = (u.displayName || u.name || "").toLowerCase();
      const branch = (u.branch || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      return name.includes(q) || branch.includes(q) || email.includes(q);
    });
  }, [availableUsers, contactSearch]);

  return (
    <div className="msg-page-wrapper animate-fade-in">
      {/* ─── 4. MESSAGES HEADER ────────────────────────────────────── */}
      <div className="msg-page-header">
        <div className="msg-title-block">
          <div className="msg-icon-badge">
            <ChatHeaderIcon />
          </div>
          <div>
            <h1 className="msg-main-title">Messages</h1>
            <p className="msg-main-subtitle">Connect with students, recruiters and your network</p>
          </div>
        </div>

        <button className="msg-btn-new-message" onClick={() => setNewMsgModalOpen(true)}>
          <PenEditIcon />
          <span>New Message</span>
        </button>
      </div>

      {/* ─── MAIN TWO-COLUMN MESSAGING CARD ───────────────────────── */}
      <div className="msg-card-container">
        {/* ─── 5. LEFT CONVERSATION LIST PANEL ─────────────────────── */}
        <aside className={`msg-sidebar-panel ${activeConversation ? "msg-sidebar--hide-mobile" : ""}`}>
          {/* Search bar */}
          <div className="msg-search-box">
            <SearchIcon />
            <input
              type="text"
              className="msg-search-input"
              placeholder="Search conversations..."
              value={convSearch}
              onChange={(e) => setConvSearch(e.target.value)}
            />
          </div>

          {/* Filter Tabs: All, Students, Recruiters, Companies */}
          <div className="msg-filter-tabs" role="tablist" aria-label="Conversation Filters">
            <button
              className={`msg-tab-pill ${filterTab === "all" ? "active" : ""}`}
              onClick={() => setFilterTab("all")}
            >
              All
            </button>
            <button
              className={`msg-tab-pill ${filterTab === "students" ? "active" : ""}`}
              onClick={() => setFilterTab("students")}
            >
              Students
            </button>
            <button
              className={`msg-tab-pill ${filterTab === "recruiters" ? "active" : ""}`}
              onClick={() => setFilterTab("recruiters")}
            >
              Recruiters
            </button>
            <button
              className={`msg-tab-pill ${filterTab === "companies" ? "active" : ""}`}
              onClick={() => setFilterTab("companies")}
            >
              Companies
            </button>
          </div>

          {/* Scrollable Conversation List */}
          <div className="msg-conversations-list">
            {filteredConversations.length === 0 ? (
              <div className="msg-empty-list">
                <div className="msg-empty-icon-wrap">💬</div>
                <h4 className="msg-empty-title">
                  {convSearch ? "No matching conversations" : "No messages yet"}
                </h4>
                <p className="msg-empty-desc">
                  {convSearch
                    ? "Try a different search keyword."
                    : "Start connecting with fellow students and recruiters."}
                </p>
                {!convSearch && (
                  <button className="msg-empty-btn" onClick={() => setNewMsgModalOpen(true)}>
                    <PenEditIcon />
                    <span>Start a conversation</span>
                  </button>
                )}
              </div>
            ) : (
              filteredConversations.map((c) => {
                const isSelected = activeConversation?.id === c.id;
                const other = c.otherUser || {};
                const name = other.displayName || "Student";
                const lastMsg = c.lastMessageText || (c.lastMessage ? "[Encrypted Message]" : "Started a conversation");
                const timeStr = formatConvTime(c.lastMessageAt || c.updatedAt || c.createdAt);
                const unread = c.unreadCount || 0;

                return (
                  <div
                    key={c.id}
                    className={`msg-conv-item ${isSelected ? "msg-conv-item--active" : ""}`}
                    onClick={() => {
                      setActiveConversation(c);
                      markRead(c.id);
                    }}
                  >
                    <div className="msg-conv-avatar-wrap">
                      <UserAvatar
                        user={{ uid: other.id }}
                        profile={other}
                        style={{ width: 44, height: 44 }}
                      />
                      <span className="msg-online-dot" />
                    </div>

                    <div className="msg-conv-content">
                      <div className="msg-conv-top-row">
                        <span className="msg-conv-name">{name}</span>
                        <span className="msg-conv-time">{timeStr}</span>
                      </div>
                      <div className="msg-conv-bottom-row">
                        <p className="msg-conv-preview">{lastMsg}</p>
                        {unread > 0 && <span className="msg-unread-badge">{unread}</span>}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* ─── 6. RIGHT ACTIVE CHAT PANEL ──────────────────────────── */}
        <section className={`msg-chat-panel ${!activeConversation ? "msg-chat-panel--empty" : ""}`}>
          {!activeConversation ? (
            <div className="msg-chat-empty-state">
              <div className="msg-placeholder-icon-wrap">
                <ChatHeaderIcon />
              </div>
              <h3 className="msg-placeholder-title">Select a conversation</h3>
              <p className="msg-placeholder-subtitle">
                Choose a conversation from the list on the left, or start a new chat with fellow students and mentors.
              </p>
              <button className="msg-placeholder-btn" onClick={() => setNewMsgModalOpen(true)}>
                <PenEditIcon />
                <span>New Message</span>
              </button>
            </div>
          ) : (
            <>
              {/* Active Chat Header */}
              <div className="msg-active-header">
                <button
                  className="msg-back-to-list-btn"
                  onClick={() => setActiveConversation(null)}
                  title="Back to conversations"
                  aria-label="Back to conversations"
                >
                  <BackArrowIcon />
                </button>

                <div className="msg-active-user-meta">
                  <div className="msg-active-avatar-wrap">
                    <UserAvatar
                      user={{ uid: activePartner?.id }}
                      profile={activePartner}
                      style={{ width: 44, height: 44 }}
                    />
                  </div>

                  <div className="msg-active-name-col">
                    <h3 className="msg-active-name">
                      {activePartner?.displayName || activePartner?.name || "Student"}
                    </h3>
                    <span className="msg-active-status-text">
                      <span className="msg-status-circle" /> Online
                    </span>
                  </div>
                </div>

                {/* Header Action Icons */}
                <div className="msg-header-actions">
                  <button
                    type="button"
                    className="msg-action-icon-btn"
                    title="View Profile"
                    onClick={() => navigate(`/students/${activePartner?.id || ""}`)}
                  >
                    <PhoneIcon />
                  </button>

                  <button
                    type="button"
                    className="msg-action-icon-btn"
                    title="View Profile"
                    onClick={() => navigate(`/students/${activePartner?.id || ""}`)}
                  >
                    <VideoIcon />
                  </button>

                  <button
                    type="button"
                    className="msg-action-icon-btn"
                    title="View Profile Info"
                    onClick={() => navigate(`/students/${activePartner?.id || ""}`)}
                  >
                    <InfoIcon />
                  </button>

                  <div style={{ position: "relative" }}>
                    <button
                      type="button"
                      className="msg-action-icon-btn"
                      title="Conversation options"
                      onClick={() => setShowConvMenu(!showConvMenu)}
                    >
                      <ThreeDotsIcon />
                    </button>
                    {showConvMenu && (
                      <div className="msg-conv-menu" style={{
                        position: "absolute", right: 0, top: "100%", zIndex: 100,
                        background: "var(--surface, #1e1e2e)", border: "1px solid var(--border, #333)",
                        borderRadius: 8, padding: "4px 0", minWidth: 160,
                        boxShadow: "0 8px 24px rgba(0,0,0,0.3)"
                      }}>
                        <button
                          className="msg-conv-menu-item"
                          style={{ display: "block", width: "100%", padding: "8px 14px", background: "none", border: "none", color: "var(--text, #e0e0e0)", textAlign: "left", cursor: "pointer", fontSize: "0.85rem" }}
                          onClick={() => { setShowConvMenu(false); navigate(`/students/${activePartner?.id || ""}`); }}
                        >
                          View Profile
                        </button>
                        <button
                          className="msg-conv-menu-item"
                          style={{ display: "block", width: "100%", padding: "8px 14px", background: "none", border: "none", color: "#ef4444", textAlign: "left", cursor: "pointer", fontSize: "0.85rem" }}
                          onClick={() => { setShowConvMenu(false); navigate("/chat"); }}
                        >
                          Leave Conversation
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Message History Body */}
              <div className="msg-history-body">
                {/* Date separator */}
                <div className="msg-date-divider">
                  <span className="msg-date-pill">Today</span>
                </div>

                {messages.length === 0 ? (
                  <div className="msg-empty-thread">
                    <p className="msg-thread-prompt">No messages yet in this conversation.</p>
                    <p className="msg-thread-sub">Send a message below to start chatting!</p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isSent = m.senderId === user?.uid;
                    const timeStr = formatMessageTime(m.createdAt);

                    return (
                      <div key={m.id} className={`msg-bubble-row ${isSent ? "sent" : "received"}`}>
                        {!isSent && (
                          <div className="msg-bubble-avatar">
                            <UserAvatar
                              user={{ uid: activePartner?.id }}
                              profile={activePartner}
                              style={{ width: 34, height: 34 }}
                            />
                          </div>
                        )}

                        <div className={`msg-bubble-box ${isSent ? "sent" : "received"}`}>
                          <p className="msg-bubble-text">{m.text}</p>
                          <div className="msg-bubble-footer">
                            <span className="msg-bubble-time">{timeStr}</span>
                            {isSent && (
                              <span className="msg-read-check" title="Delivered">
                                <DoubleCheckIcon />
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* ─── 7. MESSAGE COMPOSER BAR ───────────────────────── */}
              <div className="msg-composer-outer">
                <div className="msg-composer-capsule">
                  <button
                    type="button"
                    className="msg-composer-tool-btn"
                    title="Attach file"
                    disabled
                    style={{ opacity: 0.4, cursor: "not-allowed" }}
                  >
                    <PaperclipIcon />
                  </button>

                  <input
                    ref={inputRef}
                    type="text"
                    className="msg-composer-input"
                    placeholder="Type a message..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={sending}
                  />

                  <button
                    type="button"
                    className="msg-composer-tool-btn"
                    title="Insert emoji"
                    onClick={() => setInput((prev) => prev + " 😊 ")}
                  >
                    <EmojiIcon />
                  </button>

                  <button
                    type="button"
                    className="msg-composer-send-btn"
                    onClick={handleSend}
                    disabled={!input.trim() || sending}
                    title="Send message"
                  >
                    <SendAirplaneIcon />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {/* ─── 8. NEW MESSAGE MODAL ─────────────────────────────────── */}
      <Modal open={newMsgModalOpen} onClose={() => setNewMsgModalOpen(false)} title="New Message">
        <div className="msg-modal-body">
          <div className="msg-modal-search-wrap">
            <SearchIcon />
            <input
              type="text"
              placeholder="Search students by name, branch, email..."
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
              className="msg-modal-search-input"
              autoFocus
            />
          </div>

          <div className="msg-modal-contacts-list">
            {loadingContacts ? (
              <div className="msg-modal-loading">Loading students...</div>
            ) : filteredContacts.length === 0 ? (
              <div className="msg-modal-empty">No students found matching your search.</div>
            ) : (
              filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="msg-modal-contact-item"
                  onClick={() => handleSelectContact(contact)}
                >
                  <UserAvatar
                    user={{ uid: contact.id }}
                    profile={contact}
                    style={{ width: 40, height: 40 }}
                  />
                  <div className="msg-modal-contact-info">
                    <span className="msg-modal-contact-name">
                      {contact.displayName || contact.name || "Student"}
                    </span>
                    <span className="msg-modal-contact-sub">
                      {contact.branch ? `${contact.branch} • ` : ""}
                      {contact.role === "admin" || contact.role === "owner" ? "Admin" : "Student"}
                    </span>
                  </div>
                  <button type="button" className="msg-modal-chat-btn" onClick={() => handleSelectContact(contact)}>
                    Chat
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>

    </div>
  );
}
