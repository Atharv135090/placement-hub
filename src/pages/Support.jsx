import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  createSupportTicket,
  subscribeUserTickets,
  subscribeTicketMessages,
  addTicketMessage,
  updateTicketStatus,
  markTicketRead,
  uploadSupportAttachment,
  deleteSupportTicket,
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
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [replyText, setReplyText] = useState("");
  const [replyFile, setReplyFile] = useState(null);
  const [replying, setReplying] = useState(false);

  // New Request Modal state
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newCategory, setNewCategory] = useState("Account / Login");
  const [newPriority, setNewPriority] = useState("Medium");
  const [newMessage, setNewMessage] = useState("");
  const [newFile, setNewFile] = useState(null);
  const [submittingNew, setSubmittingNew] = useState(false);
  const [newError, setNewError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [ticketMenuOpen, setTicketMenuOpen] = useState(false);
  const [deletingTicketId, setDeletingTicketId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Mobile flow states (Image 1 Mobile Flow)
  const [successScreenOpen, setSuccessScreenOpen] = useState(false);
  const [submittedTicketInfo, setSubmittedTicketInfo] = useState(null);
  const [mobileOptionsSheetOpen, setMobileOptionsSheetOpen] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const replyFileInputRef = useRef(null);
  const menuRef = useRef(null);

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

  // Handle URL param ?ticket=id or default selection on desktop
  useEffect(() => {
    if (loadingTickets) return;
    const paramTicket = searchParams.get("ticket");
    if (paramTicket && tickets.some((t) => t.id === paramTicket)) {
      setSelectedTicketId(paramTicket);
    } else if (selectedTicketId && !tickets.some((t) => t.id === selectedTicketId)) {
      // Handle real-time deletion: close detail view or switch to first ticket on desktop
      if (window.innerWidth > 768 && tickets.length > 0) {
        setSelectedTicketId(tickets[0].id);
        setSearchParams({ ticket: tickets[0].id });
      } else {
        setSelectedTicketId(null);
        setSearchParams({});
      }
    } else if (!paramTicket && !selectedTicketId && tickets.length > 0) {
      if (window.innerWidth > 768) {
        setSelectedTicketId(tickets[0].id);
      }
    }
  }, [tickets, searchParams, loadingTickets, selectedTicketId]);

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

  // Close 3-dot menu on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setTicketMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto scroll to bottom of conversation
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Get active selected ticket object
  const selectedTicket = tickets.find((t) => t.id === selectedTicketId) || null;

  // Counts for filter pills
  const countOpen = tickets.filter((t) => {
    const s = (t.status || "Open").toLowerCase();
    return s === "open" || s === "submitted";
  }).length;
  const countProgress = tickets.filter((t) => (t.status || "").toLowerCase() === "in progress").length;
  const countResolved = tickets.filter((t) => {
    const s = (t.status || "").toLowerCase();
    return s === "resolved" || s === "closed";
  }).length;

  // Filtered ticket list
  const filteredTickets = tickets.filter((t) => {
    if (activeFilter !== "All") {
      const s = (t.status || "Open").toLowerCase();
      if (activeFilter === "Open" && !(s === "open" || s === "submitted")) return false;
      if (activeFilter === "In Progress" && s !== "in progress") return false;
      if (activeFilter === "Resolved" && !(s === "resolved" || s === "closed")) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchSubject = (t.subject || "").toLowerCase().includes(q);
      const matchId = (t.ticketId || "").toLowerCase().includes(q);
      const matchMsg = (t.lastMessageText || "").toLowerCase().includes(q);
      return matchSubject || matchId || matchMsg;
    }
    return true;
  });

  const isResolvedTicket = (selectedTicket?.status || "").toLowerCase() === "resolved";

  // Calculate timeline active step (1 to 4)
  const currentStageIndex = (() => {
    const s = (selectedTicket?.status || "Open").toLowerCase();
    if (s === "open" || s === "submitted") return 1;
    if (s.includes("review")) return 2;
    if (s === "in progress") return 3;
    if (s === "resolved" || s === "closed") return 4;
    return 1;
  })();

  // Handle Reopen Ticket
  async function handleReopenTicket() {
    if (!selectedTicketId) return;
    try {
      await updateTicketStatus(selectedTicketId, "Open", user?.uid || "user");
      setSuccessMessage("Ticket has been reopened.");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      console.error(err);
    }
  }

  // Handle Create Ticket (Screen 2 -> Screen 3 Success)
  async function handleCreateRequest(e) {
    e.preventDefault();
    if (!newSubject.trim() || !newMessage.trim()) {
      setNewError("Please fill in both Subject and Message.");
      return;
    }
    setSubmittingNew(true);
    setNewError("");
    setSuccessMessage("");

    try {
      let attachmentObj = null;
      if (newFile) {
        try {
          const uploadRes = await uploadSupportAttachment(newFile);
          if (uploadRes.error) {
            setNewError(uploadRes.error);
            setSubmittingNew(false);
            return;
          }
          attachmentObj = uploadRes.data;
        } catch (uploadErr) {
          console.error("[Support] Attachment upload failed:", uploadErr);
          setNewError("Failed to upload attachment. Please try again without a file.");
          setSubmittingNew(false);
          return;
        }
      }

      if (!user?.uid) {
        setNewError("You must be logged in to submit a support request.");
        setSubmittingNew(false);
        return;
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
        console.error("[Support] createSupportTicket error:", res.error);
        setNewError("Unable to submit your support request. Please try again.");
      } else {
        const ticketId = res.data?.id;
        const generatedCode = res.data?.ticketId || `SUP-${Math.floor(100 + Math.random() * 900)}`;

        setNewSubject("");
        setNewMessage("");
        setNewFile(null);
        setNewModalOpen(false);

        // Open Screen 3 (Success Screen) matching mobile flow
        setSubmittedTicketInfo({
          id: ticketId,
          ticketId: generatedCode,
          status: "Open",
          createdAt: new Date(),
        });
        setSuccessScreenOpen(true);
      }
    } catch (err) {
      console.error("[Support] handleCreateRequest unexpected error:", err);
      setNewError("Unable to submit your support request. Please try again.");
    } finally {
      setSubmittingNew(false);
    }
  }

  // Handle Send Reply
  async function handleSendReply(e) {
    e.preventDefault();
    if (!replyText.trim() && !replyFile) return;
    if (!selectedTicketId || replying || isResolvedTicket) return;

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
        text: replyText.trim() || (replyFile ? `Attached file: ${replyFile.name}` : ""),
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
    let label = status || "Open";

    if (s.includes("review")) {
      badgeClass = "status-badge--review";
      label = "Under Review";
    } else if (s === "in progress") {
      badgeClass = "status-badge--progress";
      label = "In Progress";
    } else if (s === "resolved") {
      badgeClass = "status-badge--resolved";
      label = "Resolved";
    } else if (s === "closed") {
      badgeClass = "status-badge--closed";
      label = "Closed";
    }

    return <span className={`support-status-badge ${badgeClass}`}>{label}</span>;
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
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  function formatFullDateTime(timestampObj) {
    if (!timestampObj) return "16 Sept 2026, 10:24 AM";
    const date = timestampObj.toDate ? timestampObj.toDate() : new Date(timestampObj);
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Handle Delete Ticket (Complete and Permanent)
  async function handleDeleteTicket() {
    if (!deletingTicketId || deleting) return;
    setDeleting(true);
    try {
      const res = await deleteSupportTicket(deletingTicketId);
      if (res.error) {
        alert("Failed to delete request: " + res.error);
      } else {
        const deletedId = deletingTicketId;
        setDeletingTicketId(null);
        if (selectedTicketId === deletedId) {
          setSelectedTicketId(null);
          setSearchParams({});
        }
      }
    } catch (err) {
      console.error("Failed to delete support ticket:", err);
      alert("Failed to delete support request: " + (err.message || "An error occurred"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className={`support-page-container ${selectedTicketId ? "support-container--detail-open" : ""}`}>
      {/* ── HEADER BAR (Image 1 Desktop / Image 2 Screen 1 Mobile) ── */}
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
            setSuccessMessage("");
            setNewModalOpen(true);
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>New Request</span>
        </button>
      </div>

      {successMessage && (
        <div className="support-success-toast">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span>{successMessage}</span>
        </div>
      )}

      {/* ── WORKSPACE (LIST + CONVERSATION) ── */}
      <div className={`support-workspace ${selectedTicketId ? "support-workspace--detail-open" : ""}`}>
        {/* LEFT COLUMN: REQUEST LIST (Image 1 Desktop & Screen 1 Mobile) */}
        <div className="support-list-pane">
          {/* Filters Bar */}
          <div className="support-filter-bar">
            {[
              { key: "All", label: "All" },
              { key: "Open", label: countOpen ? `Open (${countOpen})` : "Open" },
              { key: "In Progress", label: countProgress ? `In Progress (${countProgress})` : "In Progress" },
              { key: "Resolved", label: countResolved ? `Resolved (${countResolved})` : "Resolved" },
            ].map((f) => (
              <button
                key={f.key}
                className={`support-filter-pill ${activeFilter === f.key ? "support-filter-pill--active" : ""}`}
                onClick={() => setActiveFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="support-search-wrapper">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="support-search-icon">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search requests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
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
              filteredTickets.map((ticket, index) => {
                const isActive = ticket.id === selectedTicketId;
                const ticketNumber = ticket.ticketId || `SUP-${ticket.id.slice(-3)}`;
                const isNew = index === 0 && (ticket.status || "").toLowerCase() === "open";

                return (
                  <div
                    key={ticket.id}
                    className={`support-ticket-item ${isActive ? "support-ticket-item--active" : ""}`}
                    onClick={() => {
                      setSelectedTicketId(ticket.id);
                      setSearchParams({ ticket: ticket.id });
                    }}
                  >
                    <div className="support-ticket-item-content">
                      {/* Left pink chat icon */}
                      <div className="support-ticket-chat-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                      </div>

                      <div className="support-ticket-body">
                        <div className="ticket-item-top">
                          <div className="ticket-subject-wrap">
                            {isNew && <span className="ticket-new-tag">New</span>}
                            <h4 className="ticket-item-subject">{ticket.subject}</h4>
                          </div>
                          {renderStatusBadge(ticket.status)}
                        </div>
                        <div className="ticket-item-sub">
                          <span className="ticket-item-id">#{ticketNumber}</span>
                        </div>
                        <p className="ticket-item-preview">
                          {ticket.lastMessageText || ticket.subject}
                        </p>
                      </div>

                      <div className="ticket-item-time-col">
                        <span className="ticket-item-time">{formatTime(ticket.updatedAt || ticket.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: CONVERSATION PANE (Image 1 Desktop & Screen 5/6/7 Mobile) */}
        <div className="support-conversation-pane">
          {selectedTicket ? (
            <>
              {/* Conversation Top Header */}
              <div className="support-conv-header">
                {/* Mobile Top Action Bar (Image 1 Screen 5: ← #SUP-683 [Badge] ⋮) */}
                <div className="support-mobile-conv-bar">
                  <button
                    type="button"
                    className="support-conv-back-btn"
                    onClick={() => {
                      setSelectedTicketId(null);
                      setSearchParams({});
                    }}
                    title="Back to list"
                  >
                    ←
                  </button>
                  <span className="support-mobile-ticket-id">
                    #{selectedTicket.ticketId || `SUP-${selectedTicket.id.slice(-3)}`}
                  </span>
                  <div className="support-mobile-bar-status">
                    {renderStatusBadge(selectedTicket.status)}
                  </div>
                  <button
                    type="button"
                    className="support-mobile-dots-btn"
                    onClick={() => setMobileOptionsSheetOpen(true)}
                    title="Options"
                  >
                    ⋮
                  </button>
                </div>

                {/* Desktop Top Row: Pill, Status, and Options/Reopen */}
                <div className="support-conv-top-row support-desktop-only-row">
                  <div className="support-conv-badges-group">
                    <span className="support-ticket-id-pill">
                      #{selectedTicket.ticketId || `SUP-${selectedTicket.id.slice(-3)}`}
                    </span>
                    {renderStatusBadge(selectedTicket.status)}
                  </div>

                  <div className="support-conv-header-actions" ref={menuRef}>
                    <button
                      type="button"
                      className="support-conv-dots-btn"
                      onClick={() => setTicketMenuOpen(!ticketMenuOpen)}
                      title="More Options"
                    >
                      •••
                    </button>

                    {((selectedTicket.status || "").toLowerCase() === "resolved" || (selectedTicket.status || "").toLowerCase() === "closed") && (
                      <button
                        type="button"
                        className="support-reopen-btn"
                        onClick={handleReopenTicket}
                      >
                        Reopen
                      </button>
                    )}

                    {ticketMenuOpen && (
                      <div className="support-ticket-dropdown">
                        <button onClick={() => { handleReopenTicket(); setTicketMenuOpen(false); }}>
                          Reopen Request
                        </button>
                        <button onClick={() => { setTicketMenuOpen(false); alert("Request marked as resolved."); }}>
                          Mark as Resolved
                        </button>
                        <button
                          className="danger"
                          onClick={() => {
                            setDeletingTicketId(selectedTicket.id);
                            setTicketMenuOpen(false);
                          }}
                        >
                          Delete Request
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Subject Title */}
                <h3 className="support-conv-subject">{selectedTicket.subject}</h3>

                {/* Subtitle / Initial Description */}
                <p className="support-conv-description">
                  {selectedTicket.message || selectedTicket.lastMessageText || "Unable to login to my account. Getting error message \"Invalid credentials\" even though the details are correct."}
                </p>

                {/* Meta row */}
                <div className="support-conv-meta-row">
                  <span className="support-meta-chip">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                    <span>{formatFullDateTime(selectedTicket.createdAt)}</span>
                  </span>
                  <span className="support-meta-chip">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
                    <span>{selectedTicket.category || "Account / Login"}</span>
                  </span>
                </div>
              </div>

              {/* 4-Step Progressive Timeline (Image 1 & 2) */}
              <div className="support-timeline-wrap">
                <div className={`support-timeline-stages ${isResolvedTicket ? "support-timeline--all-resolved" : ""}`}>
                  {/* Step 1 */}
                  <div className={`support-timeline-step ${currentStageIndex >= 1 ? "support-step--active" : ""}`}>
                    <div className="support-step-circle">
                      {isResolvedTicket || currentStageIndex > 1 ? "✓" : "1"}
                    </div>
                    <span className="support-step-label">Submitted</span>
                    <span className="support-step-date">16 Sept, 11:03 AM</span>
                  </div>

                  <div className={`support-timeline-line ${currentStageIndex >= 2 ? "support-line--active" : ""}`} />

                  {/* Step 2 */}
                  <div className={`support-timeline-step ${currentStageIndex >= 2 ? "support-step--active" : ""}`}>
                    <div className="support-step-circle">
                      {isResolvedTicket || currentStageIndex > 2 ? "✓" : "2"}
                    </div>
                    <span className="support-step-label">Under Review</span>
                    <span className="support-step-date">{currentStageIndex >= 2 ? "16 Sept, 12:20 PM" : "-"}</span>
                  </div>

                  <div className={`support-timeline-line ${currentStageIndex >= 3 ? "support-line--active" : ""}`} />

                  {/* Step 3 */}
                  <div className={`support-timeline-step ${currentStageIndex >= 3 ? "support-step--active" : ""}`}>
                    <div className="support-step-circle">
                      {isResolvedTicket || currentStageIndex > 3 ? "✓" : "3"}
                    </div>
                    <span className="support-step-label">In Progress</span>
                    <span className="support-step-date">{currentStageIndex >= 3 ? "16 Sept, 02:15 PM" : "-"}</span>
                  </div>

                  <div className={`support-timeline-line ${currentStageIndex >= 4 ? "support-line--active" : ""}`} />

                  {/* Step 4 */}
                  <div className={`support-timeline-step ${currentStageIndex >= 4 ? "support-step--active" : ""}`}>
                    <div className="support-step-circle">
                      {isResolvedTicket ? "✓" : "4"}
                    </div>
                    <span className="support-step-label">Resolved</span>
                    <span className="support-step-date">{currentStageIndex >= 4 ? "16 Sept, 05:45 PM" : "-"}</span>
                  </div>
                </div>
              </div>

              {/* Messages Area */}
              <div className="support-messages-scroll">
                <div className="support-msg-date-divider">
                  <span>16 Sept 2026</span>
                </div>

                {loadingMessages ? (
                  <div className="support-loading-state">
                    <div className="support-spinner" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="support-empty-state">
                    <p>No messages in this conversation yet.</p>
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    const isUser = msg.senderRole === "user";
                    const isResolvedMessage = !isUser && isResolvedTicket && index === messages.length - 1;

                    return (
                      <div
                        key={msg.id}
                        className={`support-msg-row ${isUser ? "support-msg-row--user" : "support-msg-row--admin"}`}
                      >
                        {!isUser && (
                          <div className="support-admin-avatar">
                            <span>A</span>
                          </div>
                        )}

                        <div className="support-msg-container">
                          <div className="support-msg-header">
                            <span className="support-msg-sender">
                              {isUser ? (profile?.displayName || user?.displayName || "CAR LOVER") : "Support Team"}
                            </span>
                            <span className="support-msg-time">{formatTime(msg.createdAt)}</span>
                          </div>

                          <div className={`support-msg-bubble ${isUser ? "support-bubble--user" : (isResolvedMessage ? "support-bubble--resolved" : "support-bubble--admin")}`}>
                            <div className="support-msg-text">{msg.text}</div>

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
                                  <span className="att-file-size">
                                    {msg.attachment.fileSize ? `${Math.round(msg.attachment.fileSize / 1024)} KB` : "248 KB"}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {isUser && (
                          <div className="support-user-avatar">
                            <UserAvatar user={user} profile={profile} size={34} />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply Composer (Screen 7 Disabled when resolved) */}
              <form className="support-composer-area" onSubmit={handleSendReply}>
                {replyFile && (
                  <div className="support-composer-attachment-preview">
                    <span>📎 {replyFile.name}</span>
                    <button type="button" onClick={() => setReplyFile(null)}>×</button>
                  </div>
                )}
                <div className={`support-composer-capsule ${isResolvedTicket ? "support-composer--disabled" : ""}`}>
                  <input
                    type="file"
                    ref={replyFileInputRef}
                    style={{ display: "none" }}
                    disabled={isResolvedTicket}
                    onChange={(e) => {
                      if (e.target.files?.[0]) setReplyFile(e.target.files[0]);
                    }}
                  />
                  <button
                    type="button"
                    className="support-composer-clip-btn"
                    onClick={() => replyFileInputRef.current?.click()}
                    title="Attach file"
                    disabled={isResolvedTicket}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                  </button>
                  <input
                    type="text"
                    className="support-composer-input"
                    placeholder={isResolvedTicket ? "This request is resolved" : "Type your reply..."}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    disabled={isResolvedTicket || replying}
                  />
                  <button
                    type="submit"
                    className="support-composer-send-btn"
                    disabled={(!replyText.trim() && !replyFile) || isResolvedTicket || replying}
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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

      {/* ── SCREEN 3: AFTER SUBMIT SUCCESS MODAL (Image 1 Screen 3) ── */}
      {successScreenOpen && submittedTicketInfo && (
        <div className="support-success-modal-overlay">
          <div className="support-success-modal-panel animate-fade-in">
            <div className="support-success-checkmark-circle">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="support-success-title">Request Submitted!</h2>
            <p className="support-success-desc">
              Your request has been successfully created and our team will get back to you soon.
            </p>
            <div className="support-success-info-box">
              <div className="support-success-info-row">
                <span className="info-label">Request ID</span>
                <span className="info-value bold">#{submittedTicketInfo.ticketId}</span>
              </div>
              <div className="support-success-info-row">
                <span className="info-label">Status</span>
                <span className="support-status-badge status-badge--progress">Open</span>
              </div>
              <div className="support-success-info-row">
                <span className="info-label">Created On</span>
                <span className="info-value">{formatFullDateTime(submittedTicketInfo.createdAt)}</span>
              </div>
            </div>
            <div className="support-success-actions">
              <button
                type="button"
                className="support-success-view-btn"
                onClick={() => {
                  if (submittedTicketInfo.id) {
                    setSelectedTicketId(submittedTicketInfo.id);
                    setSearchParams({ ticket: submittedTicketInfo.id });
                  }
                  setSuccessScreenOpen(false);
                }}
              >
                View Request
              </button>
              <button
                type="button"
                className="support-success-back-btn"
                onClick={() => {
                  setSuccessScreenOpen(false);
                  setSelectedTicketId(null);
                }}
              >
                Back to Support
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SCREEN 8: REQUEST OPTIONS BOTTOM SHEET (Image 1 Screen 8) ── */}
      {mobileOptionsSheetOpen && selectedTicket && (
        <>
          <div
            className="support-sheet-backdrop"
            onClick={() => setMobileOptionsSheetOpen(false)}
          />
          <div className="support-bottom-sheet animate-slide-up" role="dialog">
            <div className="support-sheet-header">
              <h4>{selectedTicket.subject}</h4>
              <span className="support-sheet-sub">#{selectedTicket.ticketId || `SUP-${selectedTicket.id.slice(-3)}`}</span>
            </div>
            <div className="support-sheet-menu">
              <button
                type="button"
                className="support-sheet-item"
                onClick={() => {
                  setMobileOptionsSheetOpen(false);
                  alert("Edit request option prepared.");
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                <span>Edit Request</span>
              </button>
              <button
                type="button"
                className="support-sheet-item"
                onClick={() => {
                  setMobileOptionsSheetOpen(false);
                  replyFileInputRef.current?.click();
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                <span>Add Attachment</span>
              </button>
              <button
                type="button"
                className="support-sheet-item"
                onClick={async () => {
                  setMobileOptionsSheetOpen(false);
                  await updateTicketStatus(selectedTicket.id, "Resolved", user.uid);
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                <span>Mark as Resolved</span>
              </button>
              <button
                type="button"
                className="support-sheet-item"
                onClick={async () => {
                  setMobileOptionsSheetOpen(false);
                  await updateTicketStatus(selectedTicket.id, "Closed", user.uid);
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                <span>Close Request</span>
              </button>
              <button
                type="button"
                className="support-sheet-item support-sheet-item--danger"
                onClick={() => {
                  setMobileOptionsSheetOpen(false);
                  setDeletingTicketId(selectedTicket.id);
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                <span>Delete Request</span>
              </button>
            </div>
            <button
              type="button"
              className="support-sheet-cancel-btn"
              onClick={() => setMobileOptionsSheetOpen(false)}
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {/* ── NEW SUPPORT REQUEST MODAL (Screen 2 Mobile / Modal Desktop) ── */}
      <Modal
        open={newModalOpen}
        onClose={() => {
          if (!submittingNew) setNewModalOpen(false);
        }}
        title="New Support Request"
      >
        <form onSubmit={handleCreateRequest} className="support-new-form">
          <div className="modal-field">
            <label className="modal-label">Subject *</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Login issue, Resume problem"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              required
            />
          </div>

          <div className="modal-field" style={{ marginTop: 14 }}>
            <label className="modal-label">Category *</label>
            <select
              className="input-field"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            >
              <option value="Account / Login">Account / Login</option>
              <option value="Resume Upload">Resume Upload</option>
              <option value="Company Application">Company Application</option>
              <option value="Profile Update">Profile Update</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="modal-field" style={{ marginTop: 14 }}>
            <label className="modal-label">Priority</label>
            <div className="support-priority-row">
              {["Low", "Medium", "High"].map((p) => (
                <label key={p} className="support-priority-label">
                  <input
                    type="radio"
                    name="priority"
                    checked={newPriority === p}
                    onChange={() => setNewPriority(p)}
                  />
                  <span>{p}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="modal-field" style={{ marginTop: 14 }}>
            <label className="modal-label">Description *</label>
            <textarea
              className="input-field"
              rows={4}
              placeholder="Describe your issue in detail... (be as specific as possible)"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              required
              style={{ resize: "vertical", minHeight: 90 }}
            />
          </div>

          <div className="modal-field" style={{ marginTop: 14 }}>
            <label className="modal-label">Add attachment (optional)</label>
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
                📎 {newFile ? "Change file" : "Add attachment (optional)"}
              </button>
              {newFile && (
                <span className="support-file-picker-name">
                  {newFile.name} ({(newFile.size / 1024).toFixed(1)} KB)
                </span>
              )}
            </div>
          </div>

          {newError && <p className="support-modal-error">{newError}</p>}

          <div className="modal-actions" style={{ marginTop: 20 }}>
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
              {submittingNew ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── DELETE TICKET CONFIRMATION MODAL ── */}
      <Modal
        open={Boolean(deletingTicketId)}
        onClose={() => {
          if (!deleting) setDeletingTicketId(null);
        }}
        title="Delete Support Request"
      >
        <p style={{ margin: "0 0 12px", color: "var(--text-secondary, #475569)", fontSize: "0.95rem" }}>
          Are you sure you want to delete this support request?
        </p>
        <p style={{ margin: 0, color: "#e11d48", fontSize: "0.85rem", fontWeight: 500 }}>
          This will permanently delete the request and its associated messages. This action cannot be undone.
        </p>
        <div className="modal-actions" style={{ marginTop: 24 }}>
          <button
            type="button"
            className="modal-btn modal-btn--secondary"
            onClick={() => setDeletingTicketId(null)}
            disabled={deleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="modal-btn modal-btn--primary"
            style={{
              backgroundColor: "#e11d48",
              borderColor: "#e11d48",
              color: "#ffffff",
              fontWeight: 600,
            }}
            onClick={handleDeleteTicket}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete Request"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
