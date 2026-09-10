import { useState, useEffect, useMemo } from "react";
import { getJobs, getCompanies, addJob, updateJob, deleteJob } from "../../services/firestore";
import Modal from "../../components/Modal";
import "./Drives.css";

const EMPTY = { companyId: "", title: "", description: "", type: "Full-time", package: "", location: "", eligibility: "", deadline: "", applicationLink: "", isActive: true };

function getDriveStatus(job) {
  const now = new Date();
  const deadline = job.deadline ? new Date(job.deadline) : null;
  if (job.isActive === false) return "closed";
  if (deadline && deadline < now) return "expired";
  if (deadline) {
    const diff = deadline - now;
    const days = diff / (1000 * 60 * 60 * 24);
    if (days > 7) return "upcoming";
    return "ongoing";
  }
  return job.isActive !== false ? "ongoing" : "closed";
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
}

const BriefcaseIcon = () => (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    <line x1="6" y1="12" x2="18" y2="12" />
  </svg>
);

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const ToggleIcon = ({ active }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {active ? (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ) : (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </>
    )}
  </svg>
);

const FilterIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

const SortIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
  </svg>
);

const STATUS_CONFIG = {
  upcoming: { label: "Upcoming", className: "drive-status--upcoming" },
  ongoing: { label: "Ongoing", className: "drive-status--ongoing" },
  expired: { label: "Expired", className: "drive-status--expired" },
  closed: { label: "Closed", className: "drive-status--closed" },
};

