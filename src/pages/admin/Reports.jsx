import { useState, useEffect, useMemo } from "react";
import { getAllReports, updateReportStatus } from "../../services/social";
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

export default function AdminReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [feedback, setFeedback] = useState("");
  const [detailModal, setDetailModal] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    async function fetchReports() {
      setLoading(true);
      const { data } = await getAllReports();
      setReports(data || []);
      setLoading(false);
    }
    fetchReports();
  }, []);

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

  async function handleStatusChange(reportId, newStatus) {
    setUpdatingStatus(true);
    const { error } = await updateReportStatus(reportId, newStatus);
    if (!error) {
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status: newStatus } : r))
      );
      setDetailModal((prev) =>
        prev && prev.id === reportId ? { ...prev, status: newStatus } : prev
      );
      setFeedback("Report status updated.");
    } else {
      setFeedback("Failed to update status.");
    }
    setUpdatingStatus(false);
    setTimeout(() => setFeedback(""), 3000);
  }

  function formatDate(timestamp) {
    if (!timestamp) return "—";
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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
                <button className="ar-action-btn" onClick={() => setDetailModal(r)} title="View Details">
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

      {/* Report Detail Modal */}
      <Modal open={!!detailModal} onClose={() => setDetailModal(null)} title="Report Details" wide>
        {detailModal && (
          <div className="ar-detail">
            <div className="ar-detail-section">
              <div className="ar-detail-users">
                <div className="ar-detail-user-card">
                  <span className="ar-detail-label">Reported User</span>
                  <div className="ar-detail-user">
                    <UserAvatar user={{ uid: detailModal.reportedId }} profile={{}} style={{ width: 36, height: 36 }} />
                    <div>
                      <span className="ar-detail-name">{detailModal.reportedName}</span>
                      <span className="ar-detail-id">{detailModal.reportedId}</span>
                    </div>
                  </div>
                </div>
                <div className="ar-detail-user-card">
                  <span className="ar-detail-label">Reporter</span>
                  <div className="ar-detail-user">
                    <UserAvatar user={{ uid: detailModal.reporterId }} profile={{}} style={{ width: 36, height: 36 }} />
                    <div>
                      <span className="ar-detail-name">{detailModal.reporterName}</span>
                      <span className="ar-detail-id">{detailModal.reporterId}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="ar-detail-section">
              <span className="ar-detail-label">Reason</span>
              <span className="ar-detail-reason">{REASON_LABELS[detailModal.reason] || detailModal.reason}</span>
            </div>

            {detailModal.details && (
              <div className="ar-detail-section">
                <span className="ar-detail-label">Description</span>
                <p className="ar-detail-description">{detailModal.details}</p>
              </div>
            )}

            <div className="ar-detail-section">
              <span className="ar-detail-label">Date/Time</span>
              <span className="ar-detail-date">{formatDate(detailModal.createdAt)}</span>
            </div>

            {detailModal.evidenceUrls && detailModal.evidenceUrls.length > 0 && (
              <div className="ar-detail-section">
                <span className="ar-detail-label">Evidence ({detailModal.evidenceUrls.length})</span>
                <div className="ar-detail-evidence">
                  {detailModal.evidenceUrls.map((url, i) => (
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

            <div className="ar-detail-section">
              <span className="ar-detail-label">Status</span>
              <div className="ar-detail-status-actions">
                {["pending", "reviewing", "resolved", "dismissed"].map((status) => {
                  const isActive = (detailModal.status || "pending") === status;
                  return (
                    <button
                      key={status}
                      className={`ar-status-btn ${isActive ? "ar-status-btn--active" : ""} ${(STATUS_CONFIG[status] || STATUS_CONFIG.pending).class}`}
                      onClick={() => handleStatusChange(detailModal.id, status)}
                      disabled={updatingStatus || isActive}
                    >
                      {(STATUS_CONFIG[status] || STATUS_CONFIG.pending).label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
