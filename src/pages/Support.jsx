import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  createSupportTicket,
  subscribeUserTickets,
  subscribeTicketMessages,
  addTicketMessage,
  markTicketRead,
  uploadSupportAttachment,
} from "../services/firestore";
import UserAvatar from "../components/UserAvatar";
import Modal from "../components/Modal";
import "./Support.css";

export default function Support() {
  const { user, profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [activeFilter, setActiveFilter] = useState("All"); // All | Open | In Progress | Resolved

  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [replyText, setReplyText] = useState("");
  const [replyFile, setReplyFile] = useState(null);
  const [replying, setReplying] = useState(false);

  // New Request Modal state
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [newFile, setNewFile] = useState(null);
  const [submittingNew, setSubmittingNew] = useState(false);
  const [newError, setNewError] = useState("");

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const replyFileInputRef = useRef(null);

  // 1. Subscribe to User's tickets
  useEffect(() => {
    if (!user?.uid) return;
    setLoadingTickets(true);

    const unsub = subscribeUserTickets(user.uid, (data) => {
      setTickets(data);
      setLoadingTickets(false);
    });

    return () => unsub?.();
  }, [user?.uid]);

  // Handle URL param ?ticket=id or default selection
  useEffect(() => {
    const paramTicket = searchParams.get("ticket");
    if (paramTicket && tickets.some((t) => t.id === paramTicket)) {
      setSelectedTicketId(paramTicket);
    } else if (!selectedTicketId && tickets.length > 0) {
      // Select latest ticket by default on desktop
      if (window.innerWidth >= 768) {
        setSelectedTicketId(tickets[0].id);
      }
    }
  }, [tickets, searchParams]);

  // 2. Subscribe to messages when selectedTicketId changes
  useEffect(() => {
    if (!selectedTicketId) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);

    // Clear unread state for user
    markTicketRead(selectedTicketId, "user");

    const unsub = subscribeTicketMessages(selectedTicketId, (msgs) => {
      setMessages(msgs);
      setLoadingMessages(false);
    });

    return () => unsub?.();
  }, [selectedTicketId]);

  // Auto scroll to bottom of conversation
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Get active selected ticket object
  const selectedTicket = tickets.find((t) => t.id === selectedTicketId) || null;

  // Filtered ticket list
  const filteredTickets = tickets.filter((t) => {
    if (activeFilter === "All") return true;
    return (t.status || "").toLowerCase() === activeFilter.toLowerCase();
  });

  // Handle Create Ticket
  async function handleCreateRequest(e) {
    e.preventDefault();
    if (!newSubject.trim() || !newMessage.trim()) {
      setNewError("Please fill in both Subject and Message.");
      return;
    }
    setSubmittingNew(true);
    setNewError("");

    try {
      let attachmentObj = null;
      if (newFile) {
        const uploadRes = await uploadSupportAttachment(newFile);
        if (uploadRes.error) {
          setNewError(uploadRes.error);
          setSubmittingNew(false);
          return;
        }
        attachmentObj = uploadRes.data;
      }

      const res = await createSupportTicket({
        userId: user.uid,
        userName: profile?.displayName || user.displayName || "Student",
        userEmail: profile?.email || user.email || "",
        subject: newSubject.trim(),
        message: newMessage.trim(),
        attachment: attachmentObj,
      });

      if (res.error) {
        setNewError(res.error);
      } else {
        setNewSubject("");
        setNewMessage("");
        setNewFile(null);
        setNewModalOpen(false);
        if (res.data?.id) {
          setSelectedTicketId(res.data.id);
        }
      }
    } catch (err) {
      setNewError(err.message || "Failed to create support request");
    } finally {
      setSubmittingNew(false);
    }
  }

  // Handle Send Reply
  async function handleSendReply(e) {
    e.preventDefault();
    if (!replyText.trim() && !replyFile) return;
    if (!selectedTicketId || replying) return;

    setReplying(true);

    try {
      let attachmentObj = null;
      if (replyFile) {
        const uploadRes = await uploadSupportAttachment(replyFile);
        if (uploadRes.error) {
          alert(uploadRes.error);
          setReplying(false);
          return;
        }
        attachmentObj = uploadRes.data;
      }

      const res = await addTicketMessage(selectedTicketId, {
        senderId: user.uid,
        senderRole: "user",
        senderName: profile?.displayName || user.displayName || "Student",
        text: replyText.trim() || (replyFile ? `Sent file attachment: ${replyFile.name}` : ""),
        attachment: attachmentObj,
      });

      if (!res.error) {
        setReplyText("");
        setReplyFile(null);
      } else {
        alert(res.error);
      }
    } catch (err) {
      console.error("Failed to send reply:", err);
    } finally {
      setReplying(false);
    }
  }

  // Helpers for Status Badge
  function renderStatusBadge(status) {
    const s = (status || "Open").toLowerCase();
    let badgeClass = "status-badge--open";
    if (s === "in progress") badgeClass = "status-badge--progress";
    if (s === "resolved") badgeClass = "status-badge--resolved";
    if (s === "closed") badgeClass = "status-badge--closed";

    return <span className={`support-status-badge ${badgeClass}`}>{status || "Open"}</span>;
  }

  // Format relative timestamp
  function formatTime(timestampObj) {
    if (!timestampObj) return "Just now";
    const date = timestampObj.toDate ? timestampObj.toDate() : new Date(timestampObj);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "1 day ago";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  return (
    <div className="support-page-container">
      {/* ── HEADER BAR ── */}
      <div className="support-page-header">
        <div className="support-header-titles">
          <h1 className="support-page-title">Support</h1>
          <p className="support-page-subtitle">
            Get help with your account, report issues, or ask us anything. We're here to help!
          </p>
        </div>
        <button
          className="support-new-request-btn"
          onClick={() => {
            setNewError("");
            setNewModalOpen(true);
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>New Request</span>
        </button>
      </div>

      {/* ── WORKSPACE (LIST + CONVERSATION) ── */}
      <div className={`support-workspace ${selectedTicketId ? "support-workspace--detail-open" : ""}`}>
        {/* LEFT COLUMN: REQUEST LIST */}
        <div className="support-list-pane">
          {/* Filters */}
          <div className="support-filter-bar">
            {["All", "Open", "In Progress", "Resolved"].map((filter) => (
              <button
                key={filter}
                className={`support-filter-pill ${activeFilter === filter ? "support-filter-pill--active" : ""}`}
                onClick={() => setActiveFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>

          {/* Ticket List */}
          <div className="support-tickets-scroll">
            {loadingTickets ? (
              <div className="support-loading-state">
                <div className="support-spinner" />
                <span>Loading support requests...</span>
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="support-empty-state">
                <div className="support-empty-icon">💬</div>
                <h3>No support requests found</h3>
                <p>
                  {activeFilter === "All"
                    ? "Have a question or running into an issue? Click '+ New Request' above."
                    : `No support requests matching status "${activeFilter}".`}
                </p>
              </div>
            ) : (
              filteredTickets.map((ticket) => {
                const isActive = ticket.id === selectedTicketId;
                return (
                  <div
                    key={ticket.id}
                    className={`support-ticket-item ${isActive ? "support-ticket-item--active" : ""}`}
                    onClick={() => {
                      setSelectedTicketId(ticket.id);
                      setSearchParams({ ticket: ticket.id });
                    }}
                  >
                    <div className="ticket-item-top">
                      <h4 className="ticket-item-subject">{ticket.subject}</h4>
                      {renderStatusBadge(ticket.status)}
                    </div>
                    <p className="ticket-item-preview">
                      {ticket.lastMessageText || ticket.subject}
                    </p>
                    <div className="ticket-item-foot">
                      <span className="ticket-item-id">#{ticket.ticketId || "SUP"}</span>
                      <span className="ticket-item-time">{formatTime(ticket.updatedAt)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: CONVERSATION PANE */}
        <div className="support-conversation-pane">
          {selectedTicket ? (
            <>
              {/* Conversation Top Header */}
              <div className="support-conv-header">
                <button
                  className="support-conv-back-btn"
                  onClick={() => setSelectedTicketId(null)}
                  title="Back to list"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 19 5 12 12 5" />
                  </svg>
                </button>
                <div className="support-conv-title-box">
                  <h3 className="support-conv-subject">{selectedTicket.subject}</h3>
                  <div className="support-conv-meta">
                    <span className="support-conv-id">#{selectedTicket.ticketId}</span>
                    <span className="support-conv-dot">•</span>
                    <span className="support-conv-time">Opened {formatTime(selectedTicket.createdAt)}</span>
                  </div>
                </div>
                <div className="support-conv-header-status">
                  {renderStatusBadge(selectedTicket.status)}
                </div>
              </div>

              {/* Messages Area */}
              <div className="support-messages-scroll">
                {loadingMessages ? (
                  <div className="support-loading-state">
                    <div className="support-spinner" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="support-empty-state">
                    <p>No messages in this conversation yet.</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isUser = msg.senderRole === "user";
                    return (
                      <div
                        key={msg.id}
                        className={`support-msg-bubble-wrap ${isUser ? "support-msg-wrap--user" : "support-msg-wrap--admin"}`}
                      >
                        {!isUser && (
                          <div className="support-admin-avatar">
                            <span>A</span>
                          </div>
                        )}
                        {isUser && (
                          <div className="support-user-avatar">
                            <UserAvatar user={user} profile={profile} size={32} />
                          </div>
                        )}
                        <div className={`support-msg-card ${isUser ? "support-msg-card--user" : "support-msg-card--admin"}`}>
                          <div className="support-msg-header">
                            <span className="support-msg-sender">
                              {isUser ? (profile?.displayName || user?.displayName || "DELL") : "Admin Support"}
                            </span>
                            <span className="support-msg-time">{formatTime(msg.createdAt)}</span>
                          </div>

                          {/* Message Text */}
                          <div className="support-msg-text">{msg.text}</div>

                          {/* Message Attachment */}
                          {msg.attachment && (
                            <div className="support-msg-attachment">
                              <div className="att-file-icon">📄</div>
                              <div className="att-file-info">
                                <a
                                  href={msg.attachment.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="att-file-name"
                                >
                                  {msg.attachment.name}
                                </a>
                                {msg.attachment.fileSize && (
                                  <span className="att-file-size">
                                    {Math.round(msg.attachment.fileSize / 1024)} KB
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply Composer */}
              <form className="support-composer-area" onSubmit={handleSendReply}>
                {replyFile && (
                  <div className="support-composer-attachment-preview">
                    <span>📎 {replyFile.name}</span>
                    <button type="button" onClick={() => setReplyFile(null)}>×</button>
                  </div>
                )}
                <div className="support-composer-row">
                  <input
                    type="file"
                    ref={replyFileInputRef}
                    style={{ display: "none" }}
                    onChange={(e) => {
                      if (e.target.files?.[0]) setReplyFile(e.target.files[0]);
                    }}
                  />
                  <button
                    type="button"
                    className="support-composer-clip-btn"
                    onClick={() => replyFileInputRef.current?.click()}
                    title="Attach file"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                  </button>
                  <input
                    type="text"
                    className="support-composer-input"
                    placeholder={
                      selectedTicket.status === "Closed"
                        ? "This request is closed."
                        : "Type your reply..."
                    }
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    disabled={selectedTicket.status === "Closed" || replying}
                  />
                  <button
                    type="submit"
                    className="support-composer-send-btn"
                    disabled={(!replyText.trim() && !replyFile) || selectedTicket.status === "Closed" || replying}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                    <span>Send</span>
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="support-no-selection">
              <div className="support-no-selection-icon">🎧</div>
              <h3>Select a support request</h3>
              <p>Choose a request from the sidebar or submit a new request to get assistance.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── NEW SUPPORT REQUEST MODAL ── */}
      <Modal
        open={newModalOpen}
        onClose={() => {
          if (!submittingNew) setNewModalOpen(false);
        }}
        title="Create Support Request"
      >
        <form onSubmit={handleCreateRequest} className="support-new-form">
          <div className="modal-field">
            <label className="modal-label">Subject *</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g., Unable to upload resume"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              required
            />
          </div>

          <div className="modal-field" style={{ marginTop: 14 }}>
            <label className="modal-label">Message *</label>
            <textarea
              className="input-field"
              rows={4}
              placeholder="Describe the issue or question in detail..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              required
              style={{ resize: "vertical", minHeight: 90 }}
            />
          </div>

          <div className="modal-field" style={{ marginTop: 14 }}>
            <label className="modal-label">Attachment (Optional)</label>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={(e) => {
                if (e.target.files?.[0]) setNewFile(e.target.files[0]);
              }}
            />
            <div className="support-file-picker-row">
              <button
                type="button"
                className="support-file-picker-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                📎 {newFile ? "Change file" : "Choose file"}
              </button>
              {newFile && (
                <span className="support-file-picker-name">
                  {newFile.name} ({(newFile.size / 1024).toFixed(1)} KB)
                </span>
              )}
            </div>
          </div>

          {newError && <p className="support-modal-error">{newError}</p>}

          <div className="modal-actions" style={{ marginTop: 22 }}>
            <button
              type="button"
              className="modal-btn modal-btn--secondary"
              onClick={() => setNewModalOpen(false)}
              disabled={submittingNew}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="modal-btn modal-btn--primary"
              disabled={submittingNew || !newSubject.trim() || !newMessage.trim()}
            >
              {submittingNew ? "Sending..." : "Send Request"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
