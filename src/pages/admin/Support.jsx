import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  subscribeAllTickets,
  subscribeTicketMessages,
  addTicketMessage,
  updateTicketStatus,
  markTicketRead,
  uploadSupportAttachment,
} from "../../services/firestore";
import UserAvatar from "../../components/UserAvatar";
import "./Support.css";

export default function AdminSupport() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [replyText, setReplyText] = useState("");
  const [replyFile, setReplyFile] = useState(null);
  const [replying, setReplying] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const messagesEndRef = useRef(null);
  const replyFileInputRef = useRef(null);

  // 1. Subscribe to all support tickets
  useEffect(() => {
    setLoadingTickets(true);
    const unsub = subscribeAllTickets((data) => {
      setTickets(data);
      setLoadingTickets(false);
    });
    return () => unsub?.();
  }, []);

  // Sync selected ticket from searchParams or default
  useEffect(() => {
    const paramTicket = searchParams.get("ticket");
    if (paramTicket && tickets.some((t) => t.id === paramTicket)) {
      setSelectedTicketId(paramTicket);
    } else if (!selectedTicketId && tickets.length > 0) {
      if (window.innerWidth >= 768) {
        setSelectedTicketId(tickets[0].id);
      }
    }
  }, [tickets, searchParams]);

  // 2. Subscribe to messages when selected ticket changes
  useEffect(() => {
    if (!selectedTicketId) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);

    // Mark as read for admin
    markTicketRead(selectedTicketId, "admin");

    const unsub = subscribeTicketMessages(selectedTicketId, (msgs) => {
      setMessages(msgs);
      setLoadingMessages(false);
    });

    return () => unsub?.();
  }, [selectedTicketId]);

  // Scroll to bottom of conversation
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const selectedTicket = tickets.find((t) => t.id === selectedTicketId) || null;

  // Calculate KPI counts dynamically from real tickets
  const kpiTotal = tickets.length;
  const kpiOpen = tickets.filter((t) => (t.status || "Open").toLowerCase() === "open").length;
  const kpiProgress = tickets.filter((t) => (t.status || "").toLowerCase() === "in progress").length;
  const kpiResolved = tickets.filter((t) => (t.status || "").toLowerCase() === "resolved").length;

  // Filter & search ticket list
  const filteredTickets = tickets.filter((t) => {
    // Filter check
    if (activeFilter !== "All" && (t.status || "").toLowerCase() !== activeFilter.toLowerCase()) {
      return false;
    }
    // Search check
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchSubject = (t.subject || "").toLowerCase().includes(q);
      const matchId = (t.ticketId || "").toLowerCase().includes(q);
      const matchUser = (t.userName || "").toLowerCase().includes(q) || (t.userEmail || "").toLowerCase().includes(q);
      return matchSubject || matchId || matchUser;
    }
    return true;
  });

  // Handle Status Change
  async function handleStatusChange(newStatus) {
    if (!selectedTicketId || updatingStatus) return;
    setUpdatingStatus(true);
    try {
      const res = await updateTicketStatus(selectedTicketId, newStatus, user?.uid || "admin");
      if (res.error) {
        alert("Failed to update status: " + res.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingStatus(false);
    }
  }

  // Handle Send Reply
  async function handleAdminSendReply(e) {
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
        senderId: user?.uid || "admin",
        senderRole: "admin",
        senderName: "Admin Support",
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
      console.error("Failed to send admin reply:", err);
    } finally {
      setReplying(false);
    }
  }

  // Render Status Badge
  function renderStatusBadge(status) {
    const s = (status || "Open").toLowerCase();
    let badgeClass = "admin-status-badge--open";
    if (s === "in progress") badgeClass = "admin-status-badge--progress";
    if (s === "resolved") badgeClass = "admin-status-badge--resolved";
    if (s === "closed") badgeClass = "admin-status-badge--closed";

    return <span className={`admin-status-badge ${badgeClass}`}>{status || "Open"}</span>;
  }

  // Format timestamp
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
    <div className="admin-support-container">
      {/* ── HEADER ── */}
      <div className="admin-support-header">
        <div className="admin-support-titles">
          <h1 className="admin-support-title">Support</h1>
          <p className="admin-support-subtitle">Manage and respond to user support requests.</p>
        </div>

        {/* Search bar */}
        <div className="admin-support-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search by ID, subject, or user..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="admin-support-kpis">
        <div className="admin-kpi-card">
          <div className="admin-kpi-icon admin-kpi-icon--total">📊</div>
          <div className="admin-kpi-info">
            <span className="admin-kpi-value">{kpiTotal}</span>
            <span className="admin-kpi-label">Total Requests</span>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-icon admin-kpi-icon--open">📥</div>
          <div className="admin-kpi-info">
            <span className="admin-kpi-value">{kpiOpen}</span>
            <span className="admin-kpi-label">Open</span>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-icon admin-kpi-icon--progress">⚡</div>
          <div className="admin-kpi-info">
            <span className="admin-kpi-value">{kpiProgress}</span>
            <span className="admin-kpi-label">In Progress</span>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-icon admin-kpi-icon--resolved">✅</div>
          <div className="admin-kpi-info">
            <span className="admin-kpi-value">{kpiResolved}</span>
            <span className="admin-kpi-label">Resolved</span>
          </div>
        </div>
      </div>

      {/* ── WORKSPACE ── */}
      <div className={`admin-support-workspace ${selectedTicketId ? "admin-workspace--detail-open" : ""}`}>
        {/* LEFT: REQUEST LIST */}
        <div className="admin-support-list-pane">
          {/* Filters */}
          <div className="admin-support-filters">
            {["All", "Open", "In Progress", "Resolved", "Closed"].map((filter) => (
              <button
                key={filter}
                className={`admin-filter-pill ${activeFilter === filter ? "admin-filter-pill--active" : ""}`}
                onClick={() => setActiveFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="admin-tickets-scroll">
            {loadingTickets ? (
              <div className="admin-support-loading">
                <div className="admin-support-spinner" />
                <span>Loading tickets...</span>
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="admin-support-empty">
                <p>No support requests found.</p>
              </div>
            ) : (
              filteredTickets.map((ticket) => {
                const isActive = ticket.id === selectedTicketId;
                return (
                  <div
                    key={ticket.id}
                    className={`admin-ticket-item ${isActive ? "admin-ticket-item--active" : ""} ${ticket.unreadAdmin ? "admin-ticket-item--unread" : ""}`}
                    onClick={() => {
                      setSelectedTicketId(ticket.id);
                      setSearchParams({ ticket: ticket.id });
                    }}
                  >
                    <div className="admin-ticket-item-top">
                      <h4 className="admin-ticket-subject">{ticket.subject}</h4>
                      {renderStatusBadge(ticket.status)}
                    </div>
                    <div className="admin-ticket-meta">
                      <span className="admin-ticket-id">#{ticket.ticketId || "SUP"}</span>
                      <span className="admin-ticket-user">{ticket.userName || ticket.userEmail || "User"}</span>
                    </div>
                    <div className="admin-ticket-foot">
                      <span className="admin-ticket-time">{formatTime(ticket.updatedAt)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT: CONVERSATION PANE */}
        <div className="admin-support-conv-pane">
          {selectedTicket ? (
            <>
              {/* Header with status dropdown */}
              <div className="admin-conv-header">
                <button
                  className="admin-conv-back-btn"
                  onClick={() => setSelectedTicketId(null)}
                  title="Back to list"
                >
                  ← Support
                </button>
                <div className="admin-conv-user-info">
                  <h3 className="admin-conv-subject">{selectedTicket.subject}</h3>
                  <div className="admin-conv-subtext">
                    <span className="admin-conv-id">#{selectedTicket.ticketId}</span>
                    <span>•</span>
                    <span className="admin-conv-user">{selectedTicket.userName} ({selectedTicket.userEmail || "Student"})</span>
                  </div>
                </div>

                {/* Visible Status Dropdown Control */}
                <div className="admin-conv-status-control">
                  <label className="admin-status-label">Status:</label>
                  <select
                    className="admin-status-select"
                    value={selectedTicket.status || "Open"}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    disabled={updatingStatus}
                  >
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>

              {/* Messages Scroll Area */}
              <div className="admin-messages-scroll">
                {loadingMessages ? (
                  <div className="admin-support-loading">
                    <div className="admin-support-spinner" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="admin-support-empty">No messages yet.</div>
                ) : (
                  messages.map((msg) => {
                    const isAdmin = msg.senderRole === "admin";
                    return (
                      <div
                        key={msg.id}
                        className={`admin-msg-bubble-wrap ${isAdmin ? "admin-msg-wrap--admin" : "admin-msg-wrap--user"}`}
                      >
                        {!isAdmin ? (
                          <div className="admin-user-bubble-avatar">
                            <span>{msg.senderName?.charAt(0) || "U"}</span>
                          </div>
                        ) : (
                          <div className="admin-support-bubble-avatar">
                            <span>A</span>
                          </div>
                        )}

                        <div className={`admin-msg-card ${isAdmin ? "admin-msg-card--admin" : "admin-msg-card--user"}`}>
                          <div className="admin-msg-header">
                            <span className="admin-msg-sender">{isAdmin ? "Admin Support" : msg.senderName || selectedTicket.userName}</span>
                            <span className="admin-msg-time">{formatTime(msg.createdAt)}</span>
                          </div>

                          <div className="admin-msg-text">{msg.text}</div>

                          {msg.attachment && (
                            <div className="admin-msg-attachment">
                              <span className="admin-att-icon">📄</span>
                              <div className="admin-att-info">
                                <a
                                  href={msg.attachment.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="admin-att-name"
                                >
                                  {msg.attachment.name}
                                </a>
                                {msg.attachment.fileSize && (
                                  <span className="admin-att-size">{Math.round(msg.attachment.fileSize / 1024)} KB</span>
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
              <form className="admin-composer-area" onSubmit={handleAdminSendReply}>
                {replyFile && (
                  <div className="admin-composer-attachment-preview">
                    <span>📎 {replyFile.name}</span>
                    <button type="button" onClick={() => setReplyFile(null)}>×</button>
                  </div>
                )}
                <div className="admin-composer-row">
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
                    className="admin-composer-clip-btn"
                    onClick={() => replyFileInputRef.current?.click()}
                    title="Attach file"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                  </button>
                  <input
                    type="text"
                    className="admin-composer-input"
                    placeholder="Type your reply to the user..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    disabled={replying}
                  />
                  <button
                    type="submit"
                    className="admin-composer-send-btn"
                    disabled={(!replyText.trim() && !replyFile) || replying}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                    <span>Send Reply</span>
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="admin-support-no-selection">
              <div className="admin-no-selection-icon">🎧</div>
              <h3>Select a support ticket</h3>
              <p>Select a ticket from the left panel to review messages and respond.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
