import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { usePlacementData } from "../contexts/PlacementDataContext";
import CompanyLogo from "../components/CompanyLogo";
import "../components/Modal.css";
import "./Applications.css";

function formatDate(dateStr) {
  if (!dateStr) return "Recently";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function Applications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { applications, updateAppStatus, removeApplication, addMessageToApplication, deleteMessageFromApplication, loading } = usePlacementData();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [toast, setToast] = useState("");
  const [messageModal, setMessageModal] = useState(null);
  const [messageText, setMessageText] = useState("");
  const [savingMessage, setSavingMessage] = useState(false);
  const [menuPosition, setMenuPosition] = useState("above");
  const [expandedNotes, setExpandedNotes] = useState(null);
  const menuRef = useRef(null);
  const menuBtnRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveMenuId(null);
      }
    }
    function handleEscape(e) {
      if (e.key === "Escape") setActiveMenuId(null);
    }
    if (activeMenuId) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleEscape);
      };
    }
  }, [activeMenuId]);

  useEffect(() => {
    if (activeMenuId && menuBtnRef.current) {
      const rect = menuBtnRef.current.getBoundingClientRect();
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;
      setMenuPosition(spaceAbove > 280 || spaceAbove > spaceBelow ? "above" : "below");
    }
  }, [activeMenuId]);

  const filteredApps = useMemo(() => {
    return applications.filter((app) => {
      const comp = app.companyName || "";
      const role = app.role || "";
      const st = app.status || "applied";

      if (search) {
        const q = search.toLowerCase();
        if (!comp.toLowerCase().includes(q) && !role.toLowerCase().includes(q)) return false;
      }
      if (statusFilter !== "all" && st.toLowerCase() !== statusFilter.toLowerCase()) return false;
      if (companyFilter !== "all" && comp.toLowerCase() !== companyFilter.toLowerCase()) return false;

      return true;
    });
  }, [applications, search, statusFilter, companyFilter]);

  async function handleStatusChange(appId, newStatus) {
    setActiveMenuId(null);
    await updateAppStatus(appId, newStatus);
    showToast(`Status updated to ${newStatus}`);
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  async function handleRemoveApplication() {
    if (!deleteConfirm) return;
    const appId = deleteConfirm.id;
    await removeApplication(appId);
    setDeleteConfirm(null);
    setActiveMenuId(null);
    showToast("Application removed");
  }

  async function handleAddMessage() {
    if (!messageModal || !messageText.trim()) return;
    setSavingMessage(true);
    try {
      const res = await addMessageToApplication(messageModal.id, messageText.trim());
      if (res.error) {
        showToast("Unable to save note. Please try again.");
      } else {
        showToast("Note added successfully");
        setMessageModal(null);
        setMessageText("");
      }
    } catch {
      showToast("Unable to save note. Please try again.");
    } finally {
      setSavingMessage(false);
    }
  }

  async function handleDeleteMessage(appId, msgId) {
    const res = await deleteMessageFromApplication(appId, msgId);
    if (!res.error) {
      showToast("Note deleted");
    }
  }

  function getStatusBadge(status = "applied") {
    switch (status.toLowerCase()) {
      case "shortlisted":
        return <span className="status-badge status-shortlisted">● Shortlisted</span>;
      case "interview":
        return <span className="status-badge status-interview">● Interview</span>;
      case "offer":
      case "selected":
        return <span className="status-badge status-selected">✓ Offer</span>;
      case "rejected":
        return <span className="status-badge status-rejected">✕ Rejected</span>;
      case "applied":
      default:
        return <span className="status-badge status-applied">● Applied</span>;
    }
  }

  return (
    <div className="applications-page animate-fade-in">
      {/* 1. Header */}
      <div className="apps-header">
        <div className="apps-header-left">
          <div className="apps-icon-badge">📋</div>
          <div>
            <h1 className="page-title">My Applications</h1>
            <p className="page-subtitle">Keep track of all your placement applications.</p>
          </div>
        </div>

        <button className="btn btn-secondary" onClick={() => navigate("/companies")}>
          View Companies
        </button>
      </div>

      {/* 2. Filter Bar */}
      <div className="apps-filter-bar glass">
        <div className="apps-search-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search applications..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="apps-dropdowns">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="select-field">
            <option value="all">All Status</option>
            <option value="applied">Applied</option>
            <option value="shortlisted">Shortlisted</option>
            <option value="interview">Interview</option>
            <option value="offer">Offer</option>
            <option value="rejected">Rejected</option>
          </select>

          <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className="select-field">
            <option value="all">All Companies</option>
            {[...new Set(applications.map(a => a.companyName).filter(Boolean))].map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. Applications Table / List */}
      <div className="apps-table-container glass">
        <div className="apps-table-header">
          <span className="col-comp">Company</span>
          <span className="col-role">Role</span>
          <span className="col-date">Applied On</span>
          <span className="col-status">Status</span>
          <span className="col-action">Action</span>
        </div>

        {loading ? (
          <div className="apps-loading">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton-card" style={{ height: 60 }} />
            ))}
          </div>
        ) : filteredApps.length === 0 ? (
          <div className="apps-empty">
            {applications.length === 0 ? (
              <>
                <p>No applications yet.</p>
                <p className="apps-empty-sub">Browse the Companies page to find opportunities and apply.</p>
              </>
            ) : (
              <p>No applications match your filter.</p>
            )}
          </div>
        ) : (
          <div className="apps-rows">
            {filteredApps.map((app) => (
              <div key={app.id} className="apps-row-wrapper">
              <div className="apps-row">
                {/* Company Name & Logo */}
                <div className="col-comp cell-comp">
                  <div className="comp-logo-small">
                    {app.logoUrl ? (
                      <img src={app.logoUrl} alt="" className="logo-img" onError={(e) => { e.target.style.display = 'none'; }} />
                    ) : null}
                    <CompanyLogo name={app.companyName || "C"} size={30} />
                  </div>
                  <strong>{app.companyName}</strong>
                </div>

                {/* Role */}
                <div className="col-role cell-role">
                  <span>{app.role}</span>
                </div>

                {/* Applied Date */}
                <div className="col-date cell-date">
                  <span>{formatDate(app.appliedAt)}</span>
                </div>

                {/* Status Badge */}
                <div className="col-status cell-status">
                  {getStatusBadge(app.status)}
                  {app.messages && app.messages.length > 0 && (
                    <button
                      className={`note-count-badge ${expandedNotes === app.id ? "note-count-badge--active" : ""}`}
                      onClick={() => setExpandedNotes(expandedNotes === app.id ? null : app.id)}
                      title={`${app.messages.length} note(s) — click to ${expandedNotes === app.id ? "hide" : "view"}`}
                    >
                      📝 {app.messages.length}
                    </button>
                  )}
                </div>

                {/* Action Menu */}
                <div className="col-action cell-action" ref={activeMenuId === app.id ? menuRef : undefined}>
                  <button
                    ref={activeMenuId === app.id ? menuBtnRef : undefined}
                    className="action-dots-btn"
                    onClick={() => setActiveMenuId(activeMenuId === app.id ? null : app.id)}
                    title="Change application status"
                  >
                    •••
                  </button>

                  {activeMenuId === app.id && (
                    <div className={`status-dropdown-menu glass-heavy ${menuPosition === "below" ? "menu-below" : ""}`}>
                      <span className="menu-heading">Actions</span>
                      <span className="menu-subheading">Update Status</span>
                      <button onClick={() => handleStatusChange(app.id, "applied")}>● Applied</button>
                      <button onClick={() => handleStatusChange(app.id, "shortlisted")}>● Shortlisted</button>
                      <button onClick={() => handleStatusChange(app.id, "interview")}>● Interview</button>
                      <button onClick={() => handleStatusChange(app.id, "offer")}>✓ Offer</button>
                      <button onClick={() => handleStatusChange(app.id, "rejected")}>✕ Rejected</button>
                      <div className="menu-divider" />
                      <button onClick={() => { setActiveMenuId(null); setMessageModal(app); setMessageText(""); }}>Add Message / Note</button>
                      <button className="menu-remove-btn" onClick={() => { setActiveMenuId(null); setDeleteConfirm(app); }}>Remove Application</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Expanded Notes Section */}
              {expandedNotes === app.id && app.messages && app.messages.length > 0 && (
                <div className="app-notes-expanded">
                  <div className="notes-expanded-header">
                    <span>Notes ({app.messages.length})</span>
                    <button className="btn btn-sm btn-primary" onClick={() => { setExpandedNotes(null); setMessageModal(app); setMessageText(""); }}>+ Add Note</button>
                  </div>
                  {app.messages.map((msg) => (
                    <div key={msg.id} className="app-note-row">
                      <p className="note-row-text">{msg.text}</p>
                      <div className="note-row-footer">
                        <span className="note-row-date">{new Date(msg.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                        <button className="note-row-delete" onClick={() => handleDeleteMessage(app.id, msg.id)} title="Delete note">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Bottom Banner */}
      <div className="apps-bottom-banner glass">
        <div className="banner-left">
          <span className="sparkle-icon">✨</span>
          <div>
            <strong>Progress feels slow,</strong>
            <span> but it always adds up.</span>
          </div>
        </div>

        <button className="btn btn-primary banner-cta-btn" onClick={() => navigate("/companies")}>
          View Companies
        </button>
      </div>

      {/* 5. Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-panel glass-heavy" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2 className="modal-title">Remove Application?</h2>
              <button className="modal-close" onClick={() => setDeleteConfirm(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p className="modal-confirm-text">
                Are you sure you want to remove <strong>{deleteConfirm.companyName}</strong> — {deleteConfirm.role} from your placement tracker?
              </p>
              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                <button className="btn btn-danger" onClick={handleRemoveApplication}>Remove</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Message/Note Modal */}
      {messageModal && (
        <div className="modal-overlay" onClick={() => setMessageModal(null)}>
          <div className="modal-panel glass-heavy" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2 className="modal-title">Add Note — {messageModal.companyName}</h2>
              <button className="modal-close" onClick={() => setMessageModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              {messageModal.messages && messageModal.messages.length > 0 && (
                <div className="app-notes-list">
                  {messageModal.messages.map((msg) => (
                    <div key={msg.id} className="app-note-item">
                      <p className="note-text">{msg.text}</p>
                      <div className="note-footer">
                        <span className="note-date">{new Date(msg.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                        <button className="note-delete-btn" onClick={() => handleDeleteMessage(messageModal.id, msg.id)} title="Delete note">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="modal-field">
                <label>Add a note or message</label>
                <textarea
                  className="message-textarea"
                  placeholder="e.g. Recruiter called me today and asked me to prepare for the technical round."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={() => setMessageModal(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleAddMessage} disabled={!messageText.trim() || savingMessage}>
                  {savingMessage ? "Saving..." : "Save Note"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Toast */}
      {toast && (
        <div className="apps-toast glass animate-fade-in">
          <span>✓ {toast}</span>
        </div>
      )}
    </div>
  );
}
