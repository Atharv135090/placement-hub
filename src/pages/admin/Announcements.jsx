import { useState, useEffect } from "react";
import { getAnnouncements, addAnnouncement, updateAnnouncement, deleteAnnouncement } from "../../services/firestore";
import { useAuth } from "../../contexts/AuthContext";
import Modal from "../../components/Modal";
import "./Announcements.css";

const EMPTY = { title: "", content: "", priority: "normal", isActive: true };

export default function AdminAnnouncements() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const { data } = await getAnnouncements();
      setItems(data || []);
      setLoading(false);
    }
    fetchData();
  }, []);

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY });
    setModalOpen(true);
  }

  function openEdit(item) {
    setEditing(item);
    setForm({
      title: item.title || "",
      content: item.content || "",
      priority: item.priority || "normal",
      isActive: item.isActive !== false,
    });
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);

    const payload = {
      ...form,
      authorId: user.uid,
    };

    if (editing) {
      const { error: err } = await updateAnnouncement(editing.id, payload);
      if (!err) {
        setItems((prev) => prev.map((a) => a.id === editing.id ? { ...a, ...payload } : a));
        setFeedback("Announcement updated.");
      }
    } else {
      const { data, error: err } = await addAnnouncement(payload);
      if (!err) {
        setItems((prev) => [{ id: data.id, ...payload, createdAt: { seconds: Date.now() / 1000 } }, ...prev]);
        setFeedback("Announcement created.");
      }
    }
    setSaving(false);
    setTimeout(() => { setFeedback(""); setModalOpen(false); }, 1200);
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    const { error: err } = await deleteAnnouncement(confirmDelete.id);
    if (!err) setItems((prev) => prev.filter((a) => a.id !== confirmDelete.id));
    setDeleting(false);
    setConfirmDelete(null);
  }

  async function handleToggleActive(item) {
    const newActive = item.isActive === false ? true : false;
    const { error: err } = await updateAnnouncement(item.id, { isActive: newActive });
    if (!err) setItems((prev) => prev.map((a) => a.id === item.id ? { ...a, isActive: newActive } : a));
  }

  const priorityChips = {
    high: "admin-chip--red",
    normal: "admin-chip--accent",
    low: "admin-chip--muted",
  };

  return (
    <div className="admin-announce">
      <div className="admin-page-header">
        <div>
          <h1>Announcements</h1>
          <p className="admin-page-sub">Create and manage student-facing announcements.</p>
        </div>
        <button className="admin-add-btn" onClick={openAdd}>+ New Announcement</button>
      </div>

      {feedback && <div className="admin-feedback admin-feedback--success">{feedback}</div>}

      {loading ? (
        <div className="admin-list">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton-card" style={{ height: 72 }} />)}
        </div>
      ) : items.length === 0 ? (
        <div className="admin-empty glass">
          <p>No announcements yet.</p>
          <span>Create your first announcement to inform students.</span>
        </div>
      ) : (
        <div className="announce-list">
          {items.map((item) => (
            <div key={item.id} className="announce-card glass">
              <div className="announce-card-head">
                <div className="announce-card-info">
                  <h3>{item.title}</h3>
                  <div className="announce-meta">
                    <span className={`admin-chip ${priorityChips[item.priority] || "admin-chip--muted"}`}>
                      {item.priority || "normal"}
                    </span>
                    <span className={`admin-chip ${item.isActive !== false ? "admin-chip--green" : "admin-chip--muted"}`}>
                      {item.isActive !== false ? "Active" : "Inactive"}
                    </span>
                    <span className="announce-date">
                      {item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""}
                    </span>
                  </div>
                </div>
                <div className="announce-actions">
                  <button className="admin-action-btn" onClick={() => handleToggleActive(item)} title="Toggle active">
                    {item.isActive !== false ? "◯" : "●"}
                  </button>
                  <button className="admin-action-btn" onClick={() => openEdit(item)} title="Edit">✎</button>
                  <button className="admin-action-btn admin-action-btn--danger" onClick={() => setConfirmDelete(item)} title="Delete">✕</button>
                </div>
              </div>
              {item.content && <p className="announce-content">{item.content}</p>}
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Announcement" : "New Announcement"}>
        <form onSubmit={handleSave}>
          <div className="modal-field">
            <label>Title *</label>
            <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Announcement title" required />
          </div>
          <div className="modal-field">
            <label>Content</label>
            <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Details..." rows={4} />
          </div>
          <div className="modal-field">
            <label>Priority</label>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" className="modal-btn modal-btn--secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="modal-btn modal-btn--primary" disabled={saving || !form.title.trim()}>
              {saving ? "Saving..." : editing ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Announcement">
        <p className="modal-confirm-text">
          Are you sure you want to delete <strong>{confirmDelete?.title}</strong>?
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
