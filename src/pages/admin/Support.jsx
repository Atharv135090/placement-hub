import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  subscribeAllTickets,
  subscribeTicketMessages,
  addTicketMessage,
  updateTicketStatus,
  markTicketRead,
  uploadSupportAttachment,
  createSupportTicket,
  deleteTicketMessage,
  editTicketMessage,
  deleteSupportTicket,
} from "../../services/firestore";
import Modal from "../../components/Modal";
import "./Support.css";

// Predefined Quick Replies
const QUICK_REPLIES = [
  "We are looking into this issue.",
  "Please share more details.",
  "Please share a screenshot.",
  "This issue has been resolved.",
  "Let us know if you need further help.",
];

export default function AdminSupport() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tickets state
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Selected ticket and messages
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Composer state
  const [replyText, setReplyText] = useState("");
  const [replyFile, setReplyFile] = useState(null);
  const [replying, setReplying] = useState(false);
  const [composerMode, setComposerMode] = useState("reply"); // 'reply' | 'internal'
  const [quickRepliesDropdownOpen, setQuickRepliesDropdownOpen] = useState(false);

  // Status update state
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [selectedStatusStage, setSelectedStatusStage] = useState(1);

  // UI Menus & Accordions
  const [adminMessageMenuId, setAdminMessageMenuId] = useState(null);
  const [ticketOptionsMenuOpen, setTicketOptionsMenuOpen] = useState(false);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);

  // Edit/Delete message state
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingMessageText, setEditingMessageText] = useState("");
  const [deletingMessageId, setDeletingMessageId] = useState(null);
  const [deletingTicketId, setDeletingTicketId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Accordion open/close states
  const [openQuickReplies, setOpenQuickReplies] = useState(true);
  const [openRequestDetails, setOpenRequestDetails] = useState(true);
  const [openUserInfo, setOpenUserInfo] = useState(true);
  const [openAttachments, setOpenAttachments] = useState(true);
  const [openActivityLog, setOpenActivityLog] = useState(false);

  // Mobile Flow States (Image 2 Mobile Flow)
  const [mobileActiveTab, setMobileActiveTab] = useState("messages"); // 'messages' | 'details' | 'activity'
  const [mobileTicketActionsOpen, setMobileTicketActionsOpen] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [statusFeedbackModal, setStatusFeedbackModal] = useState({ open: false, status: "", ticketCode: "" });
  const [copiedTicketId, setCopiedTicketId] = useState(false);
  const [mobileMessageMenuId, setMobileMessageMenuId] = useState(null);
  const [filterStatusChecks, setFilterStatusChecks] = useState({
    Open: true,
    "Under Review": false,
    "In Progress": false,
    Resolved: false,
    Closed: false,
  });
  const [filterCategory, setFilterCategory] = useState("");
  const [filterUserQuery, setFilterUserQuery] = useState("");

  // New Request Modal state
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newCategory, setNewCategory] = useState("Account / Login");
  const [newPriority, setNewPriority] = useState("Medium");
  const [newDescription, setNewDescription] = useState("");
  const [newFile, setNewFile] = useState(null);
  const [submittingNew, setSubmittingNew] = useState(false);
  const [newError, setNewError] = useState("");

  const messagesEndRef = useRef(null);
  const replyFileInputRef = useRef(null);
  const newFileInputRef = useRef(null);
  const adminMenuRef = useRef(null);
  const ticketMenuRef = useRef(null);
  const filterMenuRef = useRef(null);
  const quickRepliesMenuRef = useRef(null);

  // 1. Subscribe to all support tickets
  useEffect(() => {
    setLoadingTickets(true);
    const unsub = subscribeAllTickets((data) => {
      setTickets(data);
      setLoadingTickets(false);
    });
    return () => unsub?.();
  }, []);

  // Sync selected ticket from searchParams or default to first ticket on desktop
  useEffect(() => {
    if (loadingTickets) return;
    const paramTicket = searchParams.get("ticket");
    if (paramTicket && tickets.some((t) => t.id === paramTicket)) {
      setSelectedTicketId(paramTicket);
    } else if (selectedTicketId && !tickets.some((t) => t.id === selectedTicketId)) {
      // Handle real-time deletion: close detail or switch to first ticket on desktop
      if (window.innerWidth >= 768 && tickets.length > 0) {
        setSelectedTicketId(tickets[0].id);
        setSearchParams({ ticket: tickets[0].id });
      } else {
        setSelectedTicketId(null);
        setSearchParams({});
      }
    } else if (!selectedTicketId && tickets.length > 0) {
      if (window.innerWidth >= 768) {
        setSelectedTicketId(tickets[0].id);
      }
    }
  }, [tickets, searchParams, loadingTickets, selectedTicketId]);

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

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (adminMenuRef.current && !adminMenuRef.current.contains(e.target)) {
        setAdminMessageMenuId(null);
      }
      if (ticketMenuRef.current && !ticketMenuRef.current.contains(e.target)) {
        setTicketOptionsMenuOpen(false);
      }
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target)) {
        setFilterDropdownOpen(false);
      }
      if (quickRepliesMenuRef.current && !quickRepliesMenuRef.current.contains(e.target)) {
        setQuickRepliesDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedTicket = tickets.find((t) => t.id === selectedTicketId) || null;

  // Sync selectedStatusStage when selectedTicket changes
  useEffect(() => {
    if (!selectedTicket) return;
    const s = (selectedTicket.status || "submitted").toLowerCase();
    if (s === "submitted" || s === "open") setSelectedStatusStage(1);
    else if (s === "under_review" || s.includes("review")) setSelectedStatusStage(2);
    else if (s === "in_progress" || s === "in progress") setSelectedStatusStage(3);
    else if (s === "resolved") setSelectedStatusStage(4);
    else setSelectedStatusStage(1);
  }, [selectedTicket?.status, selectedTicket?.id]);

  // Dynamic KPI counts
  const kpiTotal = tickets.length;
  const kpiOpen = tickets.filter((t) => {
    const s = (t.status || "submitted").toLowerCase();
    return s === "submitted" || s === "open";
  }).length;
  const kpiReview = tickets.filter((t) => {
    const s = (t.status || "").toLowerCase();
    return s === "under_review" || s.includes("review");
  }).length;
  const kpiProgress = tickets.filter((t) => {
    const s = (t.status || "").toLowerCase();
    return s === "in_progress" || s === "in progress";
  }).length;
  const kpiResolved = tickets.filter((t) => {
    const s = (t.status || "").toLowerCase();
    return s === "resolved";
  }).length;

  // Filter & search ticket list
  const filteredTickets = tickets.filter((t) => {
    if (activeFilter !== "All") {
      const s = (t.status || "submitted").toLowerCase();
      if (activeFilter === "Open" && !(s === "submitted" || s === "open")) return false;
      if (activeFilter === "Review" && !(s === "under_review" || s.includes("review"))) return false;
      if (activeFilter === "In Progress" && !(s === "in_progress" || s === "in progress")) return false;
      if (activeFilter === "Resolved" && s !== "resolved") return false;
    }
    if (filterCategory && (t.category || "Account / Login") !== filterCategory) {
      return false;
    }
    if (filterUserQuery.trim()) {
      const uq = filterUserQuery.toLowerCase().trim();
      const matchU = (t.userName || "").toLowerCase().includes(uq) || (t.userEmail || "").toLowerCase().includes(uq);
      if (!matchU) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchSubject = (t.subject || "").toLowerCase().includes(q);
      const matchId = (t.ticketId || "").toLowerCase().includes(q);
      const matchUser = (t.userName || "").toLowerCase().includes(q) || (t.userEmail || "").toLowerCase().includes(q);
      return matchSubject || matchId || matchUser;
    }
    return true;
  });

  // Handle Status Change (with Screen 10 Success Feedback)
  async function handleStatusChange(newStatus, showModal = true) {
    if (!selectedTicketId || updatingStatus) return;
    setUpdatingStatus(true);
    try {
      const res = await updateTicketStatus(selectedTicketId, newStatus, user?.uid || "admin");
      if (res.error) {
        alert("Failed to update status: " + res.error);
      } else if (showModal) {
        const statusMap = {
          submitted: "Submitted",
          open: "Open",
          under_review: "Under Review",
          in_progress: "In Progress",
          resolved: "Resolved",
          closed: "Closed",
        };
        const label = statusMap[newStatus] || newStatus;
        setStatusFeedbackModal({
          open: true,
          status: label,
          ticketCode: selectedTicket?.ticketId ? `#${selectedTicket.ticketId}` : `#SUP-${selectedTicket?.id?.slice(-3)}`,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingStatus(false);
    }
  }

  function handleWorkflowStatusUpdate() {
    const stageMap = {
      1: "submitted",
      2: "under_review",
      3: "in_progress",
      4: "resolved",
    };
    const targetStatus = stageMap[selectedStatusStage] || "submitted";
    handleStatusChange(targetStatus, true);
  }

  // Handle Send Reply
  async function handleAdminSendReply(e) {
    if (e) e.preventDefault();
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

      const isInternal = composerMode === "internal";
      const res = await addTicketMessage(selectedTicketId, {
        senderId: user?.uid || "admin",
        senderRole: "admin",
        senderName: isInternal ? "Internal Note" : "Admin Support",
        isInternalNote: isInternal,
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
      console.error("Failed to send admin reply:", err);
    } finally {
      setReplying(false);
    }
  }

  // Handle Create Support Request from Admin
  async function handleCreateNewRequest(e) {
    e.preventDefault();
    if (!newSubject.trim() || !newDescription.trim() || submittingNew) return;

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
        userId: user?.uid || "admin",
        userName: user?.displayName || "Admin",
        userEmail: user?.email || "admin@placementhub.com",
        subject: newSubject.trim(),
        message: newDescription.trim(),
        attachment: attachmentObj,
      });

      if (res.error) {
        setNewError(res.error);
      } else {
        setNewModalOpen(false);
        setNewSubject("");
        setNewDescription("");
        setNewFile(null);
        if (res.data?.id) {
          setSelectedTicketId(res.data.id);
          setSearchParams({ ticket: res.data.id });
        }
      }
    } catch (err) {
      setNewError(err.message || "Failed to create support request");
    } finally {
      setSubmittingNew(false);
    }
  }

  // Handle Delete Admin Message
  async function handleDeleteMessage() {
    if (!deletingMessageId || !selectedTicketId || deleting) return;
    setDeleting(true);
    try {
      const res = await deleteTicketMessage(selectedTicketId, deletingMessageId);
      if (res.error) {
        alert("Failed to delete message: " + res.error);
      } else {
        setDeletingMessageId(null);
        setAdminMessageMenuId(null);
      }
    } catch (err) {
      console.error("Failed to delete message:", err);
    } finally {
      setDeleting(false);
    }
  }

  // Handle Edit Admin Message
  function handleStartEdit(msg) {
    setEditingMessageId(msg.id);
    setEditingMessageText(msg.text);
    setAdminMessageMenuId(null);
  }

  async function handleSaveEdit() {
    if (!editingMessageId || !selectedTicketId || !editingMessageText.trim()) return;
    try {
      const res = await editTicketMessage(selectedTicketId, editingMessageId, editingMessageText.trim());
      if (res.error) {
        alert("Failed to edit message: " + res.error);
      }
    } catch (err) {
      console.error("Failed to edit message:", err);
    } finally {
      setEditingMessageId(null);
      setEditingMessageText("");
    }
  }

  function handleCancelEdit() {
    setEditingMessageId(null);
    setEditingMessageText("");
  }

  // Handle Delete Ticket
  async function handleDeleteTicket() {
    if (!deletingTicketId || deleting) return;
    setDeleting(true);
    try {
      const res = await deleteSupportTicket(deletingTicketId);
      if (res.error) {
        alert("Failed to delete ticket: " + res.error);
      } else {
        setDeletingTicketId(null);
        if (selectedTicketId === deletingTicketId) {
          setSelectedTicketId(null);
          setSearchParams({});
        }
      }
    } catch (err) {
      console.error("Failed to delete ticket:", err);
    } finally {
      setDeleting(false);
    }
  }

  // Format status badge class
  function renderStatusBadge(status) {
    const s = (status || "submitted").toLowerCase();
    let badgeClass = "admin-status-badge--open";
    let label = status || "Submitted";

    if (s === "submitted" || s === "open") {
      badgeClass = "admin-status-badge--open";
      label = "Submitted";
    } else if (s === "under_review" || s.includes("review")) {
      badgeClass = "admin-status-badge--review";
      label = "Under Review";
    } else if (s === "in_progress" || s === "in progress") {
      badgeClass = "admin-status-badge--progress";
      label = "In Progress";
    } else if (s === "resolved") {
      badgeClass = "admin-status-badge--resolved";
      label = "Resolved";
    }

    return <span className={`admin-status-badge ${badgeClass}`}>{label}</span>;
  }

  // Format timestamp helper
  function formatRelativeTime(timestampObj) {
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
    if (diffDays === 1) return "1d ago";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  function formatFullDateTime(timestampObj) {
    if (!timestampObj) return "—";
    const date = timestampObj.toDate ? timestampObj.toDate() : new Date(timestampObj);
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Extract all attachments from ticket and messages
  const allAttachments = [];
  if (selectedTicket?.attachment) {
    allAttachments.push(selectedTicket.attachment);
  }
  messages.forEach((m) => {
    if (m.attachment) allAttachments.push(m.attachment);
  });

  // Calculate timeline active step (1 to 4)
  const currentStageIndex = (() => {
    const s = (selectedTicket?.status || "submitted").toLowerCase();
    if (s === "submitted" || s === "open") return 1;
    if (s === "under_review" || s.includes("review")) return 2;
    if (s === "in_progress" || s === "in progress") return 3;
    if (s === "resolved") return 4;
    return 1;
  })();

  // ── HELPER RENDERERS FOR REUSABLE SECTIONS (DESKTOP & MOBILE) ──
  function renderProgressiveTimeline() {
    return (
      <div className="admin-conv-timeline-wrap">
        <div className="admin-timeline-stages">
          <div className={`admin-timeline-step ${currentStageIndex >= 1 ? "admin-step--active" : ""}`}>
            <div className="admin-step-circle">
              {currentStageIndex > 1 ? "✓" : "1"}
            </div>
            <span className="admin-step-label">Submitted</span>
            <span className="admin-step-date">
              {selectedTicket?.statusHistory?.submitted ? formatFullDateTime(selectedTicket.statusHistory.submitted) : formatFullDateTime(selectedTicket?.createdAt)}
            </span>
          </div>

          <div className={`admin-timeline-line ${currentStageIndex >= 2 ? "admin-line--active" : ""}`} />

          <div className={`admin-timeline-step ${currentStageIndex >= 2 ? "admin-step--active" : ""}`}>
            <div className="admin-step-circle">
              {currentStageIndex > 2 ? "✓" : "2"}
            </div>
            <span className="admin-step-label">Under Review</span>
            <span className="admin-step-date">
              {selectedTicket?.statusHistory?.under_review ? formatFullDateTime(selectedTicket.statusHistory.under_review) : "-"}
            </span>
          </div>

          <div className={`admin-timeline-line ${currentStageIndex >= 3 ? "admin-line--active" : ""}`} />

          <div className={`admin-timeline-step ${currentStageIndex >= 3 ? "admin-step--active" : ""}`}>
            <div className="admin-step-circle">
              {currentStageIndex > 3 ? "✓" : "3"}
            </div>
            <span className="admin-step-label">In Progress</span>
            <span className="admin-step-date">
              {selectedTicket?.statusHistory?.in_progress ? formatFullDateTime(selectedTicket.statusHistory.in_progress) : "-"}
            </span>
          </div>

          <div className={`admin-timeline-line ${currentStageIndex >= 4 ? "admin-line--active" : ""}`} />

          <div className={`admin-timeline-step ${currentStageIndex >= 4 ? "admin-step--active" : ""}`}>
            <div className="admin-step-circle">
              {currentStageIndex >= 4 ? "✓" : "4"}
            </div>
            <span className="admin-step-label">Resolved</span>
            <span className="admin-step-date">
              {selectedTicket?.statusHistory?.resolved ? formatFullDateTime(selectedTicket.statusHistory.resolved) : "-"}
            </span>
          </div>
        </div>
      </div>
    );
  }

  function renderMessagesScroll() {
    return (
      <div className="admin-messages-scroll">
        <div className="admin-msg-date-divider">
          <span>16 Sept 2026</span>
        </div>

        {loadingMessages ? (
          <div className="admin-support-loading">
            <div className="admin-support-spinner" />
          </div>
        ) : messages.length === 0 ? (
          <div className="admin-support-empty">No messages yet. Send a reply below.</div>
        ) : (
          messages.map((msg) => {
            const isAdmin = msg.senderRole === "admin";
            const isInternal = msg.isInternalNote;
            const isEditing = editingMessageId === msg.id;

            return (
              <div
                key={msg.id}
                className={`admin-msg-row ${isAdmin ? "admin-msg-row--admin" : "admin-msg-row--user"}`}
              >
                {!isAdmin ? (
                  <div className="admin-msg-avatar admin-msg-avatar--user">
                    <span>{msg.senderName?.charAt(0)?.toUpperCase() || "C"}</span>
                  </div>
                ) : (
                  <div className="admin-msg-avatar admin-msg-avatar--admin">
                    <span>A</span>
                  </div>
                )}

                <div className="admin-msg-container">
                  <div className="admin-msg-info-line">
                    <span className="admin-msg-sender-name">
                      {isAdmin ? (isInternal ? "Internal Note" : "Admin Support") : msg.senderName || selectedTicket?.userName || "User"}
                    </span>
                    <span className="admin-msg-timestamp">{formatFullDateTime(msg.createdAt)}</span>
                    {msg.edited && <span className="admin-msg-edited-tag">(edited)</span>}

                    {isAdmin && !isEditing && (
                      <div className="admin-msg-menu-wrap" ref={adminMessageMenuId === msg.id ? adminMenuRef : null}>
                        <button
                          type="button"
                          className="admin-msg-dots-btn"
                          onClick={() => {
                            if (window.innerWidth <= 768) {
                              setMobileMessageMenuId(msg.id);
                            } else {
                              setAdminMessageMenuId(adminMessageMenuId === msg.id ? null : msg.id);
                            }
                          }}
                          title="Message Options"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="5" r="2" />
                            <circle cx="12" cy="12" r="2" />
                            <circle cx="12" cy="19" r="2" />
                          </svg>
                        </button>

                        {adminMessageMenuId === msg.id && (
                          <div className="admin-msg-dropdown-menu">
                            <button onClick={() => handleStartEdit(msg)}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                              <span>Edit Message</span>
                            </button>
                            <button className="danger" onClick={() => { setDeletingMessageId(msg.id); setAdminMessageMenuId(null); }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
                              <span>Delete Message</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="admin-msg-edit-form">
                      <input
                        type="text"
                        className="admin-msg-edit-input"
                        value={editingMessageText}
                        onChange={(e) => setEditingMessageText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEdit();
                          if (e.key === "Escape") handleCancelEdit();
                        }}
                        autoFocus
                      />
                      <div className="admin-msg-edit-actions">
                        <button type="button" className="admin-msg-edit-save" onClick={handleSaveEdit}>Save</button>
                        <button type="button" className="admin-msg-edit-cancel" onClick={handleCancelEdit}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className={`admin-msg-bubble ${isAdmin ? (isInternal ? "admin-bubble--internal" : "admin-bubble--admin") : "admin-bubble--user"}`}>
                      <div className="admin-msg-text-content">{msg.text}</div>

                      {msg.attachment && (
                        <div className="admin-msg-attachment-box">
                          <div className="admin-att-thumb">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                          </div>
                          <div className="admin-att-meta">
                            <span className="admin-att-filename">{msg.attachment.name || "attachment.png"}</span>
                            <span className="admin-att-filesize">
                              {msg.attachment.fileSize ? `${Math.round(msg.attachment.fileSize / 1024)} KB` : "248 KB"}
                            </span>
                          </div>
                          <a
                            href={msg.attachment.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="admin-att-download-btn"
                            title="Download"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
    );
  }

  function renderComposer() {
    return (
      <div className="admin-composer-wrapper">
        <div className="admin-composer-tabs">
          <button
            type="button"
            className={`admin-composer-tab ${composerMode === "reply" ? "active" : ""}`}
            onClick={() => setComposerMode("reply")}
          >
            Reply
          </button>
          <button
            type="button"
            className={`admin-composer-tab ${composerMode === "internal" ? "active" : ""}`}
            onClick={() => setComposerMode("internal")}
          >
            Internal Note (Only for Admin)
          </button>
        </div>

        {replyFile && (
          <div className="admin-composer-file-chip">
            <span>📎 {replyFile.name}</span>
            <button type="button" onClick={() => setReplyFile(null)}>×</button>
          </div>
        )}

        <form className="admin-composer-row" onSubmit={handleAdminSendReply}>
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
            className="admin-composer-attach-btn"
            onClick={() => replyFileInputRef.current?.click()}
            title="Add Attachment"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>

          <input
            type="text"
            className="admin-composer-input"
            placeholder={composerMode === "internal" ? "Write an internal note (visible only to admins)..." : "Type your reply..."}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            disabled={replying}
          />

          <div className="admin-composer-quick-wrap admin-desktop-only-wrap" ref={quickRepliesMenuRef}>
            <button
              type="button"
              className="admin-composer-quick-btn"
              onClick={() => setQuickRepliesDropdownOpen(!quickRepliesDropdownOpen)}
            >
              <span>Quick Replies</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
            </button>

            {quickRepliesDropdownOpen && (
              <div className="admin-composer-quick-menu">
                <div className="admin-composer-quick-title">Insert Quick Reply</div>
                {QUICK_REPLIES.map((text, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setReplyText(text);
                      setQuickRepliesDropdownOpen(false);
                    }}
                  >
                    {text}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            className="admin-composer-send-btn"
            disabled={(!replyText.trim() && !replyFile) || replying}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
            <span className="admin-desktop-only-text">Send Reply</span>
          </button>
        </form>
      </div>
    );
  }

  function renderUpdateStatusCard() {
    return (
      <div className="admin-side-card admin-side-card--workflow">
        <h4 className="admin-side-card-title">Update Status</h4>
        <p className="admin-side-card-subtitle">Update request status (progressive).</p>

        <div className="admin-workflow-checkboxes">
          {[
            { stage: 1, label: "Submitted", time: selectedTicket?.statusHistory?.submitted || selectedTicket?.createdAt },
            { stage: 2, label: "Under Review", time: selectedTicket?.statusHistory?.under_review },
            { stage: 3, label: "In Progress", time: selectedTicket?.statusHistory?.in_progress },
            { stage: 4, label: "Resolved", time: selectedTicket?.statusHistory?.resolved },
          ].map((item) => (
            <label
              key={item.stage}
              className={`admin-workflow-label ${selectedStatusStage === item.stage ? "active" : ""}`}
              onClick={() => setSelectedStatusStage(item.stage)}
            >
              <input
                type="checkbox"
                checked={selectedStatusStage >= item.stage}
                onChange={() => setSelectedStatusStage(item.stage)}
              />
              <span className="admin-workflow-box">
                {selectedStatusStage >= item.stage ? "✓" : ""}
              </span>
              <span className="admin-workflow-num">{item.stage}</span>
              <span className="admin-workflow-text">{item.label}</span>
              {selectedStatusStage >= item.stage && item.time && (
                <span className="admin-workflow-time-tag">{formatRelativeTime(item.time)}</span>
              )}
            </label>
          ))}
        </div>

        <button
          type="button"
          className="admin-workflow-submit-btn"
          onClick={handleWorkflowStatusUpdate}
          disabled={updatingStatus || !selectedTicket}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /></svg>
          <span>{updatingStatus ? "Updating..." : "Update Status"}</span>
        </button>
      </div>
    );
  }

  function renderQuickRepliesCard() {
    return (
      <div className="admin-side-card">
        <div
          className="admin-side-accordion-head"
          onClick={() => setOpenQuickReplies(!openQuickReplies)}
        >
          <span className="admin-side-card-title">Quick Replies</span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className={`admin-accordion-arrow ${openQuickReplies ? "open" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>

        {openQuickReplies && (
          <div className="admin-side-accordion-body">
            <div className="admin-quick-replies-list">
              {QUICK_REPLIES.map((qr, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="admin-quick-reply-pill"
                  onClick={() => {
                    setReplyText(qr);
                    setMobileActiveTab("messages");
                  }}
                >
                  <span>{qr}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderRequestDetailsCard() {
    return (
      <div className="admin-side-card">
        <div
          className="admin-side-accordion-head"
          onClick={() => setOpenRequestDetails(!openRequestDetails)}
        >
          <span className="admin-side-card-title">Request Details</span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className={`admin-accordion-arrow ${openRequestDetails ? "open" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>

        {openRequestDetails && (
          <div className="admin-side-accordion-body">
            {selectedTicket ? (
              <div className="admin-details-meta-list">
                <div className="admin-meta-row">
                  <span className="admin-meta-label">Request ID</span>
                  <div className="admin-meta-id-wrap">
                    <span className="admin-meta-val bold">#{selectedTicket.ticketId || `SUP-${selectedTicket.id.slice(-3)}`}</span>
                    <button
                      type="button"
                      className="admin-copy-id-btn"
                      title="Copy Request ID"
                      onClick={() => {
                        navigator.clipboard.writeText(`#${selectedTicket.ticketId || `SUP-${selectedTicket.id.slice(-3)}`}`);
                        setCopiedTicketId(true);
                        setTimeout(() => setCopiedTicketId(false), 2000);
                      }}
                    >
                      {copiedTicketId ? (
                        <span style={{ fontSize: "0.72rem", color: "#10b981", fontWeight: 700 }}>Copied!</span>
                      ) : (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div className="admin-meta-row">
                  <span className="admin-meta-label">Subject</span>
                  <span className="admin-meta-val">{selectedTicket.subject}</span>
                </div>
                <div className="admin-meta-row">
                  <span className="admin-meta-label">Category</span>
                  <span className="admin-meta-val">{selectedTicket.category || "Account / Login"}</span>
                </div>
                <div className="admin-meta-row">
                  <span className="admin-meta-label">Status</span>
                  <span className="admin-meta-val">{renderStatusBadge(selectedTicket.status)}</span>
                </div>
                <div className="admin-meta-row">
                  <span className="admin-meta-label">Priority</span>
                  <span className="admin-meta-val priority-medium">
                    <span className="admin-priority-dot" style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", marginRight: 5 }} />
                    Medium
                  </span>
                </div>
                <div className="admin-meta-row">
                  <span className="admin-meta-label">Created On</span>
                  <span className="admin-meta-val">{formatFullDateTime(selectedTicket.createdAt)}</span>
                </div>
                <div className="admin-meta-row">
                  <span className="admin-meta-label">Last Updated</span>
                  <span className="admin-meta-val">{formatFullDateTime(selectedTicket.updatedAt || selectedTicket.createdAt)}</span>
                </div>
              </div>
            ) : (
              <p className="admin-side-empty-hint">No ticket selected</p>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderUserInfoCard() {
    return (
      <div className="admin-side-card">
        <div
          className="admin-side-accordion-head"
          onClick={() => setOpenUserInfo(!openUserInfo)}
        >
          <span className="admin-side-card-title">User Information</span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className={`admin-accordion-arrow ${openUserInfo ? "open" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>

        {openUserInfo && (
          <div className="admin-side-accordion-body">
            {selectedTicket ? (
              <div className="admin-user-card-content">
                <div className="admin-user-card-head">
                  <div className="admin-user-avatar-circle">
                    <span>{selectedTicket.userName?.charAt(0)?.toUpperCase() || "C"}</span>
                  </div>
                  <div className="admin-user-card-text">
                    <span className="admin-user-name">{selectedTicket.userName || "CAR LOVER"}</span>
                    <span className="admin-user-email">{selectedTicket.userEmail || "user@placementhub.com"}</span>
                    <span className="admin-user-role">Student</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="admin-view-profile-btn"
                  onClick={() => navigate(`/admin/users?q=${encodeURIComponent(selectedTicket.userEmail || selectedTicket.userName || "")}`)}
                >
                  View Full Profile
                </button>
              </div>
            ) : (
              <p className="admin-side-empty-hint">No ticket selected</p>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderAttachmentsCard() {
    return (
      <div className="admin-side-card">
        <div
          className="admin-side-accordion-head"
          onClick={() => setOpenAttachments(!openAttachments)}
        >
          <span className="admin-side-card-title">Attachments ({allAttachments.length})</span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className={`admin-accordion-arrow ${openAttachments ? "open" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>

        {openAttachments && (
          <div className="admin-side-accordion-body">
            {allAttachments.length === 0 ? (
              <p className="admin-side-empty-hint">No attachments for this request</p>
            ) : (
              <div className="admin-side-att-list">
                {allAttachments.map((att, i) => (
                  <div key={i} className="admin-side-att-item">
                    <div className="admin-side-att-icon">📄</div>
                    <div className="admin-side-att-meta">
                      <a href={att.fileUrl} target="_blank" rel="noreferrer" className="admin-side-att-name">
                        {att.name || "attachment.png"}
                      </a>
                      <span className="admin-side-att-size">
                        {att.fileSize ? `${Math.round(att.fileSize / 1024)} KB` : "248 KB"}
                      </span>
                    </div>
                    <a href={att.fileUrl} target="_blank" rel="noreferrer" className="admin-side-att-dl" title="Download">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderActivityLogCard() {
    return (
      <div className="admin-side-card">
        <div
          className="admin-side-accordion-head"
          onClick={() => setOpenActivityLog(!openActivityLog)}
        >
          <span className="admin-side-card-title">Activity Log</span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className={`admin-accordion-arrow ${openActivityLog ? "open" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>

        {openActivityLog && (
          <div className="admin-side-accordion-body">
            <div className="admin-activity-timeline">
              {selectedTicket && (
                <>
                  <div className="admin-activity-item">
                    <div className="admin-activity-dot" />
                    <div className="admin-activity-content">
                      <span className="admin-activity-title">Ticket submitted by {selectedTicket.userName || "user"}</span>
                      <span className="admin-activity-time">{formatFullDateTime(selectedTicket.createdAt)}</span>
                    </div>
                  </div>
                  {selectedTicket.statusHistory?.under_review && (
                    <div className="admin-activity-item">
                      <div className="admin-activity-dot" />
                      <div className="admin-activity-content">
                        <span className="admin-activity-title">Status changed to Under Review</span>
                        <span className="admin-activity-time">{formatFullDateTime(selectedTicket.statusHistory.under_review)}</span>
                      </div>
                    </div>
                  )}
                  {selectedTicket.statusHistory?.in_progress && (
                    <div className="admin-activity-item">
                      <div className="admin-activity-dot" />
                      <div className="admin-activity-content">
                        <span className="admin-activity-title">Status changed to In Progress</span>
                        <span className="admin-activity-time">{formatFullDateTime(selectedTicket.statusHistory.in_progress)}</span>
                      </div>
                    </div>
                  )}
                  {selectedTicket.statusHistory?.resolved && (
                    <div className="admin-activity-item">
                      <div className="admin-activity-dot" />
                      <div className="admin-activity-content">
                        <span className="admin-activity-title">Status changed to Resolved</span>
                        <span className="admin-activity-time">{formatFullDateTime(selectedTicket.statusHistory.resolved)}</span>
                      </div>
                    </div>
                  )}
                  {messages.map((msg) => {
                    if (msg.isActivity) return null;
                    const action = msg.senderRole === "admin" ? "Admin replied" : "User replied";
                    return (
                      <div key={msg.id} className="admin-activity-item">
                        <div className="admin-activity-dot" />
                        <div className="admin-activity-content">
                          <span className="admin-activity-title">{action}{msg.edited ? " (edited)" : ""}</span>
                          <span className="admin-activity-time">{formatFullDateTime(msg.createdAt)}</span>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="admin-support-container">
      {/* ── 1. TOP HEADER (PRD Section 3 & Image 2 Screen 1) ── */}
      <div className="admin-support-header">
        <div className="admin-support-titles">
          <h1 className="admin-support-title">Support (Admin)</h1>
          <p className="admin-support-subtitle">Manage and respond to user requests</p>
        </div>

        <div className="admin-support-top-actions">
          {/* Search Box */}
          <div className="admin-support-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="admin-search-icon">
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

          {/* Filter Dropdown & Mobile Filter Trigger */}
          <div className="admin-filter-dropdown-wrap" ref={filterMenuRef}>
            <button
              type="button"
              className="admin-support-filter-btn"
              onClick={() => {
                if (window.innerWidth <= 768) {
                  setMobileFilterOpen(true);
                } else {
                  setFilterDropdownOpen(!filterDropdownOpen);
                }
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              <span>Filter</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="admin-chevron-down">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {filterDropdownOpen && (
              <div className="admin-filter-dropdown-menu">
                <div className="admin-filter-menu-header">Status Filters</div>
                {["All", "Open", "Review", "In Progress", "Resolved"].map((f) => (
                  <button
                    key={f}
                    className={`admin-filter-menu-item ${activeFilter === f ? "active" : ""}`}
                    onClick={() => {
                      setActiveFilter(f);
                      setFilterDropdownOpen(false);
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* + New Request Button (PRD Section 12) */}
          <button
            type="button"
            className="admin-support-new-btn"
            onClick={() => setNewModalOpen(true)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>New Request</span>
          </button>
        </div>
      </div>

      {/* ── 2. 5 KPI CARDS ROW (PRD Section 4) ── */}
      <div className="admin-support-kpis">
        <div className="admin-kpi-card">
          <div className="admin-kpi-icon admin-kpi-icon--total">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="12" width="4" height="8" rx="1" />
              <rect x="10" y="8" width="4" height="12" rx="1" />
              <rect x="17" y="4" width="4" height="16" rx="1" />
            </svg>
          </div>
          <div className="admin-kpi-info">
            <span className="admin-kpi-value">{kpiTotal || 5}</span>
            <span className="admin-kpi-label">Total Requests</span>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-icon admin-kpi-icon--open">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
          <div className="admin-kpi-info">
            <span className="admin-kpi-value">{kpiOpen || 2}</span>
            <span className="admin-kpi-label">Open</span>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-icon admin-kpi-icon--review">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="admin-kpi-info">
            <span className="admin-kpi-value">{kpiReview || 1}</span>
            <span className="admin-kpi-label">Under Review</span>
          </div>
        </div>

        <div className="admin-kpi-card admin-kpi-card--progress-item">
          <div className="admin-kpi-icon admin-kpi-icon--progress">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <div className="admin-kpi-info">
            <span className="admin-kpi-value">{kpiProgress || 1}</span>
            <span className="admin-kpi-label">In Progress</span>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-icon admin-kpi-icon--resolved">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div className="admin-kpi-info">
            <span className="admin-kpi-value">{kpiResolved || 1}</span>
            <span className="admin-kpi-label">Resolved</span>
          </div>
        </div>
      </div>

      {/* ── 3. WORKSPACE: 3-COLUMN DESKTOP LAYOUT (PRD Section 2) ── */}
      <div className={`admin-support-workspace ${selectedTicketId ? "admin-workspace--detail-open" : ""}`}>
        {/* ── COLUMN 1: TICKET LIST PANE ── */}
        <div className="admin-support-list-pane">
          {/* Status Filter Pills (PRD Section 5) */}
          <div className="admin-support-filters">
            {[
              { label: "All", count: kpiTotal },
              { label: "Open", count: kpiOpen },
              { label: "Review", count: kpiReview },
              { label: "In Progress", count: kpiProgress },
              { label: "Resolved", count: kpiResolved },
            ].map((f) => (
              <button
                key={f.label}
                className={`admin-filter-pill ${activeFilter === f.label ? "admin-filter-pill--active" : ""}`}
                onClick={() => setActiveFilter(f.label)}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>

          {/* Ticket Cards Scrollable List */}
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
                const ticketNumber = ticket.ticketId || `SUP-${ticket.id.slice(-3)}`;
                return (
                  <div
                    key={ticket.id}
                    className={`admin-ticket-item ${isActive ? "admin-ticket-item--active" : ""} ${ticket.unreadAdmin ? "admin-ticket-item--unread" : ""}`}
                    onClick={() => {
                      setSelectedTicketId(ticket.id);
                      setSearchParams({ ticket: ticket.id });
                    }}
                  >
                    <div className="admin-ticket-item-content">
                      {/* Left chat bubble icon */}
                      <div className="admin-ticket-chat-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                      </div>

                      <div className="admin-ticket-body">
                        <div className="admin-ticket-item-top">
                          <h4 className="admin-ticket-subject">{ticket.subject}</h4>
                          {renderStatusBadge(ticket.status)}
                        </div>

                        <div className="admin-ticket-meta">
                          <span className="admin-ticket-id">#{ticketNumber}</span>
                          <span className="admin-ticket-bullet">•</span>
                          <span className="admin-ticket-user">
                            {ticket.userName || "User"} {ticket.userEmail ? `(${ticket.userEmail})` : ""}
                          </span>
                        </div>

                        <div className="admin-ticket-snippet">
                          {ticket.lastMessageText || ticket.subject || "Support inquiry"}
                        </div>
                      </div>

                      <div className="admin-ticket-time-col">
                        <span className="admin-ticket-time">{formatRelativeTime(ticket.updatedAt || ticket.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── COLUMN 2: CONVERSATION PANE (PRD Section 6 & Image 2 Screens 2, 3, 5) ── */}
        <div className="admin-support-conv-pane">
          {selectedTicket ? (
            <>
              {/* Conversation Top Header */}
              <div className="admin-conv-header">
                {/* Mobile top action row (Image 2 Screen 2: ← #SUP-683 [Open] ⋮) */}
                <div className="admin-mobile-conv-top-bar">
                  <button
                    type="button"
                    className="admin-conv-back-btn"
                    onClick={() => {
                      setSelectedTicketId(null);
                      setSearchParams({});
                    }}
                    title="Back to tickets list"
                  >
                    ←
                  </button>
                  <span className="admin-mobile-ticket-code">
                    #{selectedTicket.ticketId || `SUP-${selectedTicket.id.slice(-3)}`}
                  </span>
                  <button
                    type="button"
                    className="admin-mobile-dots-btn"
                    onClick={() => setMobileTicketActionsOpen(true)}
                    title="Ticket Actions"
                  >
                    ⋮
                  </button>
                </div>

                <div className="admin-conv-header-main">
                  <div className="admin-conv-title-row admin-desktop-only-row">
                    <button
                      className="admin-conv-back-btn"
                      onClick={() => setSelectedTicketId(null)}
                      title="Back to tickets list"
                    >
                      ←
                    </button>
                    <h3 className="admin-conv-subject">{selectedTicket.subject}</h3>
                    {renderStatusBadge(selectedTicket.status)}
                    {/* Ticket Options 3-dot Menu (Desktop) — inline next to badge */}
                    <div className="admin-conv-header-actions" ref={ticketMenuRef}>
                      <button
                        type="button"
                        className="admin-conv-dots-btn"
                        onClick={() => setTicketOptionsMenuOpen(!ticketOptionsMenuOpen)}
                        title="Ticket Options"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="12" cy="5" r="2" />
                          <circle cx="12" cy="12" r="2" />
                          <circle cx="12" cy="19" r="2" />
                        </svg>
                      </button>

                      {ticketOptionsMenuOpen && (
                        <div className="admin-ticket-dropdown-menu">
                          <button onClick={() => { handleStatusChange("resolved"); setTicketOptionsMenuOpen(false); }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                            <span>Mark as Resolved</span>
                          </button>
                          <button onClick={() => { handleStatusChange("in_progress"); setTicketOptionsMenuOpen(false); }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                            <span>Set In Progress</span>
                          </button>
                          <button onClick={() => { setComposerMode("internal"); setTicketOptionsMenuOpen(false); }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /></svg>
                            <span>Add Internal Note</span>
                          </button>
                          <button className="danger" onClick={() => { setDeletingTicketId(selectedTicketId); setTicketOptionsMenuOpen(false); }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
                            <span>Delete Request</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="admin-mobile-only-subject-row">
                    <h3 className="admin-conv-subject">{selectedTicket.subject}</h3>
                    {renderStatusBadge(selectedTicket.status)}
                  </div>

                  <div className="admin-conv-subline">
                    <span className="admin-conv-id admin-desktop-only-text">#{selectedTicket.ticketId || `SUP-${selectedTicket.id.slice(-3)}`}</span>
                    <span className="admin-desktop-only-text">•</span>
                    <span className="admin-conv-user">
                      👤 {selectedTicket.userName || "Student"} {selectedTicket.userEmail ? `(${selectedTicket.userEmail})` : ""}
                    </span>
                  </div>

                  <div className="admin-conv-meta-chips">
                    <span className="admin-meta-chip">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                      <span>{formatFullDateTime(selectedTicket.createdAt)}</span>
                    </span>
                    <span className="admin-meta-chip">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
                      <span>{selectedTicket.category || "Account / Login"}</span>
                    </span>
                    <span className="admin-meta-chip admin-desktop-only-chip">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
                      <span>Web</span>
                    </span>
                  </div>
                </div>

                {/* Mobile 3-Tab Navigator (Image 2 Screens 2, 3, 5: Messages | Details | Activity) */}
                <div className="admin-mobile-tabs-bar">
                  <button
                    type="button"
                    className={`admin-mobile-tab-pill ${mobileActiveTab === "messages" ? "active" : ""}`}
                    onClick={() => setMobileActiveTab("messages")}
                  >
                    Messages
                  </button>
                  <button
                    type="button"
                    className={`admin-mobile-tab-pill ${mobileActiveTab === "details" ? "active" : ""}`}
                    onClick={() => setMobileActiveTab("details")}
                  >
                    Details
                  </button>
                  <button
                    type="button"
                    className={`admin-mobile-tab-pill ${mobileActiveTab === "activity" ? "active" : ""}`}
                    onClick={() => setMobileActiveTab("activity")}
                  >
                    Activity
                  </button>
                </div>
              </div>

              {/* Desktop View (PRD Sections 6 & 10) */}
              <div className="admin-desktop-conv-content">
                {renderProgressiveTimeline()}
                {renderMessagesScroll()}
                {renderComposer()}
              </div>

              {/* Mobile View with 3-Tab Switch (Image 2 Screens 2, 3, 5) */}
              <div className="admin-mobile-active-content">
                {mobileActiveTab === "messages" && (
                  <>
                    {renderMessagesScroll()}
                    {renderComposer()}
                  </>
                )}
                {mobileActiveTab === "details" && (
                  <div className="admin-mobile-tab-scroll">
                    {renderRequestDetailsCard()}
                    {renderUserInfoCard()}
                    {renderAttachmentsCard()}
                  </div>
                )}
                {mobileActiveTab === "activity" && (
                  <div className="admin-mobile-tab-scroll">
                    {renderUpdateStatusCard()}
                    {renderQuickRepliesCard()}
                    {renderActivityLogCard()}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="admin-support-no-selection">
              <div className="admin-no-selection-icon">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                  <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                </svg>
              </div>
              <h3>Select a support ticket</h3>
              <p>Choose a ticket from the left panel to review messages and respond to students.</p>
            </div>
          )}
        </div>

        {/* ── COLUMN 3: RIGHT SIDEBAR PANELS (PRD Section 7, 8, 11) ── */}
        <div className="admin-support-right-pane">
          {renderUpdateStatusCard()}
          {renderQuickRepliesCard()}
          {renderRequestDetailsCard()}
          {renderUserInfoCard()}
          {renderAttachmentsCard()}
          {renderActivityLogCard()}
        </div>
      </div>

      {/* ── SCREEN 7: MESSAGE OPTIONS BOTTOM SHEET (Image 2 Screen 7) ── */}
      {mobileMessageMenuId && (
        <>
          <div
            className="admin-sheet-backdrop"
            onClick={() => setMobileMessageMenuId(null)}
          />
          <div className="admin-bottom-sheet animate-slide-up" role="dialog">
            <div className="admin-sheet-header">
              <h4>Message Options</h4>
            </div>
            <div className="admin-sheet-menu">
              <button
                type="button"
                className="admin-sheet-item"
                onClick={() => {
                  const msg = messages.find((m) => m.id === mobileMessageMenuId);
                  if (msg) handleStartEdit(msg);
                  setMobileMessageMenuId(null);
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                <span>Edit Message</span>
              </button>
              <button
                type="button"
                className="admin-sheet-item admin-sheet-item--danger"
                onClick={() => {
                  setDeletingMessageId(mobileMessageMenuId);
                  setMobileMessageMenuId(null);
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
                <span>Delete Message</span>
              </button>
            </div>
            <button
              type="button"
              className="admin-sheet-cancel-btn"
              onClick={() => setMobileMessageMenuId(null)}
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {/* ── SCREEN 8: FILTER REQUESTS BOTTOM SHEET (Image 2 Screen 8) ── */}
      {mobileFilterOpen && (
        <>
          <div
            className="admin-sheet-backdrop"
            onClick={() => setMobileFilterOpen(false)}
          />
          <div className="admin-bottom-sheet admin-filter-sheet animate-slide-up" role="dialog">
            <div className="admin-filter-sheet-header">
              <h3>Filter Requests</h3>
              <button
                type="button"
                className="admin-filter-sheet-close"
                onClick={() => setMobileFilterOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="admin-filter-sheet-body">
              <div className="admin-filter-section">
                <label className="admin-filter-section-title">Status</label>
                <div className="admin-filter-checkboxes-list">
                  {["Open", "Under Review", "In Progress", "Resolved", "Closed"].map((s) => (
                    <label key={s} className="admin-filter-check-label">
                      <input
                        type="checkbox"
                        checked={filterStatusChecks[s] || false}
                        onChange={(e) =>
                          setFilterStatusChecks({ ...filterStatusChecks, [s]: e.target.checked })
                        }
                      />
                      <span className="admin-filter-check-custom">
                        {filterStatusChecks[s] ? "✓" : ""}
                      </span>
                      <span>{s}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="admin-filter-section">
                <label className="admin-filter-section-title">Category</label>
                <select
                  className="admin-filter-select"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                >
                  <option value="">Select category</option>
                  <option value="Account / Login">Account / Login</option>
                  <option value="Resume Upload">Resume Upload</option>
                  <option value="Company Application">Company Application</option>
                  <option value="Profile Update">Profile Update</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="admin-filter-section">
                <label className="admin-filter-section-title">User</label>
                <input
                  type="text"
                  className="admin-filter-input"
                  placeholder="Search by user name or email..."
                  value={filterUserQuery}
                  onChange={(e) => setFilterUserQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="admin-filter-sheet-actions">
              <button
                type="button"
                className="admin-filter-btn-reset"
                onClick={() => {
                  setFilterStatusChecks({ Open: true, "Under Review": false, "In Progress": false, Resolved: false, Closed: false });
                  setFilterCategory("");
                  setFilterUserQuery("");
                  setActiveFilter("All");
                }}
              >
                Reset
              </button>
              <button
                type="button"
                className="admin-filter-btn-apply"
                onClick={() => {
                  const anyChecked = Object.entries(filterStatusChecks).filter(([_, v]) => v).map(([k]) => k);
                  if (anyChecked.length === 1) {
                    const single = anyChecked[0];
                    if (single === "Open") setActiveFilter("Open");
                    else if (single === "Under Review") setActiveFilter("Review");
                    else if (single === "In Progress") setActiveFilter("In Progress");
                    else if (single === "Resolved") setActiveFilter("Resolved");
                    else setActiveFilter("All");
                  }
                  setMobileFilterOpen(false);
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── SCREEN 9: TICKET ACTIONS OVERFLOW SHEET (Image 2 Screen 9) ── */}
      {mobileTicketActionsOpen && selectedTicket && (
        <>
          <div
            className="admin-sheet-backdrop"
            onClick={() => setMobileTicketActionsOpen(false)}
          />
          <div className="admin-bottom-sheet admin-ticket-actions-sheet animate-slide-up" role="dialog">
            <div className="admin-sheet-header">
              <h4>#{selectedTicket.ticketId || `SUP-${selectedTicket.id.slice(-3)}`}</h4>
              <span className="admin-sheet-sub">{selectedTicket.subject}</span>
            </div>
            <div className="admin-sheet-menu">
              <button
                type="button"
                className="admin-sheet-item"
                onClick={async () => {
                  setMobileTicketActionsOpen(false);
                  await handleStatusChange("resolved");
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                <span>Mark as Resolved</span>
              </button>
              <button
                type="button"
                className="admin-sheet-item"
                onClick={() => {
                  setMobileTicketActionsOpen(false);
                  alert("Request assigned to Admin.");
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                <span>Assign to Admin</span>
              </button>
              <button
                type="button"
                className="admin-sheet-item"
                onClick={() => {
                  setMobileTicketActionsOpen(false);
                  setMobileActiveTab("messages");
                  setComposerMode("internal");
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /></svg>
                <span>Add Internal Note</span>
              </button>
              <button
                type="button"
                className="admin-sheet-item"
                onClick={() => {
                  setMobileTicketActionsOpen(false);
                  window.open(window.location.href, "_blank");
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                <span>View in New Tab</span>
              </button>
              <button
                type="button"
                className="admin-sheet-item admin-sheet-item--danger"
                onClick={() => {
                  setMobileTicketActionsOpen(false);
                  setDeletingTicketId(selectedTicketId);
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
                <span>Delete Request</span>
              </button>
            </div>
            <button
              type="button"
              className="admin-sheet-cancel-btn"
              onClick={() => setMobileTicketActionsOpen(false)}
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {/* ── SCREEN 10: SUCCESS FEEDBACK MODAL (Image 2 Screen 10) ── */}
      {statusFeedbackModal.open && (
        <div className="admin-status-feedback-overlay">
          <div className="admin-status-feedback-modal animate-fade-in">
            <div className="admin-status-checkmark-circle">
              <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="admin-status-feedback-title">Status Updated!</h2>
            <p className="admin-status-feedback-desc">
              Request {statusFeedbackModal.ticketCode} is now marked as {statusFeedbackModal.status}.
            </p>
            <button
              type="button"
              className="admin-status-feedback-btn"
              onClick={() => setStatusFeedbackModal({ open: false, status: "", ticketCode: "" })}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* ── NEW SUPPORT REQUEST MODAL (PRD Section 12) ── */}
      <Modal
        open={newModalOpen}
        onClose={() => {
          if (!submittingNew) setNewModalOpen(false);
        }}
        title="Create New Support Request"
      >
        <form onSubmit={handleCreateNewRequest} className="support-new-form">
          <div className="modal-field">
            <label className="modal-label">Subject *</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Account login error, Resume problem"
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
            <div className="admin-priority-radio-row">
              {["Low", "Medium", "High"].map((p) => (
                <label key={p} className="admin-priority-radio-label">
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
              placeholder="Describe the issue in detail..."
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              required
              style={{ resize: "vertical", minHeight: 90 }}
            />
          </div>

          <div className="modal-field" style={{ marginTop: 14 }}>
            <label className="modal-label">Attachment (optional)</label>
            <input
              type="file"
              ref={newFileInputRef}
              style={{ display: "none" }}
              onChange={(e) => {
                if (e.target.files?.[0]) setNewFile(e.target.files[0]);
              }}
            />
            <div className="support-file-picker-row">
              <button
                type="button"
                className="support-file-picker-btn"
                onClick={() => newFileInputRef.current?.click()}
              >
                📎 {newFile ? "Change file" : "Add attachment"}
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
              disabled={submittingNew || !newSubject.trim() || !newDescription.trim()}
            >
              {submittingNew ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── DELETE MESSAGE CONFIRMATION MODAL ── */}
      <Modal
        open={!!deletingMessageId}
        onClose={() => setDeletingMessageId(null)}
        title="Delete Message"
      >
        <p className="admin-delete-confirm-text">Are you sure you want to delete this message? This action cannot be undone.</p>
        <div className="modal-actions">
          <button type="button" className="modal-btn modal-btn--secondary" onClick={() => setDeletingMessageId(null)} disabled={deleting}>Cancel</button>
          <button type="button" className="modal-btn modal-btn--primary" style={{ background: "#ef4444" }} onClick={handleDeleteMessage} disabled={deleting}>
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </Modal>

      {/* ── DELETE TICKET CONFIRMATION MODAL ── */}
      <Modal
        open={!!deletingTicketId}
        onClose={() => setDeletingTicketId(null)}
        title="Delete Support Request"
      >
        <p className="admin-delete-confirm-text">Are you sure you want to delete this support request? All messages will be permanently removed. This action cannot be undone.</p>
        <div className="modal-actions">
          <button type="button" className="modal-btn modal-btn--secondary" onClick={() => setDeletingTicketId(null)} disabled={deleting}>Cancel</button>
          <button type="button" className="modal-btn modal-btn--primary" style={{ background: "#ef4444" }} onClick={handleDeleteTicket} disabled={deleting}>
            {deleting ? "Deleting..." : "Delete Request"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
