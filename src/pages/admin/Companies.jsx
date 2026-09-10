import { useState, useEffect, useMemo } from "react";
import { getCompanies, addCompany, updateCompany, deleteCompany } from "../../services/firestore";
import Modal from "../../components/Modal";
import "./Companies.css";

const EMPTY = { name: "", industry: "", website: "", logoUrl: "", description: "", location: "", contactEmail: "", isActive: true };

const BuildingIcon = () => (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
    <path d="M9 22v-4h6v4" />
    <path d="M8 6h.01" /><path d="M16 6h.01" />
    <path d="M8 10h.01" /><path d="M16 10h.01" />
    <path d="M8 14h.01" /><path d="M16 14h.01" />
  </svg>
);

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
  </svg>
);

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14" /><path d="M5 12h14" />
  </svg>
);

const PencilIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  </svg>
);

const ToggleIcon = ({ active }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {active ? (
      <><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></>
    ) : (
      <><circle cx="12" cy="12" r="10" /><path d="m8 12 4 4 4-4" /></>
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
    <path d="m3 16 4 4 4-4" /><path d="M7 20V4" />
    <path d="m21 8-4-4-4 4" /><path d="M17 4v16" />
  </svg>
);

export default function AdminCompanies() {
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
      const compRes = await getCompanies();
      setCompanies(compRes.data || []);
      setLoading(false);
    }
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    let result = [...companies];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c) =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.industry || "").toLowerCase().includes(q) ||
        (c.location || "").toLowerCase().includes(q)
      );
    }
    if (filter === "active") result = result.filter((c) => c.isActive !== false);
    if (filter === "inactive") result = result.filter((c) => c.isActive === false);
    if (sortBy === "newest") result.sort((a, b) => {
      const aTime = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt instanceof Date ? a.createdAt.getTime() : 0);
      const bTime = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt instanceof Date ? b.createdAt.getTime() : 0);
      return bTime - aTime;
    });
    if (sortBy === "oldest") result.sort((a, b) => {
      const aTime = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt instanceof Date ? a.createdAt.getTime() : 0);
      const bTime = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt instanceof Date ? b.createdAt.getTime() : 0);
      return aTime - bTime;
    });
    if (sortBy === "name") result.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return result;
  }, [companies, search, filter, sortBy]);

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY });
    setModalOpen(true);
  }

  function openEdit(company) {
    setEditing(company);
    setForm({
      name: company.name || "",
      industry: company.industry || "",
      website: company.website || "",
      logoUrl: company.logoUrl || "",
      description: company.description || "",
      location: company.location || "",
      contactEmail: company.contactEmail || "",
      isActive: company.isActive !== false,
    });
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setFeedback("");

    if (editing) {
      const { error: err } = await updateCompany(editing.id, form);
      if (err) setFeedback("Failed to update company.");
      else {
        setFeedback("Company updated.");
        setCompanies((prev) => prev.map((c) => c.id === editing.id ? { ...c, ...form } : c));
      }
    } else {
      const { data, error: err } = await addCompany(form);
      if (err) setFeedback("Failed to add company.");
      else {
        setFeedback("Company added.");
        setCompanies((prev) => [{ id: data.id, ...form, createdAt: new Date() }, ...prev]);
      }
    }
    setSaving(false);
    setTimeout(() => { setFeedback(""); setModalOpen(false); }, 1200);
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    const { error: err } = await deleteCompany(confirmDelete.id);
    if (!err) {
      setCompanies((prev) => prev.filter((c) => c.id !== confirmDelete.id));
    }
    setDeleting(false);
    setConfirmDelete(null);
  }

  async function handleToggleActive(company) {
    const newActive = company.isActive === false ? true : false;
    const { error: err } = await updateCompany(company.id, { isActive: newActive });
    if (!err) {
      setCompanies((prev) => prev.map((c) => c.id === company.id ? { ...c, isActive: newActive } : c));
    }
  }

  return (
    <div className="admin-companies">
      <div className="ac-header">
        <div className="ac-header-text">
          <h1 className="ac-title">Companies</h1>
          <p className="ac-subtitle">Manage the company database</p>
        </div>
        <button className="ac-add-btn" onClick={openAdd}>
          <PlusIcon />
          <span>Add Company</span>
        </button>
      </div>

      <div className="ac-toolbar glass">
        <div className="ac-search-wrap">
          <SearchIcon />
          <input
            type="text"
            placeholder="Search companies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ac-search"
          />
        </div>
        <div className="ac-filter-group">
          <div className="ac-select-wrap">
            <FilterIcon />
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="ac-select">
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="ac-select-wrap">
            <SortIcon />
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="ac-select">
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>
      </div>

      {feedback && <div className={`ac-feedback ${feedback.includes("Failed") ? "ac-feedback--error" : "ac-feedback--success"}`}>{feedback}</div>}

      {loading ? (
        <div className="ac-list">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton-card" style={{ height: 64 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="ac-empty glass">
          <div className="ac-empty-icon">
            <BuildingIcon />
          </div>
          <h3 className="ac-empty-title">
            {search ? "No matches found" : "No companies added yet"}
          </h3>
          <p className="ac-empty-desc">
            {search
              ? "Try adjusting your search or filters."
              : "Add your first company to start building your placement database."}
          </p>
          {!search && (
            <button className="ac-empty-cta" onClick={openAdd}>
              <PlusIcon />
              <span>Add Company</span>
            </button>
          )}
        </div>
      ) : (
        <div className="ac-table glass">
          <div className="ac-table-head">
            <span className="ath-name">Company</span>
            <span className="ath-industry">Industry</span>
            <span className="ath-status">Status</span>
            <span className="ath-actions">Actions</span>
          </div>
          {filtered.map((company) => (
            <div key={company.id} className="ac-table-row">
              <span className="atr-name">
                {company.logoUrl ? (
                  <img src={company.logoUrl} alt="" className="atr-logo" />
                ) : (
                  <span className="atr-logo-placeholder">{(company.name || "?")[0]}</span>
                )}
                <span className="atr-name-text">{company.name}</span>
              </span>
              <span className="atr-industry">{company.industry || "—"}</span>
              <span className="atr-status">
                <span className={`ac-chip ${company.isActive !== false ? "ac-chip--active" : "ac-chip--inactive"}`}>
                  {company.isActive !== false ? "Active" : "Inactive"}
                </span>
              </span>
              <span className="atr-actions">
                <button className="ac-action-btn" onClick={() => handleToggleActive(company)} title="Toggle active">
                  <ToggleIcon active={company.isActive !== false} />
                </button>
                <button className="ac-action-btn" onClick={() => openEdit(company)} title="Edit">
                  <PencilIcon />
                </button>
                <button className="ac-action-btn ac-action-btn--danger" onClick={() => setConfirmDelete(company)} title="Delete">
                  <TrashIcon />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Company" : "Add Company"}>
        <form onSubmit={handleSave} className="ac-modal-form">
          <div className="modal-field">
            <label>Company Name *</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Tata Consultancy Services" required />
          </div>
          <div className="modal-field">
            <label>Industry</label>
            <input type="text" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} placeholder="e.g. IT Services" />
          </div>
          <div className="modal-field">
            <label>Website</label>
            <input type="url" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://..." />
          </div>
          <div className="modal-field">
            <label>Logo URL</label>
            <input type="url" value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} placeholder="Official logo URL" />
          </div>
          <div className="modal-field">
            <label>Location</label>
            <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Pune, India" />
          </div>
          <div className="modal-field">
            <label>Contact Email</label>
            <input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} placeholder="hr@company.com" />
          </div>
          <div className="modal-field">
            <label>Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief company description..." />
          </div>
          <div className="modal-actions">
            <button type="button" className="modal-btn modal-btn--secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="modal-btn modal-btn--primary" disabled={saving || !form.name.trim()}>
              {saving ? "Saving..." : editing ? "Update" : "Add Company"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Company">
        <p className="modal-confirm-text">
          Are you sure you want to delete <strong>{confirmDelete?.name}</strong>?
        </p>
        <div className="modal-actions">
          <button className="modal-btn modal-btn--secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
          <button className="modal-btn modal-btn--danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
