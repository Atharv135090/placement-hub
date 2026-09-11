import { useState, useEffect, useMemo, useCallback } from "react";
import {
  getAllReports,
  getModerationHistory,
  getModerationsByReport,
  sendAdminMessage,
  sendAdminWarning,
  adminUpdateReport,
} from "../../services/social";
import { adminBlockUser } from "../../services/firestore";
import Modal from "../../components/Modal";
import UserAvatar from "../../components/UserAvatar";
import "./Reports.css";

const REASON_LABELS = {
  spam: "Spam",
  harassment: "Harassment",
  fake_profile: "Fake Profile",
  inappropriate: "Inappropriate",
  other: "Other",
};

const STATUS_CONFIG = {
  pending: { label: "Pending", class: "ar-status--pending" },
  reviewing: { label: "Reviewing", class: "ar-status--reviewing" },
  resolved: { label: "Resolved", class: "ar-status--resolved" },
  dismissed: { label: "Dismissed", class: "ar-status--dismissed" },
};

function formatDate(timestamp) {
  if (!timestamp) return "—";
  const d = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatShortDate(timestamp) {
  if (!timestamp) return "—";
  const d = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function AdminReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [feedback, setFeedback] = useState("");
  const [detailReport, setDetailReport] = useState(null);

  const [moderationHistory, setModerationHistory] = useState([]);
  const [moderations, setModerations] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [messageModal, setMessageModal] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  const [warningModal, setWarningModal] = useState(false);
  const [warningReason, setWarningReason] = useState("");
  const [warningText, setWarningText] = useState("");
  const [sendingWarning, setSendingWarning] = useState(false);

  const [resolveModal, setResolveModal] = useState(false);
  const [resolveNote, setResolveNote] = useState("");
  const [resolving, setResolving] = useState(false);

  const [dismissModal, setDismissModal] = useState(false);
  const [dismissReason, setDismissReason] = useState("");
  const [dismissing, setDismissing] = useState(false);

  const [blockModal, setBlockModal] = useState(false);
  const [blocking, setBlocking] = useState(false);

  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    const { data } = await getAllReports();
    setReports(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const filtered = useMemo(() => {
    let result = [...reports];
    if (statusFilter !== "all") {
      result = result.filter((r) => (r.status || "pending") === statusFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          (r.reporterName || "").toLowerCase().includes(q) ||
          (r.reportedName || "").toLowerCase().includes(q) ||
          (r.reason || "").toLowerCase().includes(q) ||
          (r.details || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [reports, search, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts = { pending: 0, reviewing: 0, resolved: 0, dismissed: 0 };
    reports.forEach((r) => {
      const s = r.status || "pending";
      if (counts[s] !== undefined) counts[s]++;
    });
    return counts;
  }, [reports]);

  const loadDetail = useCallback(async (report) => {
    setDetailReport(report);
    setLoadingHistory(true);
    const [historyRes, moderationsRes] = await Promise.all([
      getModerationHistory(report.reportedId),
      getModerationsByReport(report.id),
    ]);
    setModerationHistory(historyRes.data || []);
    setModerations(moderationsRes.data || []);
    setLoadingHistory(false);
  }, []);

  const closeDetail = useCallback(() => {
    setDetailReport(null);
    setModerationHistory([]);
    setModerations([]);
  }, []);

  async function handleStatusChange(reportId, newStatus) {
    setUpdatingStatus(true);
    const { error } = await adminUpdateReport(reportId, newStatus);
    if (!error) {
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status: newStatus } : r))
      );
      setDetailReport((prev) =>
        prev && prev.id === reportId ? { ...prev, status: newStatus } : prev
      );
      setFeedback("Report status updated.");
    } else {
      console.error("Status update error:", error);
      setFeedback(`Failed: ${error}`);
    }
    setUpdatingStatus(false);
    setTimeout(() => setFeedback(""), 5000);
  }

  async function handleSendMessage() {
    if (!messageText.trim() || !detailReport) return;
    setSendingMessage(true);
    const { data, error } = await sendAdminMessage(
      detailReport.id,
      detailReport.reportedId,
      messageText.trim()
    );
    if (!error) {
      setFeedback("Message sent to user.");
      setMessageModal(false);
      setMessageText("");
      const moderationsRes = await getModerationsByReport(detailReport.id);
      setModerations(moderationsRes.data || []);
    } else {
      console.error("Message send error:", error);
      setFeedback(`Failed: ${error}`);
    }
    setSendingMessage(false);
    setTimeout(() => setFeedback(""), 5000);
  }

  async function handleSendWarning() {
    if (!warningText.trim() || !detailReport) return;
    setSendingWarning(true);
    const { error } = await sendAdminWarning(
      detailReport.id,
      detailReport.reportedId,
      warningReason || detailReport.reason || "",
      warningText.trim()
    );
    if (!error) {
      setFeedback("Warning sent to user.");
      setWarningModal(false);
      setWarningText("");
      setWarningReason("");
      setReports((prev) =>
        prev.map((r) =>
          r.id === detailReport.id ? { ...r, status: "reviewing" } : r
        )
      );
      setDetailReport((prev) =>
        prev ? { ...prev, status: "reviewing" } : prev
      );
      const [historyRes, moderationsRes] = await Promise.all([
        getModerationHistory(detailReport.reportedId),
        getModerationsByReport(detailReport.id),
      ]);
      setModerationHistory(historyRes.data || []);
      setModerations(moderationsRes.data || []);
    } else {
      console.error("Warning send error:", error);
      setFeedback(`Failed: ${error}`);
    }
    setSendingWarning(false);
    setTimeout(() => setFeedback(""), 5000);
  }

  async function handleResolve() {
    if (!detailReport) return;
    setResolving(true);
    const { error } = await adminUpdateReport(detailReport.id, "resolved", {
      resolutionNote: resolveNote.trim(),
    });
    if (!error) {
      setFeedback("Report resolved.");
      setResolveModal(false);
      setResolveNote("");
      setReports((prev) =>
        prev.map((r) =>
          r.id === detailReport.id ? { ...r, status: "resolved" } : r
        )
      );
      setDetailReport((prev) =>
        prev ? { ...prev, status: "resolved" } : prev
      );
      const moderationsRes = await getModerationsByReport(detailReport.id);
      setModerations(moderationsRes.data || []);
    } else {
      console.error("Resolve error:", error);
      setFeedback(`Failed: ${error}`);
    }
    setResolving(false);
    setTimeout(() => setFeedback(""), 5000);
  }

  async function handleDismiss() {
    if (!detailReport) return;
    setDismissing(true);
    const { error } = await adminUpdateReport(detailReport.id, "dismissed", {
      dismissedReason: dismissReason.trim(),
    });
    if (!error) {
      setFeedback("Report dismissed.");
      setDismissModal(false);
      setDismissReason("");
      setReports((prev) =>
        prev.map((r) =>
          r.id === detailReport.id ? { ...r, status: "dismissed" } : r
        )
      );
      setDetailReport((prev) =>
        prev ? { ...prev, status: "dismissed" } : prev
      );
      const moderationsRes = await getModerationsByReport(detailReport.id);
      setModerations(moderationsRes.data || []);
    } else {
      console.error("Dismiss error:", error);
      setFeedback(`Failed: ${error}`);
    }
    setDismissing(false);
    setTimeout(() => setFeedback(""), 5000);
  }

  async function handleBlockUser() {
    if (!detailReport) return;
    setBlocking(true);
    const { error } = await adminBlockUser(detailReport.reportedId, true);
    if (!error) {
      setFeedback("User blocked.");
      setBlockModal(false);
      setReports((prev) =>
        prev.map((r) =>
          r.id === detailReport.id ? { ...r, reportedBlocked: true } : r
        )
      );
      setDetailReport((prev) =>
        prev ? { ...prev, reportedBlocked: true } : prev
      );
      const moderationsRes = await getModerationsByReport(detailReport.id);
      setModerations(moderationsRes.data || []);
    } else {
      console.error("Block error:", error);
      setFeedback(`Failed: ${error}`);
    }
    setBlocking(false);
    setTimeout(() => setFeedback(""), 5000);
  }

  async function handleUnblockUser() {
    if (!detailReport) return;
    setBlocking(true);
    const { error } = await adminBlockUser(detailReport.reportedId, false);
    if (!error) {
      setFeedback("User unblocked.");
      setBlockModal(false);
      setReports((prev) =>
        prev.map((r) =>
          r.id === detailReport.id ? { ...r, reportedBlocked: false } : r
        )
      );
      setDetailReport((prev) =>
        prev ? { ...prev, reportedBlocked: false } : prev
      );
    } else {
      console.error("Unblock error:", error);
      setFeedback(`Failed: ${error}`);
    }
    setBlocking(false);
    setTimeout(() => setFeedback(""), 5000);
  }

  function getActionLabel(type) {
    switch (type) {
      case "message": return "Admin Message";
      case "warning": return "Warning Sent";
      case "blocked": return "User Blocked";
      case "status_reviewing": return "Marked Reviewing";
      case "status_resolved": return "Resolved";
      case "status_dismissed": return "Dismissed";
      default: return type;
    }
  }

  return (
    <div className="ar">
      <div className="ar-header">
        <div className="ar-header-left">
          <div className="ar-header-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <h1 className="ar-title">Reports</h1>
            <p className="ar-subtitle">Review and manage student reports</p>
          </div>
        </div>
        <div className="ar-stats-row">
          <div className="ar-mini-stat">
            <span className="ar-mini-val">{reports.length}</span>
            <span className="ar-mini-label">Total</span>
          </div>
          <div className="ar-mini-stat ar-mini-stat--amber">
            <span className="ar-mini-val">{statusCounts.pending}</span>
            <span className="ar-mini-label">Pending</span>
          </div>
          <div className="ar-mini-stat ar-mini-stat--blue">
            <span className="ar-mini-val">{statusCounts.reviewing}</span>
            <span className="ar-mini-label">Reviewing</span>
          </div>
          <div className="ar-mini-stat ar-mini-stat--green">
            <span className="ar-mini-val">{statusCounts.resolved}</span>
            <span className="ar-mini-label">Resolved</span>
          </div>
        </div>
      </div>

      <div className="ar-toolbar glass">
        <div className="ar-search-wrap">
          <svg className="ar-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search by reporter, reported user, or reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ar-search"
          />
        </div>
        <div className="ar-filter-group">
          <div className="ar-filter-icon-wrap">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="ar-select">
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="reviewing">Reviewing</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </div>
      </div>

      {feedback && (
        <div className="ar-feedback">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {feedback}
        </div>
      )}

      {loading ? (
        <div className="ar-list">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="ar-skeleton-row">
              <div className="ar-skeleton-lines">
                <div className="ar-skeleton-line ar-skeleton-line--long" />
                <div className="ar-skeleton-line ar-skeleton-line--short" />
              </div>
              <div className="ar-skeleton-chip" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="ar-empty glass">
          <div className="ar-empty-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <p>{search ? "No matches found" : "No reports yet"}</p>
          <span>{search ? "Try a different search term" : "Reports will appear here when students submit them"}</span>
        </div>
      ) : (
        <div className="ar-table-wrap glass">
          <div className="ar-table-header">
            <span className="ar-th ar-th--user">Reported User</span>
            <span className="ar-th ar-th--user">Reporter</span>
            <span className="ar-th ar-th--reason">Reason</span>
            <span className="ar-th ar-th--date">Date</span>
            <span className="ar-th ar-th--status">Status</span>
            <span className="ar-th ar-th--actions">Actions</span>
          </div>

          {filtered.map((r, idx) => (
            <div key={r.id} className="ar-row" style={{ animationDelay: `${idx * 0.04}s` }}>
              <span className="ar-cell ar-cell--user">
                <div className="ar-avatar">
                  <UserAvatar user={{ uid: r.reportedId }} profile={{}} className="ar-avatar-img" />
                </div>
                <div className="ar-user-info">
                  <span className="ar-user-name">{r.reportedName}</span>
                  <span className="ar-user-id">{r.reportedId}</span>
                </div>
              </span>

              <span className="ar-cell ar-cell--user">
                <div className="ar-avatar">
                  <UserAvatar user={{ uid: r.reporterId }} profile={{}} className="ar-avatar-img" />
                </div>
                <div className="ar-user-info">
                  <span className="ar-user-name">{r.reporterName}</span>
                  <span className="ar-user-id">{r.reporterId}</span>
                </div>
              </span>

              <span className="ar-cell ar-cell--reason">
                <span className="ar-reason-badge">{REASON_LABELS[r.reason] || r.reason}</span>
              </span>

              <span className="ar-cell ar-cell--date">{formatDate(r.createdAt)}</span>

              <span className="ar-cell ar-cell--status">
                <span className={`ar-status-badge ${(STATUS_CONFIG[r.status] || STATUS_CONFIG.pending).class}`}>
                  {(STATUS_CONFIG[r.status] || STATUS_CONFIG.pending).label}
                </span>
              </span>

              <span className="ar-cell ar-cell--actions">
                <button className="ar-action-btn" onClick={() => loadDetail(r)} title="View Details">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Moderation Panel */}
      <Modal open={!!detailReport} onClose={closeDetail} title="Report Details" wide>
        {detailReport && (
          <div className="ar-detail">
            <div className="ar-detail-section">
              <div className="ar-detail-users">
                <div className="ar-detail-user-card">
                  <span className="ar-detail-label">Reported User</span>
                  <div className="ar-detail-user">
                    <UserAvatar user={{ uid: detailReport.reportedId }} profile={{}} style={{ width: 36, height: 36 }} />
                    <div>
                      <span className="ar-detail-name">{detailReport.reportedName}</span>
                      <span className="ar-detail-id">{detailReport.reportedId}</span>
                    </div>
                  </div>
                  <div className="ar-detail-user-actions">
                    {detailReport.reportedBlocked && (
                      <span className="ar-blocked-badge">BLOCKED</span>
                    )}
                  </div>
                </div>
                <div className="ar-detail-user-card">
                  <span className="ar-detail-label">Reporter</span>
                  <div className="ar-detail-user">
                    <UserAvatar user={{ uid: detailReport.reporterId }} profile={{}} style={{ width: 36, height: 36 }} />
                    <div>
                      <span className="ar-detail-name">{detailReport.reporterName}</span>
                      <span className="ar-detail-id">{detailReport.reporterId}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="ar-detail-section">
              <span className="ar-detail-label">Reason</span>
              <span className="ar-detail-reason">{REASON_LABELS[detailReport.reason] || detailReport.reason}</span>
            </div>

            <div className="ar-detail-section">
              <span className="ar-detail-label">Description</span>
              <p className="ar-detail-description">
                {detailReport.details || "No additional description provided."}
              </p>
            </div>

            {detailReport.evidenceUrls && detailReport.evidenceUrls.length > 0 && (
              <div className="ar-detail-section">
                <span className="ar-detail-label">Evidence ({detailReport.evidenceUrls.length})</span>
                <div className="ar-detail-evidence">
                  {detailReport.evidenceUrls.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="ar-evidence-link">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                      </svg>
                      Evidence {i + 1}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {detailReport.reportedMessage && (
              <div className="ar-detail-section">
                <span className="ar-detail-label">Reported Message</span>
                <div className="ar-detail-evidence-message">
                  <div className="ar-evidence-msg-content">
                    <span className="ar-evidence-msg-sender">{detailReport.reportedMessage.sender || "User"}</span>
                    <p className="ar-evidence-msg-text">{detailReport.reportedMessage.text}</p>
                    {detailReport.reportedMessage.timestamp && (
                      <span className="ar-evidence-msg-time">{formatDate(detailReport.reportedMessage.timestamp)}</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="ar-detail-section">
              <span className="ar-detail-label">Date/Time</span>
              <span className="ar-detail-date">{formatDate(detailReport.createdAt)}</span>
            </div>

            {/* Moderation History */}
            <div className="ar-detail-section">
              <span className="ar-detail-label">Moderation History</span>
              {loadingHistory ? (
                <p className="ar-detail-loading">Loading history...</p>
              ) : moderationHistory.length > 0 ? (
                <div className="ar-moderation-history">
                  <span className="ar-history-count">
                    {moderationHistory.length} previous report{moderationHistory.length !== 1 ? "s" : ""}
                  </span>
                  {moderationHistory.map((r) => (
                    <div key={r.id} className="ar-history-item">
                      <span className="ar-history-reason">
                        {REASON_LABELS[r.reason] || r.reason}
                      </span>
                      <span className="ar-history-sep">&mdash;</span>
                      <span className={`ar-history-status ar-status--${r.status}`}>
                        {(STATUS_CONFIG[r.status] || STATUS_CONFIG.pending).label}
                      </span>
                      <span className="ar-history-date">{formatShortDate(r.createdAt)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="ar-detail-empty">No previous reports for this user.</p>
              )}
            </div>

            {/* Moderations for this report */}
            {moderations.length > 0 && (
              <div className="ar-detail-section">
                <span className="ar-detail-label">Actions Taken</span>
                <div className="ar-moderation-actions-list">
                  {moderations.map((m) => (
                    <div key={m.id} className="ar-moderation-action-item">
                      <span className="ar-action-type">{getActionLabel(m.action)}</span>
                      {m.message && (
                        <p className="ar-action-message">{m.message}</p>
                      )}
                      <span className="ar-action-date">{formatDate(m.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Admin Actions */}
            <div className="ar-detail-section">
              <span className="ar-detail-label">Admin Actions</span>
              <div className="ar-detail-action-buttons">
                <button className="ar-detail-action-btn ar-detail-action-btn--message" onClick={() => setMessageModal(true)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  Message User
                </button>
                <button className="ar-detail-action-btn ar-detail-action-btn--warning" onClick={() => { setWarningReason(detailReport.reason || ""); setWarningModal(true); }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  Send Warning
                </button>
              </div>
            </div>

            {/* Status */}
            <div className="ar-detail-section">
              <span className="ar-detail-label">Status</span>
              <div className="ar-detail-status-actions">
                {["pending", "reviewing", "resolved", "dismissed"].map((status) => {
                  const isActive = (detailReport.status || "pending") === status;
                  return (
                    <button
                      key={status}
                      className={`ar-status-btn ${isActive ? "ar-status-btn--active" : ""} ${(STATUS_CONFIG[status] || STATUS_CONFIG.pending).class}`}
                      onClick={() => {
                        if (status === "resolved") setResolveModal(true);
                        else if (status === "dismissed") setDismissModal(true);
                        else handleStatusChange(detailReport.id, status);
                      }}
                      disabled={updatingStatus || isActive}
                    >
                      {(STATUS_CONFIG[status] || STATUS_CONFIG.pending).label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Danger Zone */}
            <div className="ar-detail-section ar-detail-danger">
              <span className="ar-detail-label ar-detail-label--danger">Danger Zone</span>
              {detailReport.reportedBlocked ? (
                <button className="ar-detail-action-btn ar-detail-action-btn--unblock" onClick={handleUnblockUser} disabled={blocking}>
                  Unblock User
                </button>
              ) : (
                <button className="ar-detail-action-btn ar-detail-action-btn--block" onClick={() => setBlockModal(true)}>
                  Block User
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Message User Modal */}
      <Modal open={messageModal} onClose={() => { setMessageModal(false); setMessageText(""); }} title={`Message ${detailReport?.reportedName || "User"}`}>
        <div className="ar-modal-content">
          <p className="ar-modal-desc">Send an official moderation message to the reported user.</p>
          <textarea
            className="ar-modal-textarea"
            placeholder="Write a message..."
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            rows={4}
          />
          <div className="ar-modal-actions">
            <button className="ar-modal-cancel" onClick={() => { setMessageModal(false); setMessageText(""); }}>Cancel</button>
            <button className="ar-modal-submit" onClick={handleSendMessage} disabled={!messageText.trim() || sendingMessage}>
              {sendingMessage ? "Sending..." : "Send Message"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Send Warning Modal */}
      <Modal open={warningModal} onClose={() => { setWarningModal(false); setWarningText(""); setWarningReason(""); }} title={`Send Warning to ${detailReport?.reportedName || "User"}`}>
        <div className="ar-modal-content">
          <div className="ar-modal-field">
            <label className="ar-modal-label">Reason</label>
            <input
              type="text"
              className="ar-modal-input"
              value={warningReason}
              onChange={(e) => setWarningReason(e.target.value)}
              placeholder="e.g. Harassment"
            />
          </div>
          <div className="ar-modal-field">
            <label className="ar-modal-label">Warning Message</label>
            <textarea
              className="ar-modal-textarea"
              placeholder="Write the warning message..."
              value={warningText}
              onChange={(e) => setWarningText(e.target.value)}
              rows={4}
            />
          </div>
          <div className="ar-modal-actions">
            <button className="ar-modal-cancel" onClick={() => { setWarningModal(false); setWarningText(""); setWarningReason(""); }}>Cancel</button>
            <button className="ar-modal-submit ar-modal-submit--warning" onClick={handleSendWarning} disabled={!warningText.trim() || sendingWarning}>
              {sendingWarning ? "Sending..." : "Send Warning"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Resolve Modal */}
      <Modal open={resolveModal} onClose={() => { setResolveModal(false); setResolveNote(""); }} title="Resolve Report">
        <div className="ar-modal-content">
          <p className="ar-modal-desc">Mark this report as resolved. Optionally add a resolution note.</p>
          <textarea
            className="ar-modal-textarea"
            placeholder="Resolution note (optional)..."
            value={resolveNote}
            onChange={(e) => setResolveNote(e.target.value)}
            rows={3}
          />
          <div className="ar-modal-actions">
            <button className="ar-modal-cancel" onClick={() => { setResolveModal(false); setResolveNote(""); }}>Cancel</button>
            <button className="ar-modal-submit" onClick={handleResolve} disabled={resolving}>
              {resolving ? "Resolving..." : "Resolve"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Dismiss Modal */}
      <Modal open={dismissModal} onClose={() => { setDismissModal(false); setDismissReason(""); }} title="Dismiss Report">
        <div className="ar-modal-content">
          <p className="ar-modal-desc">Dismiss this report. Optionally provide a reason.</p>
          <textarea
            className="ar-modal-textarea"
            placeholder="Reason for dismissal (optional)..."
            value={dismissReason}
            onChange={(e) => setDismissReason(e.target.value)}
            rows={3}
          />
          <div className="ar-modal-actions">
            <button className="ar-modal-cancel" onClick={() => { setDismissModal(false); setDismissReason(""); }}>Cancel</button>
            <button className="ar-modal-submit" onClick={handleDismiss} disabled={dismissing}>
              {dismissing ? "Dismissing..." : "Dismiss"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Block User Confirmation Modal */}
      <Modal open={blockModal} onClose={() => setBlockModal(false)} title="Block User">
        <div className="ar-modal-content">
          <div className="ar-modal-danger-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
          </div>
          <p className="ar-modal-desc ar-modal-desc--center">
            Block <strong>{detailReport?.reportedName}</strong>?
          </p>
          <p className="ar-modal-desc ar-modal-desc--center ar-modal-desc--small">
            This will immediately restrict this user's access to Placement Hub.
            The user will be logged out and will not be able to access their
            account until an Admin removes the restriction.
          </p>
          <div className="ar-modal-actions">
            <button className="ar-modal-cancel" onClick={() => setBlockModal(false)}>Cancel</button>
            <button className="ar-modal-submit ar-modal-submit--danger" onClick={handleBlockUser} disabled={blocking}>
              {blocking ? "Blocking..." : "Block User"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