export default function AdminDrives() {
  const [jobs, setJobs] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [jobRes, compRes] = await Promise.all([getJobs(), getCompanies()]);
      setJobs(jobRes.data || []);
      setCompanies(compRes.data || []);
      setLoading(false);
    }
    fetchData();
  }, []);

  const companyMap = useMemo(() => {
    const map = {};
    companies.forEach((c) => { map[c.id] = c; });
    return map;
  }, [companies]);

  const filtered = useMemo(() => {
    let result = [...jobs];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((j) => {
        const comp = companyMap[j.companyId];
        return (comp?.name || "").toLowerCase().includes(q) ||
          (j.title || "").toLowerCase().includes(q) ||
          (j.package || "").toLowerCase().includes(q);
      });
    }
    if (filter === "active") result = result.filter((j) => j.isActive !== false);
    if (filter === "inactive") result = result.filter((j) => j.isActive === false);
    if (sortBy === "newest") result.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    if (sortBy === "deadline") result.sort((a, b) => (a.deadline || "9999").localeCompare(b.deadline || "9999"));
    if (sortBy === "company") result.sort((a, b) => (companyMap[a.companyId]?.name || "").localeCompare(companyMap[b.companyId]?.name || ""));
    return result;
  }, [jobs, companyMap, search, filter, sortBy]);

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY });
    setModalOpen(true);
  }

  function openEdit(job) {
    setEditing(job);
    setForm({
      companyId: job.companyId || "",
      title: job.title || "",
      description: job.description || "",
      type: job.type || "Full-time",
      package: job.package || "",
      location: job.location || "",
      eligibility: job.eligibility || "",
      deadline: job.deadline || "",
      applicationLink: job.applicationLink || "",
      isActive: job.isActive !== false,
    });
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.companyId || !form.title.trim()) return;
    setSaving(true);
    setFeedback("");

    if (editing) {
      const { error: err } = await updateJob(editing.id, form);
      if (err) setFeedback("Failed to update drive.");
      else {
        setFeedback("Drive updated.");
        setJobs((prev) => prev.map((j) => j.id === editing.id ? { ...j, ...form } : j));
      }
    } else {
      const { data, error: err } = await addJob(form);
      if (err) setFeedback("Failed to add drive.");
      else {
        setFeedback("Drive added.");
        setJobs((prev) => [{ id: data.id, ...form, createdAt: { seconds: Date.now() / 1000 } }, ...prev]);
      }
    }
    setSaving(false);
    setTimeout(() => { setFeedback(""); setModalOpen(false); }, 1200);
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    const { error: err } = await deleteJob(confirmDelete.id);
    if (!err) setJobs((prev) => prev.filter((j) => j.id !== confirmDelete.id));
    setDeleting(false);
    setConfirmDelete(null);
  }

  async function handleToggleActive(job) {
    const newActive = job.isActive === false ? true : false;
    const { error: err } = await updateJob(job.id, { isActive: newActive });
    if (!err) setJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, isActive: newActive } : j));
  }

  return (
    <div className="admin-drives">
      <div className="ad-header">
        <div className="ad-header-left">
          <h1 className="ad-title">Placement Drives</h1>
          <p className="ad-subtitle">Manage placement drives, job listings, and deadlines.</p>
        </div>
        <button className="ad-add-btn" onClick={openAdd}>
          <PlusIcon /> Add Drive
        </button>
      </div>

      <div className="ad-toolbar glass">
        <div className="ad-search-wrap">
          <SearchIcon />
          <input
            type="text"
            placeholder="Search company, role, package..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ad-search"
          />
        </div>
        <div className="ad-filter-group">
          <span className="ad-filter-label"><FilterIcon /> Status</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="ad-select">
            <option value="all">All Drives</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="ad-filter-group">
          <span className="ad-filter-label"><SortIcon /> Sort</span>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="ad-select">
            <option value="newest">Newest First</option>
            <option value="deadline">Deadline</option>
            <option value="company">Company</option>
          </select>
        </div>
      </div>

      {feedback && <div className={`ad-feedback ${feedback.includes("Failed") ? "ad-feedback--error" : "ad-feedback--success"}`}>{feedback}</div>}

      {loading ? (
        <div className="ad-skeleton-grid">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton-card" style={{ height: 80 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="ad-empty-state glass">
          <div className="ad-empty-icon">
            <BriefcaseIcon />
          </div>
          <h3 className="ad-empty-title">
            {search ? "No matching drives found" : "No placement drives added yet."}
          </h3>
          <p className="ad-empty-desc">
            {search
              ? "Try adjusting your search or filters to find what you're looking for."
              : "Create your first placement drive to get started with tracking opportunities."}
          </p>
          {!search && (
            <button className="ad-empty-cta" onClick={openAdd}>
              <PlusIcon /> Add Your First Drive
            </button>
          )}
        </div>
      ) : (
        <div className="ad-table-wrap glass">
          <div className="ad-table-head">
            <span className="ath-company">Company</span>
            <span className="ath-role">Role</span>
            <span className="ath-package">Package</span>
            <span className="ath-deadline">Deadline</span>
            <span className="ath-status">Status</span>
            <span className="ath-actions">Actions</span>
          </div>
          {filtered.map((job) => {
            const comp = companyMap[job.companyId];
            const days = daysUntil(job.deadline);
            const status = getDriveStatus(job);
            const statusCfg = STATUS_CONFIG[status];
            return (
              <div key={job.id} className="ad-table-row">
                <span className="atr-company">
                  {comp?.logoUrl
                    ? <img src={comp.logoUrl} alt="" className="atr-logo" />
                    : <span className="atr-logo-ph">{(comp?.name || "?")[0]}</span>}
                  <span className="atr-company-name">{comp?.name || "Unknown"}</span>
                </span>
                <span className="atr-role">{job.title}</span>
                <span className="atr-package">{job.package || "—"}</span>
                <span className="atr-deadline">
                  <span className="atr-deadline-date">
                    {job.deadline ? new Date(job.deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                  </span>
                  {days !== null && days >= 0 && (
                    <span className={`atr-countdown ${days <= 3 ? "atr-countdown--urgent" : days <= 7 ? "atr-countdown--soon" : ""}`}>
                      {days === 0 ? "Today" : `${days}d left`}
                    </span>
                  )}
                  {days !== null && days < 0 && (
                    <span className="atr-countdown atr-countdown--expired">Passed</span>
                  )}
                </span>
                <span className="atr-status">
                  <span className={`drive-status ${statusCfg.className}`}>{statusCfg.label}</span>
                </span>
                <span className="atr-actions">
                  <button className="ad-action-btn" onClick={() => handleToggleActive(job)} title={job.isActive !== false ? "Deactivate" : "Activate"}>
                    <ToggleIcon active={job.isActive !== false} />
                  </button>
                  <button className="ad-action-btn" onClick={() => openEdit(job)} title="Edit drive">
                    <EditIcon />
                  </button>
                  <button className="ad-action-btn ad-action-btn--danger" onClick={() => setConfirmDelete(job)} title="Delete drive">
                    <TrashIcon />
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Drive" : "Add Drive"} wide>
        <form onSubmit={handleSave}>
          <div className="modal-field">
            <label>Company *</label>
            <select value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })} required>
              <option value="">Select company...</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="modal-field">
            <label>Role / Title *</label>
            <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Software Engineer" required />
          </div>
          <div className="modal-field">
            <label>Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Job description..." />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div className="modal-field">
              <label>Package</label>
              <input type="text" value={form.package} onChange={(e) => setForm({ ...form, package: e.target.value })} placeholder="e.g. 7 LPA" />
            </div>
            <div className="modal-field">
              <label>Job Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option>Full-time</option>
                <option>Internship</option>
                <option>Contract</option>
                <option>Part-time</option>
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div className="modal-field">
              <label>Location</label>
              <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Bangalore" />
            </div>
            <div className="modal-field">
              <label>Deadline</label>
              <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
            </div>
          </div>
          <div className="modal-field">
            <label>Eligibility</label>
            <input type="text" value={form.eligibility} onChange={(e) => setForm({ ...form, eligibility: e.target.value })} placeholder="e.g. CSE, IT — CGPA 7+" />
          </div>
          <div className="modal-field">
            <label>Application URL</label>
            <input type="url" value={form.applicationLink} onChange={(e) => setForm({ ...form, applicationLink: e.target.value })} placeholder="https://..." />
          </div>
          <div className="modal-actions">
            <button type="button" className="modal-btn modal-btn--secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="modal-btn modal-btn--primary" disabled={saving || !form.companyId || !form.title.trim()}>
              {saving ? "Saving..." : editing ? "Update Drive" : "Add Drive"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Drive">
        <p className="modal-confirm-text">
          Are you sure you want to delete <strong>{confirmDelete?.title}</strong>? This action cannot be undone.
        </p>
        <div className="modal-actions">
          <button className="modal-btn modal-btn--secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
          <button className="modal-btn modal-btn--danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Deleting..." : "Delete Drive"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
