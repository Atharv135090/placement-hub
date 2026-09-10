import { useState, useEffect, useMemo } from "react";
import { getAllApplications, getJobs, getCompanies, getAllUsers, updateApplication, deleteApplication } from "../../services/firestore";
import Modal from "../../components/Modal";
import "./Applications.css";

export default function AdminApplications() {
  const [applications, setApplications] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [statusModal, setStatusModal] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  const [deleteModal, setDeleteModal] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [appRes, jobRes, compRes, userRes] = await Promise.all([
        getAllApplications(), getJobs(), getCompanies(), getAllUsers(),
      ]);
      setApplications(appRes.data || []);
      setJobs(jobRes.data || []);
      setCompanies(compRes.data || []);
      setUsers(userRes.data || []);
      setLoading(false);
    }
    fetchData();
  }, []);

  const jobMap = useMemo(() => { const m = {}; jobs.forEach((j) => { m[j.id] = j; }); return m; }, [jobs]);
  const companyMap = useMemo(() => { const m = {}; companies.forEach((c) => { m[c.id] = c; }); return m; }, [companies]);
  const userMap = useMemo(() => { const m = {}; users.forEach((u) => { m[u.id] = u; }); return m; }, [users]);

  const filtered = useMemo(() => {
    let result = [...applications];
    if (statusFilter !== "all") result = result.filter((a) => a.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((a) => {
        const job = jobMap[a.jobId];
        const comp = companyMap[job?.companyId];
        const user = userMap[a.userId];
        return (user?.displayName || "").toLowerCase().includes(q) ||
          (user?.email || "").toLowerCase().includes(q) ||
          (comp?.name || "").toLowerCase().includes(q) ||
          (job?.title || "").toLowerCase().includes(q);
      });
    }
    return result;
  }, [applications, jobMap, companyMap, userMap, search, statusFilter]);

  function openStatusModal(app) {
    setStatusModal(app);
    setNewStatus(app.status);
  }

  async function handleStatusSave() {
    if (!statusModal || newStatus === statusModal.status) { setStatusModal(null); return; }
    setSaving(true);
    const { error: err } = await updateApplication(statusModal.id, { status: newStatus });
    if (!err) {
      setApplications((prev) => prev.map((a) => a.id === statusModal.id ? { ...a, status: newStatus } : a));
      setFeedback("Status updated.");
    } else {
      setFeedback("Failed to update status.");
    }
    setSaving(false);
    setStatusModal(null);
    setTimeout(() => setFeedback(""), 2000);
  }

  async function handleDelete() {
    if (!deleteModal) return;
    setDeleting(true);
    const { error: err } = await deleteApplication(deleteModal.id);
    if (!err) {
      setApplications((prev) => prev.filter((a) => a.id !== deleteModal.id));
      setFeedback("Application deleted.");
    }
    setDeleting(false);
    setDeleteModal(null);
    setTimeout(() => setFeedback(""), 2000);
  }

  const statusChips = {
    applied: "admin-chip--accent",
    shortlisted: "admin-chip--amber",
    selected: "admin-chip--green",
    rejected: "admin-chip--red",
    not_applied: "admin-chip--muted",
  };

  return (
    <div className="admin-apps">
      <div className="admin-page-header">
        <div>
          <h1>Applications</h1>
          <p className="admin-page-sub">View and manage student application records.</p>
        </div>
      </div>

      <div className="admin-toolbar glass">
        <input type="text" placeholder="Search student, company, role..." value={search} onChange={(e) => setSearch(e.target.value)} className="admin-search" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="admin-select">
          <option value="all">All Status</option>
          <option value="applied">Applied</option>
          <option value="shortlisted">Shortlisted</option>
          <option value="interview">Interview</option>
          <option value="offer">Offer</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {feedback && <div className="admin-feedback admin-feedback--success">{feedback}</div>}

      {loading ? (
        <div className="admin-list">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton-card" style={{ height: 56 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="admin-empty glass">
          <p>{search || statusFilter !== "all" ? "No matches found." : "No applications yet."}</p>
          <span>Applications will appear here when students apply.</span>
        </div>
      ) : (
        <div className="admin-table glass">
          <div className="admin-table-head admin-table-head--apps">
            <span className="ath-student">Student</span>
            <span className="ath-acompany">Company</span>
            <span className="ath-arole">Role</span>
            <span className="ath-astatus">Status</span>
            <span className="ath-adate">Applied</span>
            <span className="ath-actions">Actions</span>
          </div>
          {filtered.map((app) => {
            const job = jobMap[app.jobId];
            const comp = companyMap[job?.companyId];
            const user = userMap[app.userId];
            return (
              <div key={app.id} className="admin-table-row admin-table-row--apps">
                <span className="atr-student">
                  <span className="atr-student-name">{user?.displayName || user?.email || "Unknown"}</span>
                  {user?.email && user?.displayName && <span className="atr-student-email">{user.email}</span>}
                </span>
                <span className="atr-acompany">{comp?.name || "—"}</span>
                <span className="atr-arole">{job?.title || "—"}</span>
                <span className="atr-astatus">
                  <span className={`admin-chip ${statusChips[app.status] || "admin-chip--muted"}`}>
                    {app.status || "unknown"}
                  </span>
                </span>
                <span className="atr-adate">
                  {app.createdAt?.seconds ? new Date(app.createdAt.seconds * 1000).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
                </span>
                <span className="atr-actions">
                  <button className="admin-action-btn" onClick={() => openStatusModal(app)} title="Change status">✎</button>
                  <button className="admin-action-btn admin-action-btn--danger" onClick={() => setDeleteModal(app)} title="Delete">✕</button>
                </span>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={!!statusModal} onClose={() => setStatusModal(null)} title="Update Status">
        <div className="modal-field">
          <label>Status</label>
          <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
            <option value="applied">Applied</option>
            <option value="shortlisted">Shortlisted</option>
            <option value="interview">Interview</option>
            <option value="offer">Offer</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div className="modal-actions">
          <button className="modal-btn modal-btn--secondary" onClick={() => setStatusModal(null)}>Cancel</button>
          <button className="modal-btn modal-btn--primary" onClick={handleStatusSave} disabled={saving}>
            {saving ? "Saving..." : "Update"}
          </button>
        </div>
      </Modal>

      <Modal open={!!deleteModal} onClose={() => setDeleteModal(null)} title="Delete Application">
        <p className="modal-confirm-text">
          Are you sure you want to delete this application record?
        </p>
        <div className="modal-actions">
          <button className="modal-btn modal-btn--secondary" onClick={() => setDeleteModal(null)}>Cancel</button>
          <button className="modal-btn modal-btn--danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
